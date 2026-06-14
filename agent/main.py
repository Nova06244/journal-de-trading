from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

async def send_telegram(text: str, keyboard: dict = None):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML"
    }
    if keyboard:
        payload["reply_markup"] = keyboard
    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload)

@app.post("/webhook/signal")
async def receive_signal(request: Request):
    data = await request.json()
    symbol = data.get("symbol", "?")
    direction = data.get("direction", "?")
    niveau = data.get("niveau", "?")
    type_trade = data.get("type_trade", "?")
    prix = data.get("prix", "?")
    session = data.get("session", "?")

    emoji = "🟢" if direction == "BUY" else "🔴"

    message = (
        f"{emoji} <b>SIGNAL {symbol}</b>\n"
        f"Direction : <b>{direction}</b>\n"
        f"Niveau : {niveau}\n"
        f"Type : {type_trade}\n"
        f"Prix : {prix}\n"
        f"Session : {session}"
    )

    keyboard = {
        "inline_keyboard": [[
            {"text": "✅ ACCEPTER", "callback_data": f"accept|{symbol}|{direction}|{prix}"},
            {"text": "❌ REFUSER", "callback_data": "refuse"}
        ]]
    }

    await send_telegram(message, keyboard)
    return {"status": "signal reçu"}

@app.post("/webhook/telegram")
async def telegram_webhook(request: Request):
    data = await request.json()
    callback = data.get("callback_query")
    if callback:
        answer = callback.get("data", "")
        if answer.startswith("accept"):
            _, symbol, direction, prix = answer.split("|")
            await send_telegram(f"✅ Trade <b>ACCEPTÉ</b>\n{symbol} {direction} @ {prix}\n⏳ Envoi à cTrader...")
        elif answer == "refuse":
            await send_telegram("❌ Trade <b>REFUSÉ</b>")
    return {"ok": True}

@app.get("/")
async def root():
    return {"status": "Pivot Agent actif"}
