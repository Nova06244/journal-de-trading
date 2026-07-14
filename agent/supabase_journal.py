"""
Module de journalisation automatique des trades dans Supabase.
Utilise le client officiel : pip install supabase

Variables d'environnement requises (à définir sur Railway) :
    SUPABASE_URL
    SUPABASE_KEY   -> clé "service_role" recommandée (écriture serveur, pas anon)
"""
import os
from datetime import datetime, timezone
from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

_supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def log_trade_entry(
    symbol: str,
    direction: str,          # "LONG" ou "SHORT"
    entry_price: float,
    sl_price: float,
    tp_price: float,
    sl_points: float,
    tp_points: float,
    volume: float,
    risk_percent: float,
    account_balance_before: float,
    source: str = "auto",
) -> int:
    """
    Insère une nouvelle ligne au moment de l'entrée en position.
    Retourne l'id de la ligne créée, pour pouvoir la mettre à jour ensuite
    (passage à BE, clôture).
    """
    row = {
        "symbol": symbol,
        "direction": direction,
        "source": source,
        "entry_time": datetime.now(timezone.utc).isoformat(),
        "entry_price": entry_price,
        "sl_price": sl_price,
        "tp_price": tp_price,
        "sl_points": sl_points,
        "tp_points": tp_points,
        "volume": volume,
        "risk_percent": risk_percent,
        "account_balance_before": account_balance_before,
        "status": "OPEN",
    }
    result = _supabase.table("trades").insert(row).execute()
    return result.data[0]["id"]


def log_be_triggered(trade_id: int) -> None:
    """A appeler quand le SL est déplacé au prix d'entrée (BE après 15 min)."""
    _supabase.table("trades").update({
        "be_triggered": True,
        "be_time": datetime.now(timezone.utc).isoformat(),
    }).eq("id", trade_id).execute()


def log_trade_exit(
    trade_id: int,
    status: str,          # "CLOSED_TP", "CLOSED_SL", "CLOSED_BE", "CLOSED_MANUAL"
    exit_price: float,
    pnl: float,
) -> None:
    """A appeler à la clôture du trade (TP, SL, ou BE touché)."""
    _supabase.table("trades").update({
        "status": status,
        "exit_time": datetime.now(timezone.utc).isoformat(),
        "exit_price": exit_price,
        "pnl": pnl,
    }).eq("id", trade_id).execute()
