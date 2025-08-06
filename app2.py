import streamlit as st
import pandas as pd
from datetime import datetime
import os

SAVE_FILE = "journal_trading.csv"
st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

if "data" not in st.session_state:
    if os.path.exists(SAVE_FILE):
        try:
            full_df = pd.read_csv(SAVE_FILE)
            cap_rows = full_df[full_df["Actif"] == "__CAPITAL__"]
            trade_rows = full_df[full_df["Actif"] != "__CAPITAL__"]
            st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0]) if not cap_rows.empty else 0.0
            st.session_state["data"] = trade_rows
        except:
            st.session_state["data"] = pd.DataFrame(columns=["Date", "Session", "Actif", "Résultat", "Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"])
            st.session_state["capital"] = 0.0
    else:
        st.session_state["data"] = pd.DataFrame(columns=["Date", "Session", "Actif", "Résultat", "Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"])
        st.session_state["capital"] = 0.0

def save_data():
    capital_row = pd.DataFrame([{
        "Date": "", "Session": "", "Actif": "__CAPITAL__",
        "Résultat": "", "Mise (€)": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])
    export_df = pd.concat([st.session_state["data"], capital_row], ignore_index=True)
    export_df.to_csv(SAVE_FILE, index=False)

st.subheader("📋 Entrée d'un trade")
with st.form("add_trade_form"):
    col1, col2, col3 = st.columns(3)
    with col1:
        date = st.date_input("Date", value=datetime.now()).strftime("%d/%m/%Y")
        session = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPRR 18h30"])
    with col2:
        actif = st.text_input("Actif", value="XAU/USD")
        resultat = st.selectbox("Résultat", ["TP", "SL", "Breakeven", "Pas de trade"])
        mise = st.number_input("Mise (€)", min_value=0.0, step=10.0, format="%.2f")
    with col3:
        risk = 1.0
        st.markdown("**Risk (%) fixé à 1**")
        reward = st.number_input("Reward (%)", min_value=0.0, step=0.01, format="%.2f")
    submitted = st.form_submit_button("Ajouter le trade")
    if submitted:
        gain = 0.0
        if resultat == "TP":
            gain = mise * reward
        elif resultat == "SL":
            gain = -mise * risk
        elif resultat == "Breakeven":
            gain = mise
        new_row = {
            "Date": date,
            "Session": session,
            "Actif": actif,
            "Résultat": resultat,
            "Mise (€)": mise,
            "Risk (%)": risk,
            "Reward (%)": reward,
            "Gain (€)": gain
        }
        st.session_state["data"] = pd.concat([
            st.session_state["data"], pd.DataFrame([new_row])
        ], ignore_index=True)
        save_data()
        st.success("✅ Trade ajouté")
