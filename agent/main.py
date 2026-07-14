from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

from oauth_routes import router as oauth_router

app = FastAPI()

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
    """Notification passive uniquement -- plus de boutons ACCEPT/REFUSER,
    le trade est déjà exécuté au moment où ce message part."""
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML"
    }
    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload)


async def execute_trade_ctrader(symbol: str, direction: str, prix: float) -> dict:
    """
    TODO: brique non encore codée.
    Doit envoyer un ProtoOANewOrderReq (ordre au marché) via le client
    cTrader Open API (WebSocket/Protobuf), avec :
      - calcul du volume à 1% de risque à partir du solde du compte démo
      - stopLoss / takeProfit selon les règles de la stratégie
      - enregistrement de l'entryTime + positionId pour le job de BE à 15 min
    Tant que cette fonction n'est pas implémentée, l'automatisation
    n'est PAS complète -- le webhook reçoit bien le signal, mais aucun
    ordre n'est réellement envoyé à cTrader pour l'instant.
    """
    raise NotImplementedError("Module d'exécution cTrader pas encore codé.")


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

    try:
        await execute_trade_ctrader(symbol, direction, prix)
        statut = "✅ Trade exécuté automatiquement"
    except NotImplementedError:
        statut = "⚠️ Signal reçu -- exécution cTrader pas encore branchée"

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
    return {"status": "Pivot Agent actif"}
