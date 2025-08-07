# [...] TOUT LE DÉBUT RESTE INCHANGÉ

# 📆 Bilan annuel
st.subheader("📆 Bilan annuel")

df_filtered = df[df["Actif"] != "__CAPITAL__"].copy()
df_filtered["Date"] = pd.to_datetime(df_filtered["Date"], format="%d/%m/%Y", errors="coerce")
df_valid = df_filtered.dropna(subset=["Date"]).copy()
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

    # ✅ SUPPRESSION DE `expanded=is_current`
    with st.expander(f"📅 {month_names[month]} {selected_year}"):
        col1, col2, col3 = st.columns(3)
        col1.metric("🧾 Trades", nb_trades)
        col2.metric("🏆 Winrate", f"{winrate_month:.2f}%")
        col3.metric("💰 Gain", f"{gain:.2f} €")
