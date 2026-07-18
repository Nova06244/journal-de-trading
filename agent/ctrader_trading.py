"""
Module d'exécution des ordres via cTrader Open API.
Utilise le SDK officiel Spotware (ctrader-open-api), basé sur Twisted.

IMPORTANT - Interopérabilité Twisted/asyncio :
Après plusieurs tentatives infructueuses pour faire cohabiter le reactor
Twisted directement dans la boucle asyncio d'Uvicorn (via asyncioreactor -
conflits d'installation, puis ClientService qui ne se connectait jamais
malgré un reactor correctement installé et démarré), on utilise `crochet`,
une bibliothèque conçue spécifiquement pour ce problème : elle fait tourner
le reactor Twisted dans son propre thread dédié, exactement comme dans un
script Python classique qui fonctionne - au lieu de forcer une cohabitation
fragile dans la même boucle. C'est l'approche recommandée par la communauté
Twisted pour ce type d'intégration.

ATTENTION - Points à vérifier avant de faire confiance à ce module :
1. calculate_volume() utilise une hypothèse de conversion (1 lot = 100 unités
   cTrader) qui doit être validée contre les vraies specs du symbole USTEC
   chez IC Markets (lotSize/minVolume/stepVolume - non renvoyés par la liste
   allégée ProtoOASymbolsListReq, voir get_symbol_id()).
2. Le prix d'exécution réel n'est pas garanti égal à entry_price (slippage) -
   idéalement, il faudrait écouter l'event ProtoOAExecutionEvent plutôt que
   de faire confiance au prix du signal TradingView.
3. Variables d'environnement requises : CTRADER_ACCOUNT_ID, CTRADER_ENV.
4. SYMBOL_ALIASES (ci-dessous) fait le pont entre le nom envoyé par le signal
   (ex: 'NAS100', nom générique utilisé côté TradingView/alerte) et le nom
   réel du symbole chez le broker connecté (IC Markets utilise 'USTEC',
   confirmé via la route de diagnostic GET /debug/symbols).
   Si le broker change ou si le nom exact diffère, corriger ici uniquement -
   aucune autre partie du code n'a besoin de changer.
"""
import crochet
crochet.setup()  # démarre le reactor Twisted dans un thread dédié, une seule fois
print("[ctrader] ✅ crochet.setup() - reactor Twisted démarré dans son propre thread", flush=True)

import os
import asyncio
from ctrader_open_api import Client, TcpProtocol, EndPoints, Protobuf
from ctrader_open_api.messages.OpenApiMessages_pb2 import (
    ProtoOAApplicationAuthReq,
    ProtoOAAccountAuthReq,
    ProtoOASymbolsListReq,
    ProtoOASymbolByIdReq,
    ProtoOANewOrderReq,
    ProtoOATraderReq,
    ProtoOAGetAccountListByAccessTokenReq,
)
from ctrader_open_api.messages.OpenApiModelMessages_pb2 import (
    ProtoOAOrderType,
    ProtoOATradeSide,
)

from ctrader_auth import load_tokens, get_valid_tokens
from supabase_journal import log_trade_entry

CLIENT_ID = os.environ["CTRADER_CLIENT_ID"]
CLIENT_SECRET = os.environ["CTRADER_CLIENT_SECRET"]
# Optionnel à l'import : tant qu'on n'a pas encore récupéré l'account ID via
# /oauth/accounts, cette variable n'existe pas - elle n'est requise qu'au
# moment d'exécuter un trade (voir _require_account_id() ci-dessous).
_CTRADER_ACCOUNT_ID_RAW = os.environ.get("CTRADER_ACCOUNT_ID")
CTRADER_ACCOUNT_ID = int(_CTRADER_ACCOUNT_ID_RAW) if _CTRADER_ACCOUNT_ID_RAW else None
CTRADER_ENV = os.environ.get("CTRADER_ENV", "demo")

# Alias de symboles : nom générique (côté signal/TradingView) -> nom exact
# chez le broker connecté. IC Markets nomme le Nasdaq 100 "USTEC" (et non
# "NAS100" comme d'autres brokers/plateformes, ni "US100" comme initialement
# supposé - confirmé via GET /debug/symbols).
SYMBOL_ALIASES = {
    "NAS100": "USTEC",
}


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


def get_client():
    global _client
    if _client is None:
        print(f"[ctrader] Création du client vers {HOST}:{EndPoints.PROTOBUF_PORT}", flush=True)
        _client = Client(HOST, EndPoints.PROTOBUF_PORT, TcpProtocol)

        def _on_connected(client):
            print("[ctrader] ✅ _on_connected() déclenché - connexion établie", flush=True)

        def _on_disconnected(client, reason):
            print(f"[ctrader] ❌ _on_disconnected() déclenché - reason={reason}", flush=True)

        def _on_message_received(client, message):
            print(f"[ctrader] 📩 Message reçu - payloadType={message.payloadType}", flush=True)

        _client.setConnectedCallback(_on_connected)
        _client.setDisconnectedCallback(_on_disconnected)
        _client.setMessageReceivedCallback(_on_message_received)
    return _client


def start_client_service():
    """A appeler UNE SEULE FOIS au démarrage de l'app (hook FastAPI startup)."""
    print("[ctrader] Démarrage du client service (thread crochet)...", flush=True)
    _start_service_in_reactor_thread()


@crochet.run_in_reactor
def _start_service_in_reactor_thread():
    # Cette fonction s'exécute DANS le thread du reactor Twisted (via crochet),
    # exactement comme startService() serait appelé dans un script classique.
    get_client().startService()


@crochet.run_in_reactor
def _send_in_reactor_thread(request):
    # client.send() doit être appelé depuis le thread du reactor - crochet
    # s'en charge et renvoie un EventualResult qu'on peut attendre depuis
    # n'importe quel autre thread (notamment le thread asyncio de FastAPI).
    return get_client().send(request)


async def _send(request, timeout=15):
    """Envoie une requête cTrader et attend la réponse, sans bloquer la boucle asyncio principale."""
    label = request.payloadType if hasattr(request, "payloadType") else "?"
    print(f"[ctrader] ➡️ Envoi requête payloadType={label}", flush=True)
    eventual_result = _send_in_reactor_thread(request)
    try:
        raw_result = await asyncio.to_thread(eventual_result.wait, timeout)
        decoded = Protobuf.extract(raw_result)
        # Détection par attributs plutôt que par import de classe exacte
        # (le nom/emplacement exact de ProtoOAErrorRes varie selon la version
        # du SDK installée - errorCode+description est la signature stable
        # de toute réponse d'erreur cTrader).
        if hasattr(decoded, "errorCode") and hasattr(decoded, "description"):
            print(f"[ctrader] ⛔ Erreur cTrader : errorCode={decoded.errorCode} description={decoded.description}", flush=True)
            raise RuntimeError(f"Erreur cTrader ({decoded.errorCode}) : {decoded.description}")
        print("[ctrader] ⬅️ Réponse reçue", flush=True)
        return decoded
    except crochet.TimeoutError:
        print(f"[ctrader] ⏱️ TIMEOUT après {timeout}s en attendant la réponse", flush=True)
        raise RuntimeError(f"Timeout cTrader après {timeout}s en attendant la réponse à payloadType={label}")


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
    tokens = get_valid_tokens()
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

    tokens = get_valid_tokens()
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

    Le nom reçu (souvent le nom générique utilisé côté signal/TradingView) est
    d'abord passé par SYMBOL_ALIASES pour obtenir le nom réel utilisé par le
    broker connecté, avant recherche et mise en cache.
    """
    await ensure_connected()

    resolved_name = SYMBOL_ALIASES.get(symbol_name.upper(), symbol_name)

    if resolved_name in _symbol_cache:
        return _symbol_cache[resolved_name]

    req = ProtoOASymbolsListReq()
    req.ctidTraderAccountId = CTRADER_ACCOUNT_ID
    res = await _send(req)

    for s in res.symbol:
        if s.symbolName.upper() == resolved_name.upper():
            # ProtoOASymbolsListReq renvoie des ProtoOALightSymbol, qui n'ont
            # pas toujours le champ 'digits' (réservé à la réponse détaillée
            # ProtoOASymbolByIdReq) - lecture tolérante, non bloquante.
            digits = getattr(s, "digits", None)
            info = {"symbolId": s.symbolId, "digits": digits}
            _symbol_cache[resolved_name] = (s.symbolId, info)
            return s.symbolId, info

    raise ValueError(
        f"Symbole '{symbol_name}' (résolu en '{resolved_name}') introuvable sur ce compte cTrader."
    )


_symbol_specs_cache = {}


async def get_symbol_specs(symbol_id: int) -> dict:
    """
    Récupère les specs détaillées d'un symbole (minVolume, maxVolume,
    stepVolume - dans la même convention "centilots" que order.volume, ex:
    minVolume=100 signifie 1.00 lot, minVolume=10 signifie 0.10 lot) via
    ProtoOASymbolByIdReq.

    Nécessaire car ProtoOASymbolsListReq (utilisé par get_symbol_id) ne
    renvoie qu'une version allégée (ProtoOALightSymbol) sans ces infos.
    Le minimum de volume est spécifique à CHAQUE symbole et à CHAQUE compte/
    plateforme chez le broker (confirmé : le minimum vu sur MT5 pour un
    symbole ne correspond pas forcément à celui du compte cTrader) - il ne
    faut donc jamais le coder en dur, toujours l'interroger dynamiquement.
    """
    if symbol_id in _symbol_specs_cache:
        return _symbol_specs_cache[symbol_id]

    req = ProtoOASymbolByIdReq()
    req.ctidTraderAccountId = CTRADER_ACCOUNT_ID
    req.symbolId.append(symbol_id)
    res = await _send(req)

    if not res.symbol:
        raise ValueError(f"Aucune spec détaillée trouvée pour symbolId={symbol_id}.")

    s = res.symbol[0]
    specs = {
        "minVolume": getattr(s, "minVolume", 100),   # défaut prudent: 1.00 lot si absent
        "maxVolume": getattr(s, "maxVolume", None),
        "stepVolume": getattr(s, "stepVolume", 100),
        "digits": getattr(s, "digits", None),
    }
    _symbol_specs_cache[symbol_id] = specs
    return specs


def calculate_volume(
    balance: float,
    sl_points: float,
    point_value_per_lot: float = 1.0,
    min_volume_units: int = 100,
    step_volume_units: int = 100,
) -> int:
    """
    Calcule le volume pour risquer RISK_PERCENT du solde, puis l'ajuste au
    minimum et au step réels du symbole (récupérés dynamiquement via
    get_symbol_specs() - voir execute_trade()).

    HYPOTHESE A VERIFIER : point_value_per_lot=1.0 $/point pour le NAS100
    (1 lot = 1$/point). A confronter aux vraies specs du symbole avant de
    faire confiance à ce calcul, même en démo.
    """
    risk_amount = balance * (RISK_PERCENT / 100.0)
    raw_lots = risk_amount / (sl_points * point_value_per_lot)
    raw_units = int(raw_lots * 100)

    # Arrondi au step supérieur le plus proche (ex: step=10 -> multiples de 0.10 lot)
    if step_volume_units > 0:
        raw_units = ((raw_units + step_volume_units - 1) // step_volume_units) * step_volume_units

    volume_units = max(min_volume_units, raw_units)
    return volume_units


async def execute_trade(symbol: str, direction: str, entry_price, data: dict) -> dict:
    """Point d'entrée appelé par main.py à chaque signal reçu - exécution immédiate, sans validation."""
    await ensure_connected()
    account_id = _require_account_id()

    sl_points = float(data.get("sl_points", 50))
    tp_points = float(data.get("tp_points", 100))

    symbol_id, specs = await get_symbol_id(symbol)
    symbol_specs = await get_symbol_specs(symbol_id)
    balance = await get_account_balance()
    volume = calculate_volume(
        balance,
        sl_points,
        min_volume_units=symbol_specs["minVolume"],
        step_volume_units=symbol_specs["stepVolume"],
    )

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


async def list_all_symbols() -> list:
    """
    Liste tous les symboles disponibles sur ce compte cTrader, triés par nom.
    Sert de route de diagnostic (GET /debug/symbols dans main.py) pour
    identifier le nom exact utilisé par le broker pour un instrument donné.
    """
    await ensure_connected()

    req = ProtoOASymbolsListReq()
    req.ctidTraderAccountId = CTRADER_ACCOUNT_ID
    res = await _send(req)

    names = sorted(s.symbolName for s in res.symbol)
    return names
