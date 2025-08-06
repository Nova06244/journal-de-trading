
import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
import os

SAVE_FILE = "journal_trading.csv"
st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

# Initialisation des données
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

# Formulaire d'ajout de trade
st.subheader("📋 Entrée d'un trade")
with st.form("add_trade_form"):
    col1, col2 = st.columns([2, 2])
    with col1:
        col1a, col1b = st.columns(2)
        with col1a:
            date = st.date_input("Date", value=datetime.now()).strftime("%d/%m/%Y")
        with col1b:
            reward = st.number_input("Reward", min_value=0.0, step=0.01, format="%.2f")

        col1c, col1d = st.columns(2)
        with col1c:
            actif = st.text_input("Actif", value="XAU/USD")
        with col1d:
            resultat = st.selectbox("Résultat", ["TP", "SL", "Breakeven", "Pas de trade"])

        col1e, col1f = st.columns(2)
        with col1e:
            session = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPRR 18h30"])
        with col1f:
            mise = st.number_input("Mise (€)", min_value=0.0, step=10.0, format="%.2f")

    with col2:
        # Génération du camembert dans l'entrée du trade
        df_pie = st.session_state["data"]
        tp_count = (df_pie["Résultat"] == "TP").sum()
        sl_count = (df_pie["Résultat"] == "SL").sum()
        if tp_count + sl_count > 0:
            fig, ax = plt.subplots()
            ax.pie([tp_count, sl_count], labels=["TP", "SL"], colors=["green", "red"], autopct='%1.1f%%', startangle=90)
            ax.axis("equal")
            st.pyplot(fig)
        else:
            st.write("Pas encore de trades TP/SL.")

    submitted = st.form_submit_button("Ajouter le trade")
    if submitted:
        gain = 0.0
        risk = 1.0
        if resultat == "TP":
            gain = mise * reward
        elif resultat == "SL":
            gain = -mise * risk
        elif resultat == "Breakeven":
            gain = mise
        elif resultat == "Pas de trade":
            gain = 0.0

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
        st.session_state["data"] = pd.concat([st.session_state["data"], pd.DataFrame([new_row])], ignore_index=True)
        save_data()
        st.success("✅ Trade ajouté")

# 💰 Mise de départ
st.subheader("💰 Mise de départ ou ajout de capital")
col_cap1, col_cap2 = st.columns([2, 1])
with col_cap1:
    new_cap = st.number_input("Ajouter au capital (€)", min_value=0.0, step=100.0, format="%.2f")
with col_cap2:
    if st.button("Ajouter la mise"):
        st.session_state["capital"] += new_cap
        save_data()
        st.success(f"✅ Nouveau capital : {st.session_state['capital']:.2f} €")
    if st.button("♻️ Réinitialiser la mise de départ"):
        st.session_state["capital"] = 0.0
        save_data()
        st.success("🔁 Mise de départ réinitialisée à 0 €")

st.info(f"💼 Mise de départ actuelle : {st.session_state['capital']:.2f} €")

# 📊 Liste des trades
st.subheader("📊 Liste des trades")
df = st.session_state["data"]
for i in df.index:
    cols = st.columns([1, 1, 1, 1, 1, 1, 1, 1, 0.1])
    result = df.loc[i, "Résultat"]
    color = (
        "green" if result == "TP"
        else "red" if result == "SL"
        else "blue" if result == "Breakeven"
        else "white" if result == "Pas de trade"
        else "black"
    )
    for j, col_name in enumerate(df.columns):
        value = df.loc[i, col_name]
        value = "" if pd.isna(value) else value
        cols[j].markdown(f"<span style='color:{color}'>{value}</span>", unsafe_allow_html=True)
    with cols[-1]:
        if st.button("🗑️", key=f"delete_{i}"):
            st.session_state["data"] = df.drop(i).reset_index(drop=True)
            save_data()
            st.rerun()

# 📈 Statistiques
st.subheader("📈 Statistiques")
df["Risk (%)"] = pd.to_numeric(df["Risk (%)"], errors="coerce").fillna(0)
df["Reward (%)"] = pd.to_numeric(df["Reward (%)"], errors="coerce").fillna(0)

total_tp = (df["Résultat"] == "TP").sum()
total_sl = (df["Résultat"] == "SL").sum()
total_be = (df["Résultat"] == "Breakeven").sum()
total_nd = (df["Résultat"] == "Pas de trade").sum()
total_gain = df["Gain (€)"].sum()
total_risk = df[df["Résultat"] == "SL"]["Risk (%)"].sum()
total_reward = df[df["Résultat"] == "TP"]["Reward (%)"].sum()
winrate = (total_tp / (total_tp + total_sl)) * 100 if (total_tp + total_sl) > 0 else 0

col1, col2, col3, col4 = st.columns(4)
col1.metric("✅ Total TP", total_tp)
col2.metric("❌ Total SL", total_sl)
col3.metric("🔵 Breakeven", total_be)
col4.metric("⬜ Pas de trade", total_nd)

col5, col6, col7, col8 = st.columns(4)
col5.metric("📈 Total Reward", f"{total_reward:.2f}")
col6.metric("📉 Total Risk", f"{total_risk:.2f}")
col7.metric("🏆 Winrate", f"{winrate:.2f}%")
col8.metric("💰 Gain total (€)", f"{total_gain:.2f}")

# 💾 Export / Import
st.subheader("💾 Exporter / Importer")
csv = pd.concat([
    st.session_state["data"],
    pd.DataFrame([{
        "Date": "", "Session": "", "Actif": "__CAPITAL__",
        "Résultat": "", "Mise (€)": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])
], ignore_index=True).to_csv(index=False).encode("utf-8")

st.download_button(
    label="📤 Exporter CSV",
    data=csv,
    file_name="journal_trading.csv",
    mime="text/csv"
)

uploaded_file = st.file_uploader("📥 Importer un fichier CSV", type=["csv"])
if uploaded_file and st.button("✅ Importer"):
    try:
        full_df = pd.read_csv(uploaded_file)
        cap_rows = full_df[full_df["Actif"] == "__CAPITAL__"]
        trade_rows = full_df[full_df["Actif"] != "__CAPITAL__"]
        st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0]) if not cap_rows.empty else 0.0
        st.session_state["data"] = trade_rows
        save_data()
        st.success("✅ Données importées.")
        st.rerun()
    except Exception as e:
        st.error(f"❌ Erreur d'import : {e}")
