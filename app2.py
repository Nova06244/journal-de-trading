import streamlit as st
import pandas as pd
from datetime import datetime
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

# 📋 Entrée d'un trade
st.subheader("📋 Entrée d'un trade")
with st.form("add_trade_form"):
    col1, col2 = st.columns(2)
    with col1:
        date = st.date_input("📅 Date du trade (jj/mm/aaaa)", value=datetime.now()).strftime("%d/%m/%Y")
        actif = st.text_input("Actif", value="XAU-USD")
        session = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPRR 18h30"])
    with col2:
        reward = st.number_input("Reward (%)", min_value=0.0, step=0.01, format="%.2f")
        resultat = st.selectbox("Résultat", ["TP", "SL", "Breakeven", "Pas de trade"])
        mise = st.number_input("Mise (€)", min_value=0.0, step=10.0, format="%.2f")

    submitted = st.form_submit_button("Ajouter le trade")
    if submitted:
        if resultat == "TP":
            gain = mise * reward
        elif resultat == "SL":
            gain = -mise
        elif resultat == "Breakeven":
            gain = 0.0
        else:
            gain = 0.0

        new_row = {
            "Date": date,
            "Session": session,
            "Actif": actif,
            "Résultat": resultat,
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
    result = df.loc[i, "Résultat"]
    color = "green" if result == "TP" else "red" if result == "SL" else "blue" if result == "Breakeven" else "white"
    cols = st.columns([1, 1, 1, 1, 1, 1, 1, 1, 0.1])
    for j, col_name in enumerate(df.columns):
        value = df.loc[i, col_name]
        value = "" if pd.isna(value) else value
        cols[j].markdown(f"<span style='color:{color}'>{value}</span>", unsafe_allow_html=True)
    with cols[-1]:
        if st.button("🗑️", key=f"delete_{i}"):
            st.session_state["data"] = df.drop(i).reset_index(drop=True)
            save_data()
            st.rerun()

# 📈 Statistiques globales
st.subheader("📈 Statistiques")
df["Risk (%)"] = pd.to_numeric(df["Risk (%)"], errors="coerce").fillna(0)
df["Reward (%)"] = pd.to_numeric(df["Reward (%)"], errors="coerce").fillna(0)

total_tp = (df["Résultat"] == "TP").sum()
total_sl = (df["Résultat"] == "SL").sum()
total_be = (df["Résultat"] == "Breakeven").sum()
total_nt = (df["Résultat"] == "Pas de trade").sum()
total_gain = df["Gain (€)"].sum()
total_risk = df[df["Résultat"] == "SL"]["Risk (%)"].sum()
total_reward = df[df["Résultat"] == "TP"]["Reward (%)"].sum()
winrate = (total_tp / (total_tp + total_sl)) * 100 if (total_tp + total_sl) > 0 else 0
capital_total = st.session_state["capital"] + total_gain

col1, col2, col3, col4 = st.columns(4)
col1.metric("✅ Total TP", total_tp)
col2.metric("❌ Total SL", total_sl)
col3.metric("🟦 Breakeven", total_be)
col4.metric("⚪ Pas de trade", total_nt)

col5, col6, col7, col8 = st.columns(4)
col5.metric("📈 Total Reward", f"{total_reward:.2f}")
col6.metric("📉 Total Risk", f"{total_risk:.2f}")
col7.metric("🏆 Winrate", f"{winrate:.2f}%")
col8.metric("💰 Gain total (€)", f"{total_gain:.2f}")

st.success(f"💼 Capital total (Capital + Gains) : {capital_total:.2f} €")

# 📅 Bilan annuel par mois sélectionnable
st.subheader("📆 Bilan annuel")

df["Date"] = pd.to_datetime(df["Date"], format="%d/%m/%Y", errors="coerce")
df_valid = df.dropna(subset=["Date"]).copy()
df_valid["Year"] = df_valid["Date"].dt.year
df_valid["Month"] = df_valid["Date"].dt.month
df_valid["MonthName"] = df_valid["Date"].dt.strftime("%B")

available_years = sorted(df_valid["Year"].dropna().unique(), reverse=True)
selected_year = st.selectbox("📤 Choisir une année", available_years)

df_year = df_valid[df_valid["Year"] == selected_year]
months_in_year = df_year["Month"].unique()
months_in_year.sort()

month_names = {
    1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin",
    7: "Juillet", 8: "Août", 9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre"
}

for month in months_in_year:
    month_data = df_year[df_year["Month"] == month]
    nb_trades = month_data[month_data["Résultat"].isin(["TP", "SL", "Breakeven", "Pas de trade"])].shape[0]
    tp = (month_data["Résultat"] == "TP").sum()
    sl = (month_data["Résultat"] == "SL").sum()
    gain = month_data["Gain (€)"].sum()
    winrate_month = (tp / (tp + sl)) * 100 if (tp + sl) > 0 else 0

    with st.expander(f"📅 {month_names[month]} {selected_year}"):
        col1, col2, col3 = st.columns(3)
        col1.metric("🧾 Trades", nb_trades)
        col2.metric("🏆 Winrate", f"{winrate_month:.2f}%")
        col3.metric("💰 Gain", f"{gain:.2f} €")

# 💾 Export & Import
st.markdown("---")
st.subheader("💾 Exporter / Importer manuellement")
csv = pd.concat([
    st.session_state["data"],
    pd.DataFrame([{
        "Date": "", "Session": "", "Actif": "__CAPITAL__",
        "Résultat": "", "Mise (€)": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])
], ignore_index=True).to_csv(index=False).encode("utf-8")
st.download_button(
    label="📤 Exporter tout (CSV)",
    data=csv,
    file_name="journal_trading.csv",
    mime="text/csv"
)

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
        st.error(f"❌ Erreur d'importation : {e}")
