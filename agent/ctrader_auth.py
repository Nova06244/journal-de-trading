"""
Module d'authentification cTrader Open API (OAuth2).
Utilise le SDK officiel Spotware : pip install ctrader-open-api

Le token (access + refresh) est stocké dans Supabase (table ctrader_tokens)
plutôt que dans un fichier local, car le système de fichiers de Railway
est effacé à chaque redéploiement - un stockage local ferait perdre la
connexion cTrader à chaque push GitHub.

Variables d'environnement requises (à définir sur Railway) :
    CTRADER_CLIENT_ID
    CTRADER_CLIENT_SECRET
    CTRADER_REDIRECT_URI   -> https://journal-de-trading-production.up.railway.app/oauth/callback
    SUPABASE_URL
    SUPABASE_KEY
"""
import os
from ctrader_open_api import Auth
from supabase import create_client

CLIENT_ID = os.environ["CTRADER_CLIENT_ID"]
CLIENT_SECRET = os.environ["CTRADER_CLIENT_SECRET"]
REDIRECT_URI = os.environ["CTRADER_REDIRECT_URI"]

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

auth = Auth(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_authorization_url() -> str:
    """URL vers laquelle rediriger l'utilisateur pour qu'il autorise l'app sur son cTID."""
    return auth.getAuthUri()


def exchange_code_for_token(code: str) -> dict:
    """
    Échange le code d'autorisation contre un access token + refresh token.
    Attention : le code n'est valide qu'1 minute après réception du callback,
    cette fonction doit donc être appelée immédiatement.
    """
    token_response = auth.getToken(code)
    _save_tokens(token_response)
    return token_response


def refresh_access_token() -> dict:
    """
    Renouvelle l'access token à partir du refresh token stocké.
    Le refresh token n'a pas de date d'expiration, mais l'access token
    expire après ~30 jours (2 628 000 secondes).
    """
    tokens = load_tokens()
    if not tokens or "refreshToken" not in tokens:
        raise RuntimeError("Aucun refresh token disponible — il faut repasser par /oauth/login.")

    token_response = auth.refreshToken(tokens["refreshToken"])
    _save_tokens(token_response)
    return token_response


def _save_tokens(token_response: dict) -> None:
    row = {
        "id": 1,
        "access_token": token_response.get("accessToken"),
        "refresh_token": token_response.get("refreshToken"),
        "expires_in": token_response.get("expiresIn"),
        "token_type": token_response.get("tokenType"),
    }
    _supabase.table("ctrader_tokens").upsert(row).execute()


def load_tokens() -> dict | None:
    result = _supabase.table("ctrader_tokens").select("*").eq("id", 1).execute()
    if not result.data:
        return None
    row = result.data[0]
    if not row.get("access_token"):
        return None
    return {
        "accessToken": row.get("access_token"),
        "refreshToken": row.get("refresh_token"),
        "expiresIn": row.get("expires_in"),
        "tokenType": row.get("token_type"),
    }
