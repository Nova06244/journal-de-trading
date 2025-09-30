# ------------------------------------------------------------
# 📋 Entrée d'un trade
# ------------------------------------------------------------
st.subheader("📋 Entrée d'un trade")

# --- Session réactive (en dehors du form) ---
session_choice = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPR 18h30"], key="session_add_top")

# Créneaux dynamiques liés à la session sélectionnée
time_opts_live = (lambda s: generate_time_slots(*SESSION_TIME_WINDOWS[s], step_minutes=5))(session_choice)

with st.form("add_trade_form"):
    col1, col2 = st.columns(2)

    with col1:
        date_obj = st.date_input("Date", value=datetime.now())
        date_iso = pd.to_datetime(date_obj).strftime("%Y-%m-%d")
        actif = st.selectbox("Actif", ASSETS, index=0)

        # On montre la session choisie au-dessus, inutile de refaire un select ici
        st.markdown(f"**Session sélectionnée :** {session_choice}")

        # --- Cassure (menu + heure dépendant de la session réactive) ---
        c_col1, c_col2 = st.columns(2)
        with c_col1:
            cassure_choice = st.selectbox("Cassure", CASSURE_OPTIONS, index=0, key="cassure_add")
        with c_col2:
            heure_cassure = st.selectbox("Heure de cassure", options=time_opts_live, index=0, key="heure_add")

        # --- Type de Setup (badge fixe) ---
        st.subheader("📌 Type de Setup")
        st.markdown(f"<div class='setup-pill'>{SETUP_FIXED}</div>", unsafe_allow_html=True)

    with col2:
        reward = st.number_input("Reward (%)", min_value=0.0, step=0.1, format="%.2f", value=3.00)
        observation = st.text_area("Observation", value="", placeholder="Note libre sur le trade…")
        resultat = st.selectbox("Résultat", VALID_RESULTS, key="result_add")
        mise = st.number_input("Mise (€)", min_value=0.0, step=10.0, format="%.2f", key="mise_add")

    submitted = st.form_submit_button("Ajouter le trade")
    if submitted:
        if resultat == "TP":
            gain = mise * reward
        elif resultat == "SL":
            gain = -mise
        elif resultat == "Breakeven":
            gain = mise
        else:
            gain = 0.0

        new_row = {
            "Date": date_iso,
            "Session": session_choice,            # <= on utilise la session externe
            "Setup": SETUP_FIXED,
            "Cassure OPR": cassure_choice,
            "Heure cassure": heure_cassure,       # <= créneau 5 min selon session
            "Cassure note": "",
            "Actif": actif,
            "Résultat": resultat,
            "Observation": observation,
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
