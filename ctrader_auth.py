"""
Module d'authentification cTrader Open API (OAuth2).
Utilise le SDK officiel Spotware : pip install ctrader-open-api

Variables d'environnement requises (à définir sur Railway) :
    CTRADER_CLIENT_ID
    CTRADER_CLIENT_SECRET
    CTRADER_REDIRECT_URI   -> https://journal-de-trading-production.up.railway.app/oauth/callback
"""
import os
import json
from ctrader_open_api import Auth

CLIENT_ID = os.environ["CTRADER_CLIENT_ID"]
CLIENT_SECRET = os.environ["CTRADER_CLIENT_SECRET"]
REDIRECT_URI = os.environ["CTRADER_REDIRECT_URI"]

# TODO: migrer ce stockage vers une table Supabase pour la persistance en production.
# Un fichier local suffit pour valider le pipeline en démo, mais Railway peut
# redéployer/redémarrer le service et effacer le système de fichiers.
TOKEN_FILE = "ctrader_tokens.json"

auth = Auth(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)


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
    with open(TOKEN_FILE, "w") as f:
        json.dump(token_response, f)


def load_tokens() -> dict | None:
    if not os.path.exists(TOKEN_FILE):
        return None
    with open(TOKEN_FILE) as f:
        return json.load(f)
