import streamlit as st
import pandas as pd
from datetime import datetime
import matplotlib.pyplot as plt
import os

SAVE_FILE = "journal_trading.csv"
st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

# Chargement automatique du fichier si présent
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

# 📋 Formulaire d'ajout de trade
st.subheader("📋 Entrée d'un trade")
with st.form("add_trade_form"):
    col1, col2, col3 = st.columns(3)
    with col1:
        date = st.date_input("Date", value=datetime.now()).strftime("%d/%m/%Y")
        session = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPRR 18h30"])
    with col2:
        actif = st.text_input("Actif", value="EUR/USD")
        resultat = st.selectbox("Résultat", ["TP", "SL"])
        mise = st.number_input("Mise (€)", min_value=0.0, step=10.0, format="%.2f")
    with col3:
        risk = st.number_input("Risk (%)", min_value=0.0, step=0.01, format="%.2f")
        reward = st.number_input("Reward (%)", min_value=0.0, step=0.01, format="%.2f")

    submitted = st.form_submit_button("Ajouter le trade")
    if submitted:
        gain = -mise * risk if resultat == "SL" else mise * reward
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
        st.session_state["data"] = pd.concat(
            [st.session_state["data"], pd.DataFrame([new_row])],
            ignore_index=True
        )
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
    cols = st.columns([1]*len(df.columns) + [0.1])
    result = df.loc[i, "Résultat"]
    color = "green" if result == "TP" else "red"
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
df["Gain (€)"] = pd.to_numeric(df["Gain (€)"], errors="coerce").fillna(0)

total_tp = (df["Résultat"] == "TP").sum()
total_sl = (df["Résultat"] == "SL").sum()
total_gain = df["Gain (€)"].sum()
total_risk = df[df["Résultat"] == "SL"]["Risk (%)"].sum()
total_reward = df[df["Résultat"] == "TP"]["Reward (%)"].sum()
winrate = (total_tp / (total_tp + total_sl)) * 100 if (total_tp + total_sl) > 0 else 0
capital_total = st.session_state["capital"] + total_gain

col1, col2, col3 = st.columns(3)
col1.metric("✅ Total TP", total_tp)
col2.metric("❌ Total SL", total_sl)
col3.metric("🏆 Winrate", f"{winrate:.2f}%")

col4, col5, col6 = st.columns(3)
col4.metric("📉 Total Risk (%)", f"{total_risk:.2f}")
col5.metric("📈 Total Reward (%)", f"{total_reward:.2f}")
col6.metric("💰 Gain total (€)", f"{total_gain:.2f}")

st.success(f"💼 Capital total : {capital_total:.2f} €")

# 📈 Graphe capital cumulé
st.subheader("📈 Graphe Capital cumulé avec session")

if not df.empty:
    df_graph = df.copy()
    df_graph["DateTime"] = pd.to_datetime(df_graph["Date"] + " " + df_graph["Session"].str.extract(r'(\d{1,2}h\d{0,2})')[0].fillna("00h00").str.replace("h", ":"), errors='coerce')
    df_graph = df_graph.sort_values("DateTime")
    df_graph["Cumul"] = df_graph["Gain (€)"].cumsum() + st.session_state["capital"]

    fig, ax = plt.subplots()
    ax.plot(df_graph["DateTime"], df_graph["Cumul"], label="Capital cumulé", marker='o')
    ax.axhline(y=st.session_state["capital"], color='blue', linewidth=2, linestyle='--', label='Mise de départ')
    ax.set_xlabel("Date et Heure")
    ax.set_ylabel("Capital (€)")
    ax.set_title("Évolution du capital")
    ax.legend()
    plt.xticks(rotation=45)
    st.pyplot(fig)

# 📊 Graphe Risk vs Reward
st.subheader("📊 Risk vs Reward")

if not df.empty:
    df_rr = df.copy()
    df_rr["Reward"] = df_rr.apply(lambda x: x["Reward (%)"] if x["Résultat"] == "TP" else 0, axis=1)
    df_rr["Risk"] = df_rr.apply(lambda x: -x["Risk (%)"] if x["Résultat"] == "SL" else 0, axis=1)
    df_rr["Index"] = range(1, len(df_rr)+1)

    fig2, ax2 = plt.subplots()
    ax2.bar(df_rr["Index"], df_rr["Reward"], color='green', label='Reward')
    ax2.bar(df_rr["Index"], df_rr["Risk"], color='red', label='Risk')
    ax2.axhline(0, color='black', linewidth=0.8)
    ax2.set_title("Risk vs Reward par trade")
    ax2.set_xlabel("Trade")
    ax2.set_ylabel("R/R")
    ax2.legend()
    st.pyplot(fig2)

# 💾 Export / Import
st.markdown("---")
st.subheader("💾 Export / Import CSV")
csv = pd.concat([
    st.session_state["data"],
    pd.DataFrame([{
        "Date": "", "Session": "", "Actif": "__CAPITAL__",
        "Résultat": "", "Mise (€)": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])
], ignore_index=True).to_csv(index=False).encode("utf-8")
st.download_button("📤 Exporter le journal", data=csv, file_name="journal_trading.csv", mime="text/csv")

uploaded_file = st.file_uploader("📥 Importer un fichier CSV", type=["csv"])
if uploaded_file and st.button("✅ Accepter l'import"):
    try:
        full_df = pd.read_csv(uploaded_file)
        cap_rows = full_df[full_df["Actif"] == "__CAPITAL__"]
        trade_rows = full_df[full_df["Actif"] != "__CAPITAL__"]
        st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0]) if not cap_rows.empty else 0.0
        st.session_state["data"] = trade_rows
        save_data()
        st.success("✅ Données et capital importés.")
        st.rerun()
    except Exception as e:
        st.error(f"❌ Erreur : {e}")
