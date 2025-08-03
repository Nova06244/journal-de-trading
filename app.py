import streamlit as st
import pandas as pd
import os

st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

# Reset du drapeau importé pour éviter les boucles
if "import_done" in st.session_state:
    del st.session_state["import_done"]

SAVE_FILE = "journal_trading.csv"

# Chargement des données et du capital
if "data" not in st.session_state:
    if os.path.exists(SAVE_FILE):
        full_df = pd.read_csv(SAVE_FILE)
        capital_rows = full_df[full_df["Actif"] == "__CAPITAL__"]
        trade_rows = full_df[full_df["Actif"] != "__CAPITAL__"]
        st.session_state["data"] = trade_rows
        if not capital_rows.empty:
            st.session_state["capital"] = float(capital_rows["Gain (€)"].iloc[0])
        else:
            st.session_state["capital"] = 0.0
    else:
        st.session_state["data"] = pd.DataFrame(columns=[
            "Date", "Session", "Actif", "Résultat", "Risk (%)", "Reward (%)", "Gain (€)"
        ])
        st.session_state["capital"] = 0.0

# 📋 Formulaire d'ajout de trade
st.subheader("📋 Entrée d'un trade")
with st.form("add_trade_form"):
    col1, col2, col3 = st.columns(3)
    with col1:
        date = st.date_input("Date", format="DD/MM/YYYY")
        session = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPRR 18h30"])
    with col2:
        actif = st.text_input("Actif", value="EUR/USD")
        resultat = st.selectbox("Résultat", ["TP", "SL"])
    with col3:
        risk = st.number_input("Risk (%)", min_value=0, step=1)
        reward = st.number_input("Reward (%)", min_value=0, step=1)
        gain = st.number_input("Gain (€)", step=0.01, format="%.2f")

    submitted = st.form_submit_button("Ajouter le trade")
    if submitted:
        new_row = {
            "Date": date.strftime("%d/%m/%Y"),
            "Session": session,
            "Actif": actif,
            "Résultat": resultat,
            "Risk (%)": risk,
            "Reward (%)": reward,
            "Gain (€)": gain
        }
        st.session_state["data"] = pd.concat(
            [st.session_state["data"], pd.DataFrame([new_row])],
            ignore_index=True
        )
        st.success("✅ Trade ajouté")

# 💰 Bloc de mise de départ
st.subheader("💰 Mise de départ ou ajout de capital")
new_cap = st.number_input("Ajouter au capital (€)", min_value=0.0, step=100.0, format="%.2f")
if st.button("Ajouter la mise"):
    st.session_state["capital"] += new_cap
    st.success(f"✅ Nouveau capital : {st.session_state['capital']:.2f} €")

# 📊 Liste des trades
st.subheader("📊 Liste des trades")
df = st.session_state["data"]

for i in df.index:
    cols = st.columns([1, 1, 1, 1, 1, 1, 1, 0.07])
    for j, col_name in enumerate(df.columns):
        value = df.loc[i, col_name]
        if df.loc[i, "Résultat"] == "SL" and col_name in ["Risk (%)", "Reward (%)", "Gain (€)"]:
            cols[j].markdown(f"<span style='color:red'>{value}</span>", unsafe_allow_html=True)
        else:
            cols[j].write(value)
    with cols[-1]:
        if st.button("🗑️", key=f"delete_{i}"):
            st.session_state["data"] = df.drop(i).reset_index(drop=True)
            st.rerun()

# 📈 Statistiques
st.subheader("📈 Statistiques")
total_tp = (df["Résultat"] == "TP").sum()
total_sl = (df["Résultat"] == "SL").sum()
total_gain = df["Gain (€)"].sum()
total_risk = df["Risk (%)"].sum()
total_reward = df["Reward (%)"].sum()
winrate = (total_tp / (total_tp + total_sl)) * 100 if (total_tp + total_sl) > 0 else 0
capital_total = st.session_state["capital"] + total_gain

col1, col2, col3 = st.columns(3)
col1.metric("✅ Total TP", total_tp)
col2.metric("❌ Total SL", total_sl)
col3.metric("🏆 Winrate", f"{winrate:.2f}%")

col4, col5, col6 = st.columns(3)
col4.metric("📉 Total Risk (%)", f"{total_risk}")
col5.metric("📈 Total Reward (%)", f"{total_reward}")
col6.metric("💰 Gain total (€)", f"{total_gain:.2f}")

# 💼 Capital + Sauvegarde
col7, col8 = st.columns([1, 1])
with col7:
    st.markdown(f"### 💼 Capital actuel : {st.session_state['capital']:.2f} €")
    st.markdown(f"### 🧮 Capital total : **{capital_total:.2f} €**")

with col8:
    st.markdown("### 💾 Sauvegarde & Sync")
    full_df = st.session_state["data"].copy()
    capital_row = pd.DataFrame([{
        "Date": "", "Session": "", "Actif": "__CAPITAL__",
        "Résultat": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])
    export_df = pd.concat([full_df, capital_row], ignore_index=True)
    csv = export_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="📤 Exporter tout (CSV)",
        data=csv,
        file_name="journal_trading.csv",
        mime="text/csv"
    )
    st.markdown("---")
    uploaded_file = st.file_uploader("📥 Importer CSV", type=["csv"])
    if uploaded_file:
        try:
            full_import = pd.read_csv(uploaded_file)
            cap_rows = full_import[full_import["Actif"] == "__CAPITAL__"]
            trade_rows = full_import[full_import["Actif"] != "__CAPITAL__"]
            if not cap_rows.empty:
                st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0])
            st.session_state["data"] = trade_rows
            st.success("✅ Données et capital importés.")
            if "import_done" not in st.session_state:
                st.session_state["import_done"] = True
                st.rerun()
        except Exception as e:
            st.error(f"❌ Erreur : {e}")
