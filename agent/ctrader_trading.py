"""
Module d'authentification cTrader Open API (OAuth2).
Utilise le SDK officiel Spotware : pip install ctrader-open-api

Le token (access + refresh) est stocké dans Supabase (table ctrader_tokens)
plutôt que dans un fichier local, car le système de fichiers de Railway
est effacé à chaque redéploiement - un stockage local ferait perdre la
connexion cTrader à chaque push GitHub.

RAFRAICHISSEMENT AUTOMATIQUE :
- issued_at (timestamp Unix) est enregistré à chaque sauvegarde de token,
  ce qui permet de calculer si l'access token est expiré ou sur le point
  de l'être.
- get_valid_tokens() doit être utilisée PARTOUT à la place de load_tokens()
  dès qu'un accessToken valide est nécessaire pour parler à l'API cTrader -
  elle rafraîchit automatiquement si besoin, sans jamais requérir une
  reconnexion manuelle via /oauth/login (sauf si le refresh_token lui-même
  a été révoqué, ce qui est rare).

IMPORTANT - Colonne Supabase requise :
La table ctrader_tokens doit avoir une colonne supplémentaire "issued_at"
(type int8 / bigint) en plus des colonnes existantes (access_token,
refresh_token, expires_in, token_type). Sans cette colonne, le
rafraîchissement automatique ne peut pas fonctionner (il ne saurait pas
depuis quand le token est valide).

Variables d'environnement requises (à définir sur Railway) :
    CTRADER_CLIENT_ID
    CTRADER_CLIENT_SECRET
    CTRADER_REDIRECT_URI   -> https://journal-de-trading-production.up.railway.app/oauth/callback
    SUPABASE_URL
    SUPABASE_KEY
"""
import os
import time
from ctrader_open_api import Auth
from supabase import create_client

CLIENT_ID = os.environ["CTRADER_CLIENT_ID"]
CLIENT_SECRET = os.environ["CTRADER_CLIENT_SECRET"]
REDIRECT_URI = os.environ["CTRADER_REDIRECT_URI"]

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

# Marge de sécurité avant l'expiration réelle du token (en secondes) - on
# rafraîchit un peu en avance plutôt que d'attendre l'expiration exacte,
# pour éviter tout risque de requête cTrader échouant pile au mauvais moment.
REFRESH_SAFETY_MARGIN_SECONDS = 300  # 5 minutes

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

    print("[ctrader_auth] 🔄 Rafraîchissement automatique de l'access token...", flush=True)
    token_response = auth.refreshToken(tokens["refreshToken"])
    _save_tokens(token_response)
    print("[ctrader_auth] ✅ Access token rafraîchi et sauvegardé.", flush=True)
    return token_response


def _save_tokens(token_response: dict) -> None:
    row = {
        "id": 1,
        "access_token": token_response.get("accessToken"),
        "refresh_token": token_response.get("refreshToken"),
        "expires_in": token_response.get("expiresIn"),
        "token_type": token_response.get("tokenType"),
        "issued_at": int(time.time()),
    }
    _supabase.table("ctrader_tokens").upsert(row).execute()


def load_tokens() -> dict | None:
    """Charge les tokens tels quels depuis Supabase, SANS vérifier ni rafraîchir
    s'ils sont expirés - utilisée en interne par refresh_access_token() et par
    get_valid_tokens(). Pour tout le reste, préférer get_valid_tokens()."""
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
        "issuedAt": row.get("issued_at"),
    }


def is_token_expired(tokens: dict, safety_margin_seconds: int = REFRESH_SAFETY_MARGIN_SECONDS) -> bool:
    """
    Détermine si l'access token est expiré ou sur le point de l'être.
    Si issuedAt ou expiresIn sont absents (ex: anciens tokens sauvegardés
    avant l'ajout du suivi d'expiration), on considère prudemment le token
    comme expiré pour forcer un rafraîchissement plutôt que de risquer un
    échec en pleine session de trading.
    """
    if not tokens or not tokens.get("issuedAt") or not tokens.get("expiresIn"):
        return True
    elapsed = time.time() - tokens["issuedAt"]
    return elapsed >= (tokens["expiresIn"] - safety_margin_seconds)


def get_valid_tokens() -> dict:
    """
    Retourne des tokens garantis valides (ou lève une erreur explicite si
    aucun refresh token n'est disponible), en rafraîchissant automatiquement
    l'access token si besoin.

    A utiliser PARTOUT à la place de load_tokens() dès qu'un accessToken
    valide est nécessaire pour parler à l'API cTrader (ensure_connected(),
    list_accounts(), etc. dans ctrader_trading.py).
    """
    tokens = load_tokens()
    if not tokens:
        raise RuntimeError("Aucun token cTrader trouvé - passe par /oauth/login d'abord.")

    if is_token_expired(tokens):
        refresh_access_token()
        tokens = load_tokens()

    return tokens
