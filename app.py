import streamlit as st
import pandas as pd

st.set_page_config(page_title="Journal de Trading", layout="wide")

st.title("📘 Journal de Trading")

# Initialisation
if "data" not in st.session_state:
    st.session_state["data"] = pd.DataFrame(columns=[
        "Date", "Session", "Actif", "Résultat", "Risk (%)", "Reward (%)", "Gain (€)"
    ])

if "capital" not in st.session_state:
    st.session_state["capital"] = 0.00

# Onglets
tab1, tab2 = st.tabs(["📈 Journal", "💰 Mise de départ"])

# Onglet Capital
with tab2:
    st.subheader("💰 Mise de départ ou ajout de capital")
    new_cap = st.number_input("Montant (€)", min_value=0.0, step=100.0, format="%.2f")
    if st.button("Ajouter au capital"):
        st.session_state["capital"] += new_cap
        st.success(f"✅ Nouveau capital : {st.session_state['capital']:.2f} €")

# Onglet Journal
with tab1:
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
                "Date": date.strftime("%d/%m/%Y"),  # <-- format personnalisé
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

    # Tableau avec bouton à droite
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
                st.experimental_rerun()

    # Statistiques
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

    st.markdown(f"### 💼 Capital actuel : {st.session_state['capital']:.2f} €")
    st.markdown(f"### 🧮 Capital total : **{capital_total:.2f} €**")
