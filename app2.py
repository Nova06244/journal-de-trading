import streamlit as st
import pandas as pd

st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

SAVE_FILE = "journal_trading.csv"

# Initialisation
if "data" not in st.session_state:
    st.session_state["data"] = pd.DataFrame(columns=[
        "Date", "Session", "Actif", "Résultat", "Risk (%)", "Reward (%)", "Gain (€)"
    ])
if "capital" not in st.session_state:
    st.session_state["capital"] = 0.0
if "pending_import" not in st.session_state:
    st.session_state["pending_import"] = None

# 📋 Formulaire d'ajout de trade
st.subheader("📋 Entrée d'un trade")
with st.form("add_trade_form"):
    col1, col2, col3 = st.columns(3)
    with col1:
        date = st.date_input("Date").strftime("%d/%m/%Y")
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
            "Date": pd.to_datetime(date).strftime("%d/%m/%Y"),
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

# 💰 Mise de départ placée entre formulaire et liste des trades
st.subheader("💰 Mise de départ ou ajout de capital")
new_cap = st.number_input("Ajouter au capital (€)", min_value=0.0, step=100.0, format="%.2f")
if st.button("Ajouter la mise"):
    st.session_state["capital"] += new_cap
    st.success(f"✅ Nouveau capital : {st.session_state['capital']:.2f} €")

# 📊 Liste des trades
st.subheader("📊 Liste des trades")
df = st.session_state["data"]
for i in df.index:
    cols = st.columns([1, 1, 1, 1, 1, 1, 1, 0.2])
    for j, col_name in enumerate(df.columns):
        value = df.loc[i, col_name]
        if df.loc[i, "Résultat"] == "SL":
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

# 🔄 Sauvegarde et importation
st.markdown("---")
st.subheader("💾 Synchronisation & Importation")

# Sauvegarde
capital_row = pd.DataFrame([{
    "Date": "", "Session": "", "Actif": "__CAPITAL__",
    "Résultat": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
}])
export_df = pd.concat([st.session_state["data"], capital_row], ignore_index=True)
csv = export_df.to_csv(index=False).encode("utf-8")
st.download_button(
    label="📤 Exporter (CSV)",
    data=csv,
    file_name="journal_trading.csv",
    mime="text/csv"
)

# Importation
uploaded_file = st.file_uploader("📥 Sélectionner un fichier CSV à importer", type=["csv"])
if uploaded_file:
    try:
        temp_df = pd.read_csv(uploaded_file)
        st.session_state["pending_import"] = temp_df
        st.info("✅ Fichier prêt. Cliquez sur 'Accepter l'import' pour charger les données.")
    except Exception as e:
        st.error(f"❌ Erreur de lecture du fichier : {e}")

if st.session_state.get("pending_import") is not None and st.button("✅ Accepter l'import"):
    try:
        full_df = st.session_state["pending_import"]
        cap_rows = full_df[full_df["Actif"] == "__CAPITAL__"]
        trade_rows = full_df[full_df["Actif"] != "__CAPITAL__"]
        st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0]) if not cap_rows.empty else 0.0
        st.session_state["data"] = trade_rows
        st.session_state["pending_import"] = None
        st.success("✅ Données et capital importés.")
        st.rerun()
    except Exception as e:
        st.error(f"❌ Erreur d'importation : {e}")
