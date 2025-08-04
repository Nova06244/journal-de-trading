import streamlit as st
import pandas as pd
import os
import json

st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

SAVE_FILE = "journal_trading.csv"
LOCAL_FILE = "local_state.json"

# Chargement local si existant
if os.path.exists(LOCAL_FILE):
    with open(LOCAL_FILE, "r") as f:
        saved = json.load(f)
        st.session_state["capital"] = saved.get("capital", 0.0)
        st.session_state["data"] = pd.DataFrame.from_dict(saved.get("data", {}))

# Initialisation
if "data" not in st.session_state:
    st.session_state["data"] = pd.DataFrame(columns=[
        "Date", "Session", "Actif", "Résultat", "Risk (%)", "Reward (%)", "Mise (€)", "Gain (€)"
    ])
if "capital" not in st.session_state:
    st.session_state["capital"] = 0.0

# --- Formulaire d’ajout de trade ---
st.subheader("📋 Entrée d’un trade")
with st.form("form_trade"):
    col1, col2, col3 = st.columns(3)
    with col1:
        date = st.date_input("Date", format="DD/MM/YYYY")
        session = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPRR 18h30"])
    with col2:
        actif = st.text_input("Actif", "EUR/USD")
        resultat = st.selectbox("Résultat", ["TP", "SL"])
    with col3:
        risk = st.number_input("Risk (%)", min_value=0.0, step=0.01, format="%.2f")
        reward = st.number_input("Reward (%)", min_value=0.0, step=0.01, format="%.2f")
        mise = st.number_input("Mise (€)", min_value=0.0, step=10.0, format="%.2f")

    submitted = st.form_submit_button("Ajouter le trade")
    if submitted:
        gain = mise * reward / 100 if resultat == "TP" else - mise * risk / 100
        new_row = {
            "Date": date.strftime("%d/%m/%Y"),
            "Session": session,
            "Actif": actif,
            "Résultat": resultat,
            "Risk (%)": round(risk, 2),
            "Reward (%)": round(reward, 2),
            "Mise (€)": mise,
            "Gain (€)": round(gain, 2)
        }
        st.session_state["data"] = pd.concat(
            [st.session_state["data"], pd.DataFrame([new_row])],
            ignore_index=True
        )
        st.success("✅ Trade ajouté.")

# --- Mise de départ ---
st.subheader("💰 Mise de départ ou ajout de capital")
cap1, cap2 = st.columns([3, 1])
with cap1:
    capital_input = st.number_input("Ajouter au capital (€)", min_value=0.0, step=100.0, format="%.2f")
with cap2:
    if st.button("Ajouter"):
        st.session_state["capital"] += capital_input
        st.success("✅ Capital ajouté.")

if st.button("🔁 Réinitialiser la mise de départ"):
    st.session_state["capital"] = 0.0
    st.success("✅ Mise réinitialisée.")

st.markdown(f"💼 **Capital actuel : {st.session_state['capital']:.2f} €**")

# --- Liste des trades ---
st.subheader("📊 Liste des trades")
df = st.session_state["data"]

for i in df.index:
    cols = st.columns([1, 1, 1, 1, 1, 1, 1, 1, 0.1])
    couleur = "green" if df.loc[i, "Résultat"] == "TP" else "red" if df.loc[i, "Résultat"] == "SL" else "black"
    for j, col in enumerate(df.columns):
        val = df.loc[i, col]
        cols[j].markdown(f"<span style='color:{couleur}'>{val}</span>", unsafe_allow_html=True)
    with cols[-1]:
        if st.button("🗑️", key=f"del_{i}"):
            st.session_state["data"] = df.drop(i).reset_index(drop=True)
            st.rerun()

# --- Statistiques ---
st.subheader("📈 Statistiques")
tp = (df["Résultat"] == "TP").sum()
sl = (df["Résultat"] == "SL").sum()
gain_total = df["Gain (€)"].sum()
winrate = (tp / (tp + sl)) * 100 if tp + sl > 0 else 0
capital_total = st.session_state["capital"] + gain_total

col1, col2, col3 = st.columns(3)
col1.metric("✅ TP", tp)
col2.metric("❌ SL", sl)
col3.metric("🏆 Winrate", f"{winrate:.2f}%")

st.markdown(f"### 🧮 Capital total : **{capital_total:.2f} €**")

# --- Sauvegarde CSV ---
st.subheader("💾 Sauvegarde & Importation")
# Ajout capital dans le CSV
capital_row = pd.DataFrame([{
    "Date": "", "Session": "", "Actif": "__CAPITAL__",
    "Résultat": "", "Risk (%)": "", "Reward (%)": "", "Mise (€)": "", "Gain (€)": st.session_state["capital"]
}])
export_df = pd.concat([df, capital_row], ignore_index=True)
csv = export_df.to_csv(index=False).encode("utf-8")

st.download_button("📤 Exporter (CSV)", data=csv, file_name=SAVE_FILE, mime="text/csv")

# Import CSV
uploaded = st.file_uploader("📥 Importer un fichier CSV", type=["csv"])
if uploaded and st.button("✅ Appliquer l'import"):
    try:
        full = pd.read_csv(uploaded)
        cap = full[full["Actif"] == "__CAPITAL__"]
        trades = full[full["Actif"] != "__CAPITAL__"]
        st.session_state["data"] = trades
        st.session_state["capital"] = float(cap["Gain (€)"].iloc[0]) if not cap.empty else 0.0
        st.success("✅ Données importées.")
        st.rerun()
    except Exception as e:
        st.error(f"❌ Erreur : {e}")

# --- Sauvegarde automatique locale ---
with open(LOCAL_FILE, "w") as f:
    json.dump({
        "capital": st.session_state["capital"],
        "data": st.session_state["data"].to_dict()
    }, f)
