from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from oauth_routes import router as oauth_router
from ctrader_trading import execute_trade, start_client_service
import httpx
import os

app = FastAPI()


@app.on_event("startup")
async def startup_event():
    """Démarre la connexion persistante au client cTrader au lancement de l'app."""
    start_client_service()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oauth_router)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")


async def send_telegram(text: str):
    """Notification passive uniquement - plus de boutons ACCEPTER/REFUSER."""
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
    """
    Reçoit l'alerte TradingView et EXECUTE le trade immédiatement sur cTrader,
    sans validation humaine. Telegram sert uniquement à notifier le résultat.
    """
    data = await request.json()
    symbol = data.get("symbol", "?")
    direction = data.get("direction", "?")   # "BUY" ou "SELL"
    niveau = data.get("niveau", "?")
    type_trade = data.get("type_trade", "?")
    prix = data.get("prix", "?")
    session = data.get("session", "?")

    emoji = "🟢" if direction == "BUY" else "🔴"

    # 1. Notification immédiate : signal reçu
    await send_telegram(
        f"{emoji} <b>SIGNAL {symbol}</b>\n"
        f"Direction : <b>{direction}</b>\n"
        f"Niveau : {niveau}\n"
        f"Type : {type_trade}\n"
        f"Prix : {prix}\n"
        f"Session : {session}\n"
        f"⏳ Exécution automatique en cours..."
    )

    # 2. Exécution automatique de l'ordre sur cTrader (démo)
    try:
        result = await execute_trade(
            symbol=symbol,
            direction=direction,
            entry_price=prix,
            data=data,  # sl/tp/volume calculés dans ctrader_trading.py
        )
        await send_telegram(
            f"✅ Trade <b>EXÉCUTÉ</b>\n{symbol} {direction} @ {result.get('executed_price', prix)}"
        )
    except Exception as e:
        await send_telegram(f"❌ <b>ÉCHEC D'EXÉCUTION</b>\n{symbol} {direction}\nErreur : {e}")

    return {"status": "signal reçu et traité"}


@app.get("/")
async def root():
    return {"status": "Pivot Agent actif"}
