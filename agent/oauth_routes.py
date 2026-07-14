"""
Routes FastAPI pour le flux d'autorisation OAuth2 cTrader Open API.

A inclure dans l'app principale avec :
    from oauth_routes import router as oauth_router
    app.include_router(oauth_router)
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse

from ctrader_auth import get_authorization_url, exchange_code_for_token

router = APIRouter()


@router.get("/oauth/login")
def oauth_login():
    """
    Point d'entrée manuel : ouvre cette URL dans un navigateur pour lancer
    l'autorisation. Redirige vers la page de connexion cTID.
    """
    return RedirectResponse(get_authorization_url())


@router.get("/oauth/callback")
def oauth_callback(code: str | None = None, error: str | None = None):
    """
    Callback appelé par cTrader après que l'utilisateur ait autorisé l'app.
    Doit correspondre EXACTEMENT à CTRADER_REDIRECT_URI et à l'URL déclarée
    dans l'application sur openapi.ctrader.com.
    """
    if error:
        raise HTTPException(status_code=400, detail=f"Autorisation refusée par cTrader : {error}")

    if not code:
        raise HTTPException(status_code=400, detail="Paramètre 'code' manquant dans le callback.")

    try:
        tokens = exchange_code_for_token(code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Échec de l'échange du code d'autorisation : {e}")

    if tokens.get("errorCode"):
        raise HTTPException(status_code=400, detail=f"Erreur cTrader : {tokens.get('description')}")

    return HTMLResponse("""
        <html>
            <body style="font-family: sans-serif; text-align: center; margin-top: 4rem;">
                <h2>✅ Connexion cTrader réussie</h2>
                <p>L'access token et le refresh token ont été récupérés et sauvegardés.</p>
                <p>Tu peux fermer cette page et revenir à Telegram/Claude.</p>
            </body>
        </html>
    """)


@router.get("/oauth/status")
def oauth_status():
    """Vérifie rapidement si un token est déjà stocké côté serveur."""
    from ctrader_auth import load_tokens
    tokens = load_tokens()
    if not tokens:
        return {"connected": False}
    return {
        "connected": True,
        "expiresIn": tokens.get("expiresIn"),
        "tokenType": tokens.get("tokenType"),
    }


@router.get("/oauth/accounts")
async def oauth_accounts():
    """
    Liste les comptes cTrader liés au token actuel, avec leur ctidTraderAccountId.
    A appeler une seule fois pour trouver l'ID du compte démo à mettre ensuite
    dans la variable Railway CTRADER_ACCOUNT_ID.
    """
    from ctrader_trading import list_accounts
    try:
        accounts = await list_accounts()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération des comptes : {e}")
    return {"accounts": accounts}
