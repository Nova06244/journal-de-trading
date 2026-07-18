"""
Module d'exécution des ordres via cTrader Open API.
Utilise le SDK officiel Spotware (ctrader-open-api), basé sur Twisted.

IMPORTANT - Interopérabilité Twisted/asyncio :
FastAPI tourne sur une boucle asyncio. Twisted (utilisé par ctrader-open-api)
tourne normalement sur son propre "reactor". Pour que les deux cohabitent dans
le même process, on installe le reactor asyncio de Twisted AVANT tout import
de twisted.internet.reactor - c'est fait tout en haut de ce fichier, et ce
fichier doit donc être importé AVANT tout autre import lié à Twisted.

ATTENTION - Points à vérifier avant de faire confiance à ce module :
1. calculate_volume() utilise une hypothèse de conversion (1 lot = 100 unités
   cTrader) qui doit être validée contre les vraies specs du symbole NAS100
   chez IC Markets (lotSize/minVolume/stepVolume retournés par get_symbol_id).
2. Le prix d'exécution réel n'est pas garanti égal à entry_price (slippage) -
   idéalement, il faudrait écouter l'event ProtoOAExecutionEvent plutôt que
   de faire confiance au prix du signal TradingView.
3. Variables d'environnement requises : CTRADER_ACCOUNT_ID, CTRADER_ENV.
"""
import asyncio
from twisted.internet import asyncioreactor
try:
    asyncioreactor.install(asyncio.get_event_loop())
except Exception:
    pass  # déjà installé (rechargement à chaud, tests, etc.)

import os
from ctrader_open_api import Client, TcpProtocol, EndPoints
from ctrader_open_api.messages.OpenApiMessages_pb2 import (
    ProtoOAApplicationAuthReq,
    ProtoOAAccountAuthReq,
    ProtoOASymbolsListReq,
    ProtoOANewOrderReq,
    ProtoOATraderReq,
    ProtoOAGetAccountListByAccessTokenReq,
)
from ctrader_open_api.messages.OpenApiModelMessages_pb2 import (
    ProtoOAOrderType,
    ProtoOATradeSide,
)

from ctrader_auth import load_tokens
from supabase_journal import log_trade_entry

CLIENT_ID = os.environ["CTRADER_CLIENT_ID"]
CLIENT_SECRET = os.environ["CTRADER_CLIENT_SECRET"]
# Optionnel à l'import : tant qu'on n'a pas encore récupéré l'account ID via
# /oauth/accounts, cette variable n'existe pas - elle n'est requise qu'au
# moment d'exécuter un trade (voir _require_account_id() ci-dessous).
_CTRADER_ACCOUNT_ID_RAW = os.environ.get("CTRADER_ACCOUNT_ID")
CTRADER_ACCOUNT_ID = int(_CTRADER_ACCOUNT_ID_RAW) if _CTRADER_ACCOUNT_ID_RAW else None
CTRADER_ENV = os.environ.get("CTRADER_ENV", "demo")


def _require_account_id() -> int:
    if CTRADER_ACCOUNT_ID is None:
        raise RuntimeError(
            "CTRADER_ACCOUNT_ID n'est pas défini. "
            "Récupère-le via GET /oauth/accounts puis ajoute-le dans les variables Railway."
        )
    return CTRADER_ACCOUNT_ID

HOST = EndPoints.PROTOBUF_DEMO_HOST if CTRADER_ENV == "demo" else EndPoints.PROTOBUF_LIVE_HOST
RISK_PERCENT = float(os.environ.get("RISK_PERCENT", "1.0"))

_client = None
_symbol_cache = {}
_connected = False
_connection_event = None


def get_client():
    global _client, _connection_event
    if _client is None:
        print(f"[ctrader] Création du client vers {HOST}:{EndPoints.PROTOBUF_PORT}", flush=True)
        _client = Client(HOST, EndPoints.PROTOBUF_PORT, TcpProtocol)
        _connection_event = asyncio.Event()

        def _on_connected(client):
            print("[ctrader] ✅ _on_connected() déclenché - connexion établie", flush=True)
            _connection_event.set()

        def _on_disconnected(client, reason):
            print(f"[ctrader] ❌ _on_disconnected() déclenché - reason={reason}", flush=True)
            _connection_event.clear()

        def _on_message_received(client, message):
            print(f"[ctrader] 📩 Message reçu - payloadType={message.payloadType}", flush=True)

        # IMPORTANT : ces callbacks doivent être enregistrés AVANT startService(),
        # et aucun message ne doit être envoyé tant que _on_connected() n'a pas
        # été déclenché - sinon le message part dans le vide et le send()
        # correspondant ne reçoit jamais de réponse (timeout silencieux).
        _client.setConnectedCallback(_on_connected)
        _client.setDisconnectedCallback(_on_disconnected)
        _client.setMessageReceivedCallback(_on_message_received)
    return _client


def start_client_service():
    """A appeler UNE SEULE FOIS au démarrage de l'app (hook FastAPI startup)."""
    print("[ctrader] Démarrage du client service...", flush=True)
    get_client().startService()


async def _wait_for_connection(timeout=20):
    """Attend que la connexion TCP/SSL avec cTrader soit réellement établie."""
    get_client()  # s'assure que le client + l'event existent
    try:
        await asyncio.wait_for(_connection_event.wait(), timeout=timeout)
    except asyncio.TimeoutError:
        raise RuntimeError(
            "Connexion au serveur cTrader impossible (timeout TCP/SSL après "
            f"{timeout}s) - vérifie CTRADER_ENV et la connectivité réseau."
        )


async def _send(request, timeout=15):
    """Bridge Deferred (Twisted) -> Future (asyncio) pour pouvoir 'await' un envoi."""
    await _wait_for_connection()
    print(f"[ctrader] ➡️ Envoi requête payloadType={request.payloadType if hasattr(request,'payloadType') else '?'}", flush=True)
    client = get_client()
    deferred = client.send(request)
    future = asyncio.get_event_loop().create_future()

    def on_result(result):
        print("[ctrader] ⬅️ on_result() déclenché - réponse reçue", flush=True)
        if not future.done():
            future.set_result(result)

    def on_error(failure):
        print(f"[ctrader] ⬅️ on_error() déclenché - {failure}", flush=True)
        if not future.done():
            future.set_exception(RuntimeError(str(failure)))

    deferred.addCallbacks(on_result, on_error)
    try:
        return await asyncio.wait_for(future, timeout=timeout)
    except asyncio.TimeoutError:
        print(f"[ctrader] ⏱️ TIMEOUT après {timeout}s en attendant la réponse - aucun callback déclenché", flush=True)
        raise


_app_authenticated = False


async def _ensure_app_authenticated():
    """
    Authentifie uniquement l'APPLICATION (clientId/clientSecret) - étape
    préalable commune, qu'on connaisse déjà l'account ID ou pas encore.
    """
    global _app_authenticated
    if _app_authenticated:
        return
    app_auth = ProtoOAApplicationAuthReq()
    app_auth.clientId = CLIENT_ID
    app_auth.clientSecret = CLIENT_SECRET
    await _send(app_auth)
    _app_authenticated = True


async def list_accounts() -> list:
    """
    Liste tous les comptes cTrader (démo et réels, tous brokers) liés au token
    actuel. Sert UNIQUEMENT à identifier le ctidTraderAccountId du compte démo
    à mettre dans la variable Railway CTRADER_ACCOUNT_ID - ne nécessite pas de
    connaître cet ID à l'avance.
    """
    tokens = load_tokens()
    if not tokens:
        raise RuntimeError("Aucun token cTrader trouvé - passe par /oauth/login d'abord.")

    await _ensure_app_authenticated()

    req = ProtoOAGetAccountListByAccessTokenReq()
    req.accessToken = tokens["accessToken"]
    res = await _send(req)

    # NOTE: si ce champ lève une AttributeError, vérifie le nom exact du champ
    # dans le fichier généré OpenApiMessages_pb2.py de ta version installée
    # (il peut s'appeler 'accounts' ou 'ctidTraderAccount' selon la version du SDK).
    # NOTE: si 'traderLogin' lève une AttributeError, vérifie le nom exact du
    # champ dans OpenApiMessages_pb2.py de ta version installée (peut aussi
    # s'appeler 'login' selon la version du SDK).
    accounts = []
    for acc in res.ctidTraderAccount:
        login = None
        try:
            login = acc.traderLogin
        except AttributeError:
            pass
        accounts.append({
            "ctidTraderAccountId": acc.ctidTraderAccountId,
            "isLive": acc.isLive,
            "traderLogin": login,
        })
    return accounts


async def ensure_connected():
    """Authentifie l'app PUIS le compte spécifique (nécessite CTRADER_ACCOUNT_ID)."""
    global _connected
    if _connected:
        return

    tokens = load_tokens()
    if not tokens:
        raise RuntimeError("Aucun token cTrader trouvé - passe par /oauth/login d'abord.")

    account_id = _require_account_id()

    await _ensure_app_authenticated()

    acc_auth = ProtoOAAccountAuthReq()
    acc_auth.ctidTraderAccountId = account_id
    acc_auth.accessToken = tokens["accessToken"]
    await _send(acc_auth)

    _connected = True


async def get_account_balance() -> float:
    """Solde actuel du compte démo, nécessaire pour le calcul du volume à 1% de risque."""
    await ensure_connected()
    req = ProtoOATraderReq()
    req.ctidTraderAccountId = CTRADER_ACCOUNT_ID
    res = await _send(req)
    return res.trader.balance / 100.0  # cTrader retourne le solde en centimes


async def get_symbol_id(symbol_name: str):
    """
    Résout le nom du symbole (ex: 'NAS100', 'US100') en symbolId cTrader.
    Nécessaire car chaque broker a ses propres IDs internes - impossible à deviner.
    """
    await ensure_connected()
    if symbol_name in _symbol_cache:
        return _symbol_cache[symbol_name]

    req = ProtoOASymbolsListReq()
    req.ctidTraderAccountId = CTRADER_ACCOUNT_ID
    res = await _send(req)

    for s in res.symbol:
        if s.symbolName.upper() == symbol_name.upper():
            info = {"symbolId": s.symbolId, "digits": s.digits}
            _symbol_cache[symbol_name] = (s.symbolId, info)
            return s.symbolId, info

    raise ValueError(f"Symbole '{symbol_name}' introuvable sur ce compte cTrader.")


def calculate_volume(balance: float, sl_points: float, point_value_per_lot: float = 1.0) -> int:
    """
    Calcule le volume pour risquer RISK_PERCENT du solde.

    HYPOTHESE A VERIFIER : point_value_per_lot=1.0 $/point pour le NAS100
    (1 lot = 1$/point), et conversion lot -> unités cTrader (x100). Ces deux
    hypothèses doivent être confrontées aux vraies specs du symbole avant de
    faire confiance à ce calcul, même en démo.
    """
    risk_amount = balance * (RISK_PERCENT / 100.0)
    raw_lots = risk_amount / (sl_points * point_value_per_lot)
    lots = max(0.01, round(raw_lots, 2))
    volume_units = int(lots * 100)
    return volume_units


async def execute_trade(symbol: str, direction: str, entry_price, data: dict) -> dict:
    """Point d'entrée appelé par main.py à chaque signal reçu - exécution immédiate, sans validation."""
    await ensure_connected()
    account_id = _require_account_id()

    sl_points = float(data.get("sl_points", 50))
    tp_points = float(data.get("tp_points", 100))

    symbol_id, specs = await get_symbol_id(symbol)
    balance = await get_account_balance()
    volume = calculate_volume(balance, sl_points)

    entry_price_f = float(entry_price)
    trade_direction = "LONG" if direction.upper() == "BUY" else "SHORT"
    if direction.upper() == "BUY":
        trade_side = ProtoOATradeSide.BUY
        sl_price = entry_price_f - sl_points
        tp_price = entry_price_f + tp_points
    else:
        trade_side = ProtoOATradeSide.SELL
        sl_price = entry_price_f + sl_points
        tp_price = entry_price_f - tp_points

    order = ProtoOANewOrderReq()
    order.ctidTraderAccountId = account_id
    order.symbolId = symbol_id
    order.orderType = ProtoOAOrderType.MARKET
    order.tradeSide = trade_side
    order.volume = volume
    order.stopLoss = sl_price
    order.takeProfit = tp_price
    order.comment = "NASDAQ-Open-Reversal-Bot"

    res = await _send(order)

    # Journalisation automatique dans Supabase - ne doit jamais faire échouer
    # le trade lui-même si l'écriture en base rencontre un problème.
    trade_id = None
    try:
        trade_id = log_trade_entry(
            symbol=symbol,
            direction=trade_direction,
            entry_price=entry_price_f,
            sl_price=sl_price,
            tp_price=tp_price,
            sl_points=sl_points,
            tp_points=tp_points,
            volume=volume,
            risk_percent=RISK_PERCENT,
            account_balance_before=balance,
            source="auto",
        )
    except Exception as e:
        print(f"[supabase_journal] Échec de l'enregistrement du trade : {e}")

    return {
        "executed_price": entry_price_f,  # approximatif - voir note en tête de fichier
        "volume": volume,
        "sl": sl_price,
        "tp": tp_price,
        "trade_id": trade_id,
    }
