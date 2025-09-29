import streamlit as st
import pandas as pd
from datetime import datetime
import os

SAVE_FILE = "journal_trading.csv"

st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

# --- Styles (badge blanc pour le setup) ---
st.markdown("""
<style>
.setup-pill { color:#fff; background:#111; border:1px solid #444;
              border-radius:6px; padding:8px 10px; display:inline-block; font-weight:600; }
</style>
""", unsafe_allow_html=True)

# ------------------------------------------------------------
# Constantes & normalisation
# ------------------------------------------------------------
SETUP_FIXED = "PULLBACK dans GOLDEN ZONE avec TENDANCE H1/M30/M5 alignées"

EXPECTED_COLS = [
    "Date", "Session", "Setup",
    "Cassure OPR", "Cassure note",
    "Actif", "Résultat", "Remarque",
    "Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"
]
VALID_RESULTS = ["TP", "SL", "Breakeven", "No Trade"]
ASSETS = ["Gold"]

def normalize_trades_to_iso(df_in: pd.DataFrame) -> pd.DataFrame:
    df = df_in.copy()

    # --- Migration Motif -> Remarque (compat anciens fichiers)
    if "Remarque" not in df.columns:
        df["Remarque"] = ""
    if "Motif" in df.columns:
        # Remplit Remarque à partir de Motif lorsque Remarque est vide
        mask_fill = df["Remarque"].astype(str).str.strip().eq("") & df["Motif"].notna()
        df.loc[mask_fill, "Remarque"] = df.loc[mask_fill, "Motif"].astype(str)

    # S'assure que toutes les colonnes attendues existent
    for c in EXPECTED_COLS:
        if c not in df.columns:
            df[c] = ""

    # Réordonne / limite les colonnes
    df = df[EXPECTED_COLS]

    # Normalisations texte/chiffres/dates
    df["Résultat"] = df["Résultat"].replace({"Pas de trade": "No Trade"}).astype(str).str.strip()
    df["Actif"] = df["Actif"].replace({
        "XAUUSD": "GOLD", "BTCUSD": "BTC", "XAU-USD": "GOLD", "BTC-USD": "BTC"
    }).astype(str).str.strip()

    # Dates → ISO
    dt_iso = pd.to_datetime(df["Date"], format="%Y-%m-%d", errors="coerce")
    mask_fr = dt_iso.isna() & df["Date"].astype(str).str.contains(r"/")
    dt_fr = pd.to_datetime(df.loc[mask_fr, "Date"], format="%d/%m/%Y", errors="coerce")
    dt_iso.loc[mask_fr] = dt_fr
    mask_fr2 = dt_iso.isna() & df["Date"].astype(str).str.contains(r"-")
    dt_fr2 = pd.to_datetime(df.loc[mask_fr2, "Date"], format="%d-%m-%Y", errors="coerce")
    dt_iso.loc[mask_fr2] = dt_fr2
    df["Date"] = dt_iso.dt.strftime("%Y-%m-%d").fillna("")

    # Numériques
    for c in ["Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Texte propre
    for c in ["Setup", "Remarque", "Cassure OPR", "Cassure note"]:
        df[c] = df[c].astype(str).fillna("").str.strip()

    return df.reset_index(drop=True)

def us_fmt(date_iso: str) -> str:
    if not date_iso:
        return ""
    dt = pd.to_datetime(date_iso, format="%Y-%m-%d", errors="coerce")
    return dt.strftime("%m/%d/%Y") if pd.notna(dt) else ""

def save_data():
    df_out = st.session_state["data"].copy()
    dt = pd.to_datetime(df_out["Date"], errors="coerce", format="%Y-%m-%d")
    df_out["Date"] = dt.dt.strftime("%Y-%m-%d").fillna("")
    capital_row = pd.DataFrame([{
        "Date": "", "Session": "", "Setup": "",
        "Cassure OPR": "", "Cassure note": "",
        "Actif": "__CAPITAL__", "Résultat": "", "Remarque": "",
        "Mise (€)": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])
    export_df = pd.concat([df_out, capital_row], ignore_index=True)
    export_df.to_csv(SAVE_FILE, index=False, encoding="utf-8")

# ------------------------------------------------------------
# Chargement initial
# ------------------------------------------------------------
if "data" not in
