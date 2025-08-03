import streamlit as st
import pandas as pd

st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

# Initialise la session si vide
if "data" not in st.session_state:
    st.session_state["data"] = pd.DataFrame(columns=[
        "Date", "Session", "Actif", "Résultat", "Risk", "Reward", "Gain"
    ])

# Formulaire d'ajout de trade
with st.form("add_trade_form"):
    col1, col2, col3 = st.columns(3)
    with col1:
        date = st.date_input("Date")
        session = st.selectbox("Session", ["09h", "15h30", "18h30"])
    with col2:
        actif = st.text_input("Actif", value="EUR/USD")
        resultat = st.selectbox("Résultat", ["TP", "SL"])
    with col3:
        risk = st.number_input("Risk (€)", value=0.0, step=0.1)
        reward = st.number_input("Reward (€)", value=0.0, step=0.1)
        gain = st.number_input("Gain (€)", value=0.0, step=0.1)

    submitted = st.form_submit_button("Ajouter")
    if submitted:
        new_row = {
            "Date": date,
            "Session": session,
            "Actif": actif,
            "Résultat": resultat,
            "Risk": risk,
            "Reward": reward,
            "Gain": gain
        }
        st.session_state["data"] = pd.concat([st.session_state["data"], pd.DataFrame([new_row])], ignore_index=True)
        st.success("✅ Trade ajouté !")

# Affichage du tableau
st.subheader("📊 Tableau des trades")
df = st.session_state["data"]

def color_tp_sl(val):
    if val == "TP":
        return "background-color: #b6fcb6"
    elif val == "SL":
        return "background-color: #fcb6b6"
    return ""

st.dataframe(df.style.applymap(color_tp_sl, subset=["Résultat"]), use_container_width=True)

# Statistiques
st.subheader("📈 Statistiques")
total_tp = (df["Résultat"] == "TP").sum()
total_sl = (df["Résultat"] == "SL").sum()
total_gain = df["Gain"].sum()
total_risk = df["Risk"].sum()
total_reward = df["Reward"].sum()
winrate = (total_tp / (total_tp + total_sl)) * 100 if (total_tp + total_sl) > 0 else 0

col1, col2, col3 = st.columns(3)
col1.metric("✅ Total TP", total_tp)
col2.metric("❌ Total SL", total_sl)
col3.metric("🏆 Winrate", f"{winrate:.2f}%")

col4, col5, col6 = st.columns(3)
col4.metric("💰 Total Gain (€)", f"{total_gain:.2f}")
col5.metric("📉 Total Risk (€)", f"{total_risk:.2f}")
col6.metric("📈 Total Reward (€)", f"{total_reward:.2f}")
