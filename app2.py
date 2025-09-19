import streamlit as st
import pandas as pd
from datetime import datetime
import os

SAVE_FILE = "journal_trading.csv"

st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

# ------------------------------------------------------------
# Constantes & normalisation
# ------------------------------------------------------------
PHRASES_NO_TRADE = [
    "Cassure de l’OPR, mais pas de PULLBACK dans FIBONACCI",
    "VWAP trop proche de l’OPR, pas de marge exploitable",
    "MOMENTUM respecté, mais le prix est parti à contre TENDANCE",
    "EGT",
    "Communiquer plus haut"
]

EXPECTED_COLS = ["Date", "Session", "Setup", "Actif", "Résultat", "Motif",
                 "Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"]
VALID_RESULTS = ["TP", "SL", "Breakeven", "No Trade"]
ASSETS = ["GOLD", "NASDAQ", "S&P500", "DAX", "WTI", "BTC"]
SETUP_TYPES = ["", "REVERSAL", "CONTINUATION"]  # menu vide par défaut

def normalize_trades_to_iso(df_in: pd.DataFrame) -> pd.DataFrame:
    df = df_in.copy()
    for c in EXPECTED_COLS:
        if c not in df.columns:
            df[c] = ""
    df = df[EXPECTED_COLS]

    df["Résultat"] = df["Résultat"].replace({"Pas de trade": "No Trade"}).astype(str).str.strip()
    df["Actif"] = df["Actif"].replace({
        "XAUUSD": "GOLD", "BTCUSD": "BTC",
        "XAU-USD": "GOLD", "BTC-USD": "BTC"
    }).astype(str).str.strip()

    dt_iso = pd.to_datetime(df["Date"], format="%Y-%m-%d", errors="coerce")
    mask_fr = dt_iso.isna() & df["Date"].astype(str).str.contains(r"/")
    dt_fr = pd.to_datetime(df.loc[mask_fr, "Date"], format="%d/%m/%Y", errors="coerce")
    dt_iso.loc[mask_fr] = dt_fr
    mask_fr2 = dt_iso.isna() & df["Date"].astype(str).str.contains(r"-")
    dt_fr2 = pd.to_datetime(df.loc[mask_fr2, "Date"], format="%d-%m-%Y", errors="coerce")
    dt_iso.loc[mask_fr2] = dt_fr2
    df["Date"] = dt_iso.dt.strftime("%Y-%m-%d").fillna("")

    for c in ["Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    df["Motif"] = df["Motif"].astype(str).fillna("").str.strip()
    df["Setup"] = df["Setup"].astype(str).fillna("").str.strip()

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
        "Date": "", "Session": "", "Setup": "", "Actif": "__CAPITAL__",
        "Résultat": "", "Motif": "", "Mise (€)": "", "Risk (%)": "", "Reward (%)": "",
        "Gain (€)": st.session_state["capital"]
    }])

    export_df = pd.concat([df_out, capital_row], ignore_index=True)
    export_df.to_csv(SAVE_FILE, index=False, encoding="utf-8")

# ------------------------------------------------------------
# Chargement initial
# ------------------------------------------------------------
if "data" not in st.session_state:
    if os.path.exists(SAVE_FILE):
        try:
            raw = pd.read_csv(SAVE_FILE, dtype=str).fillna("")
            cap_rows = raw[raw["Actif"] == "__CAPITAL__"]
            trade_rows = raw[raw["Actif"] != "__CAPITAL__"]
            st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0]) if not cap_rows.empty else 0.0
            st.session_state["data"] = normalize_trades_to_iso(trade_rows)
        except Exception:
            st.session_state["data"] = pd.DataFrame(columns=EXPECTED_COLS)
            st.session_state["capital"] = 0.0
    else:
        st.session_state["data"] = pd.DataFrame(columns=EXPECTED_COLS)
        st.session_state["capital"] = 0.0

if "show_edit_form" not in st.session_state:
    st.session_state["show_edit_form"] = False
if "edit_index" not in st.session_state:
    st.session_state["edit_index"] = None
if "edit_row" not in st.session_state:
    st.session_state["edit_row"] = {}

# ------------------------------------------------------------
# 📋 Entrée d'un trade
# ------------------------------------------------------------
st.subheader("📋 Entrée d'un trade")
with st.form("add_trade_form"):
    col1, col2 = st.columns(2)

    with col1:
        date_obj = st.date_input("Date", value=datetime.now())
        date_iso = pd.to_datetime(date_obj).strftime("%Y-%m-%d")
        actif = st.selectbox("Actif", ASSETS, index=0)
        session = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPR 18h30"])
        setup = st.selectbox("Type de Setup", SETUP_TYPES, index=0)  # <-- nouveau menu

    with col2:
        reward = st.number_input("Reward (%)", min_value=0.0, step=1.0,
                                 format="%.0f", value=3.0)
        resultat = st.selectbox("Résultat", VALID_RESULTS)
        motif_options = [""] + PHRASES_NO_TRADE
        motif = st.selectbox("Motif (optionnel)", motif_options, index=0, key="motif_any")
        mise = st.number_input("Mise (€)", min_value=0.0, step=10.0, format="%.2f")

    submitted = st.form_submit_button("Ajouter le trade")
    if submitted:
        if resultat == "TP":
            gain = mise * reward
        elif resultat == "SL":
            gain = -mise
        elif resultat == "Breakeven":
            gain = mise
        else:
            gain = 0.0

        new_row = {
            "Date": date_iso,
            "Session": session,
            "Setup": setup,
            "Actif": actif,
            "Résultat": resultat,
            "Motif": motif,
            "Mise (€)": mise,
            "Risk (%)": 1.00,
            "Reward (%)": reward,
            "Gain (€)": gain
        }
        st.session_state["data"] = pd.concat(
            [st.session_state["data"], pd.DataFrame([new_row])],
            ignore_index=True
        )
        save_data()
        st.success("✅ Trade ajouté")

# ------------------------------------------------------------
# (Les autres parties du script restent inchangées : affichage, édition, stats, export…)
# ------------------------------------------------------------
