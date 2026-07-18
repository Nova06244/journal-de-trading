from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

from oauth_routes import router as oauth_router
from ctrader_trading import execute_trade, start_client_service
from ctrader_trading import list_all_symbols
from ctrader_trading import get_symbol_id, get_symbol_specs


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oauth_router)


@app.on_event("startup")
async def startup_event():
    """Démarre la connexion persistante au client cTrader au lancement de l'app."""
    start_client_service()


TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")


async def send_telegram(text: str):
    """Notification passive uniquement -- le trade est déjà exécuté (ou a échoué)
    au moment où ce message part, pas de bouton ACCEPTER/REFUSER."""
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML"
    }
    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload)


@app.post("/webhook/signal")
async def receive_signal(request: Request):
    data = await request.json()
    symbol = data.get("symbol", "?")
    direction = data.get("direction", "?")   # "BUY" ou "SELL"
    niveau = data.get("niveau", "?")
    type_trade = data.get("type_trade", "?")
    prix = data.get("prix", "?")
    session = data.get("session", "?")

    emoji = "🟢" if direction == "BUY" else "🔴"

    try:
        result = await execute_trade(
            symbol=symbol,
            direction=direction,
            entry_price=prix,
            data=data,
        )
        statut = f"✅ Trade exécuté automatiquement (SL {result['sl']} / TP {result['tp']})"
    except Exception as e:
        statut = f"❌ Échec d'exécution : {type(e).__name__}: {e}"

    message = (
        f"{emoji} <b>SIGNAL {symbol}</b>\n"
        f"{statut}\n"
        f"Direction : <b>{direction}</b>\n"
        f"Niveau : {niveau}\n"
        f"Type : {type_trade}\n"
        f"Prix : {prix}\n"
        f"Session : {session}"
    )

    await send_telegram(message)
    return {"status": "signal reçu et traité"}


@app.get("/")
async def root():
    return {"status": "NASDAQ Open Reversal Bot actif"}


@app.get("/debug/network-test")
async def network_test():
    """
    Route de diagnostic temporaire : teste une simple connexion TCP brute
    vers les serveurs cTrader, sans passer par Twisted/SSL/le SDK complet.
    Permet d'isoler si le problème est un blocage réseau Railway ou un
    souci plus profond côté bibliothèque cTrader.
    """
    import socket
    results = {}
    for host, port, label in [
        ("demo.ctraderapi.com", 5035, "cTrader démo (protobuf)"),
        ("google.com", 443, "Contrôle (Google HTTPS)"),
    ]:
        try:
            sock = socket.create_connection((host, port), timeout=8)
            sock.close()
            results[label] = f"✅ OK ({host}:{port})"
        except Exception as e:
            results[label] = f"❌ {type(e).__name__}: {e} ({host}:{port})"
    return results


@app.get("/debug/symbols")
async def debug_symbols():
    """
    Route de diagnostic temporaire : liste tous les symboles disponibles
    sur ce compte cTrader pour identifier le nom exact utilisé par le
    broker (ex: retrouver le vrai nom du Nasdaq 100 chez IC Markets).
    """
    names = await list_all_symbols()
    return {"count": len(names), "symbols": names}
