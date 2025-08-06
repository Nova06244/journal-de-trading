import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
import os

SAVE_FILE = "journal_trading.csv"

st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

# Chargement ou initialisation
if "data" not in st.session_state:
    if os.path.exists(SAVE_FILE):
        try:
            full_df = pd.read_csv(SAVE_FILE)
            cap_rows = full_df[full_df["Actif"] == "__CAPITAL__"]
            trade_rows = full_df[full_df["Actif"] != "__CAPITAL__"]
            st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0]) if not cap_rows.empty else 0.0
            st.session_state["data"] = trade_rows
        except:
            st.session_state["data"] = pd.DataFrame(columns=[
                "Date", "Session", "Actif", "Résultat", "Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"
            ])
            st.session_state["capital"] = 0.0
    else:
        st.session_state["data"] = pd.DataFrame(columns=[
            "Date", "Session", "Actif", "Résultat", "Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"
        ])
        st.session_state["capital"] = 0.0

def save_data():
    capital_row = pd.DataFrame([{
        "Date": "", "Session": "", "Actif": "__CAPITAL__",
        "Résultat": "", "Mise (€)": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])
    export_df = pd.concat([st.session_state["data"], capital_row], ignore_index=True)
    export_df.to_csv(SAVE_FILE, index=False)

# 🎯 Entrée d’un trade
st.subheader("🎯 Entrée d’un trade")

col1, col2 = st.columns(2)
with col1:
    date = st.date_input("Date", value=datetime.now()).strftime("%d/%m/%Y")
    actif = st.text_input("Actif", value="XAU/USD")
    session = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPRR 18h30"])
with col2:
    reward = st.number_input("Reward (%)", min_value=0.0, step=0.01, format="%.2f")
    resultat = st.selectbox("Résultat", ["TP", "SL", "Breakeven", "Pas de trade"])
    mise = st.number_input("Mise (€)", min_value=0.0, step=1.0, format="%.2f")

# 🥧 Camembert Winrate à droite
df = st.session_state["data"]
total_tp = (df["Résultat"] == "TP").sum()
total_sl = (df["Résultat"] == "SL").sum()
total_trades = total_tp + total_sl
if total_trades > 0:
    fig, ax = plt.subplots()
    ax.pie([total_tp, total_sl], labels=["TP", "SL"], autopct="%1.1f%%", colors=["green", "red"])
    st.pyplot(fig)

if st.button("Ajouter le trade"):
    gain = 0.0
    risk = 1.0  # Risque fixé à 1

    if resultat == "TP":
        gain = mise * reward
    elif resultat == "SL":
        gain = -mise * risk
    elif resultat == "Breakeven":
        gain = mise  # Reporter la mise comme gain
    elif resultat == "Pas de trade":
        gain = 0.0
        mise = 0.0

    new_row = {
        "Date": date,
        "Session": session,
        "Actif": actif,
        "Résultat": resultat,
        "Mise (€)": mise,
        "Risk (%)": risk if resultat == "SL" else 0,
        "Reward (%)": reward if resultat == "TP" else 0,
        "Gain (€)": gain
    }
    st.session_state["data"] = pd.concat([st.session_state["data"], pd.DataFrame([new_row])], ignore_index=True)
    save_data()
    st.success("✅ Trade ajouté")

# 💰 Mise de départ
st.subheader("💰 Mise de départ ou ajout de capital")
new_cap = st.number_input("Ajouter au capital (€)", min_value=0.0, step=10.0, format="%.2f")
if st.button("Ajouter la mise"):
    st.session_state["capital"] += new_cap
    save_data()
    st.success("✅ Nouveau capital : {:.2f} €".format(st.session_state["capital"]))

st.info(f"💼 Mise de départ actuelle : {st.session_state['capital']:.2f} €")

# 📃 Liste des trades
st.subheader("📃 Liste des trades")
for i in st.session_state["data"].index:
    row = st.session_state["data"].loc[i]
    cols = st.columns([1]*9)
    color = (
        "green" if row["Résultat"] == "TP"
        else "red" if row["Résultat"] == "SL"
        else "blue" if row["Résultat"] == "Breakeven"
        else "white"
    )
    for j, col_name in enumerate(st.session_state["data"].columns):
        value = row[col_name]
        value = "" if pd.isna(value) else value
        cols[j].markdown(f"<span style='color:{color}'>{value}</span>", unsafe_allow_html=True)
    with cols[-1]:
        if st.button("🗑️", key=f"delete_{i}"):
            st.session_state["data"] = st.session_state["data"].drop(i).reset_index(drop=True)
            save_data()
            st.rerun()

# 📊 Statistiques
st.subheader("📊 Statistiques")
df = st.session_state["data"]
total_tp = (df["Résultat"] == "TP").sum()
total_sl = (df["Résultat"] == "SL").sum()
total_be = (df["Résultat"] == "Breakeven").sum()
total_no = (df["Résultat"] == "Pas de trade").sum()

total_reward = df[df["Résultat"] == "TP"]["Reward (%)"].sum()
total_risk = df[df["Résultat"] == "SL"]["Risk (%)"].sum()
winrate = (total_tp / (total_tp + total_sl)) * 100 if (total_tp + total_sl) > 0 else 0
total_gain = df["Gain (€)"].sum()

st.write(f"✅ Total TP : {total_tp} | ❌ Total SL : {total_sl} | 🟦 Breakeven : {total_be} | ⬜ Pas de trade : {total_no}")
st.write(f"📈 Total Reward : {total_reward:.2f} | 📉 Total Risk : {total_risk:.2f} | 🏆 Winrate : {winrate:.2f}% | 💰 Gain : {total_gain:.2f} €")

# 💾 Export/Import
st.subheader("📁 Exporter / Importer")
csv = pd.concat([
    st.session_state["data"],
    pd.DataFrame([{
        "Date": "", "Session": "", "Actif": "__CAPITAL__",
        "Résultat": "", "Mise (€)": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])
], ignore_index=True).to_csv(index=False).encode("utf-8")

st.download_button("📤 Exporter (CSV)", data=csv, file_name="journal_trading.csv", mime="text/csv")

uploaded_file = st.file_uploader("📥 Importer un fichier CSV", type=["csv"])
if uploaded_file and st.button("✅ Accepter l'import"):
    try:
        full_df = pd.read_csv(uploaded_file)
        cap_rows = full_df[full_df["Actif"] == "__CAPITAL__"]
        trade_rows = full_df[full_df["Actif"] != "__CAPITAL__"]
        st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0]) if not cap_rows.empty else 0.0
        st.session_state["data"] = trade_rows
        save_data()
        st.success("✅ Données importées avec succès.")
        st.rerun()
    except Exception as e:
        st.error(f"❌ Erreur d'importation : {e}")
