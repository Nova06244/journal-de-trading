import streamlit as st
import pandas as pd
from datetime import datetime
import os

SAVE_FILE = "journal_trading.csv"

st.set_page_config(page_title="Journal de Trading", layout="wide")
st.title("📘 Journal de Trading")

# --- Styles (texte blanc pour le setup + titre Cassure) ---
st.markdown("""
<style>
.setup-pill { color: white; background:#111; border:1px solid #444;
              border-radius:6px; padding:8px 10px; display:inline-block; font-weight:600; }
.cassure-title { color: white; }
</style>
""", unsafe_allow_html=True)

# ------------------------------------------------------------
# Constantes & normalisation
# ------------------------------------------------------------
SETUP_FIXED = "CASSURE OPR M30 + RSI 14 🟢"

EXPECTED_COLS = [
    "Date", "Session", "Setup",
    "Cassure OPR", "Cassure note",
    "Actif", "Résultat", "Motif",
    "Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"
]
VALID_RESULTS = ["TP", "SL", "Breakeven", "No Trade"]
ASSETS = ["NASDAQ", "DAX"]

# Motifs
MOTIF_OPTIONS = ["", "Strategie ✅", "Faux Breakout ❌", "Tranche HORRAIRE Dépassée ⛔️", "ANNONCE Economique 🚫"]

# Menu « Cassure de l’OPR »
CASSURE_MENU = ["", "OPR HIGH", "OPR LOW", "Pas de Cassure"]

def normalize_trades_to_iso(df_in: pd.DataFrame) -> pd.DataFrame:
    """Nettoyage + Date ISO."""
    df = df_in.copy()

    # Colonnes manquantes -> ajout + ordre
    for c in EXPECTED_COLS:
        if c not in df.columns:
            df[c] = ""
    df = df[EXPECTED_COLS]

    # Compat anciens fichiers
    df["Résultat"] = df["Résultat"].replace({"Pas de trade": "No Trade"}).astype(str).str.strip()
    df["Actif"] = df["Actif"].replace({
        "XAUUSD": "GOLD", "BTCUSD": "BTC",
        "XAU-USD": "GOLD", "BTC-USD": "BTC"
    }).astype(str).str.strip()

    # Dates -> ISO
    dt_iso = pd.to_datetime(df["Date"], format="%Y-%m-%d", errors="coerce")
    mask_fr = dt_iso.isna() & df["Date"].astype(str).str.contains(r"/")
    dt_fr = pd.to_datetime(df.loc[mask_fr, "Date"], format="%d/%m/%Y", errors="coerce")
    dt_iso.loc[mask_fr] = dt_fr
    mask_fr2 = dt_iso.isna() & df["Date"].astype(str).str.contains(r"-")
    dt_fr2 = pd.to_datetime(df.loc[mask_fr2, "Date"], format="%d-%m-%Y", errors="coerce")
    dt_iso.loc[mask_fr2] = dt_fr2
    df["Date"] = dt_iso.dt.strftime("%Y-%m-%d").fillna("")

    # Nombres
    for c in ["Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Textes
    for c in ["Setup", "Motif", "Cassure OPR", "Cassure note"]:
        df[c] = df[c].astype(str).fillna("").str.strip()

    # Normalise valeurs du menu de cassure (optionnel)
    df["Cassure OPR"] = df["Cassure OPR"].where(df["Cassure OPR"].isin(CASSURE_MENU), "")

    return df.reset_index(drop=True)

def us_fmt(date_iso: str) -> str:
    if not date_iso:
        return ""
    dt = pd.to_datetime(date_iso, format="%Y-%m-%d", errors="coerce")
    return dt.strftime("%m/%d/%Y") if pd.notna(dt) else ""

def save_data():
    """Écrit le CSV (Date ISO) + ligne CAPITAL."""
    df_out = st.session_state["data"].copy()
    dt = pd.to_datetime(df_out["Date"], errors="coerce", format="%Y-%m-%d")
    df_out["Date"] = dt.dt.strftime("%Y-%m-%d").fillna("")

    capital_row = pd.DataFrame([{
        "Date": "", "Session": "", "Setup": "",
        "Cassure OPR": "", "Cassure note": "",
        "Actif": "__CAPITAL__", "Résultat": "", "Motif": "",
        "Mise (€)": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])

    export_df = pd.concat([df_out, capital_row], ignore_index=True)
    export_df.to_csv(SAVE_FILE, index=False, encoding="utf-8")

# ------------------------------------------------------------
# Chargement initial
# ------------------------------------------------------------
if "data" not in st.session_state:
    if os.path.exists(SAVE_FILE):
        try:
            raw = pd.read_csv(SAVE_FILE, dtype=str).fillna("")
            cap_rows = raw[raw["Actif"] == "__CAPITAL__"]
            trade_rows = raw[raw["Actif"] != "__CAPITAL__"]
            st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0]) if not cap_rows.empty else 0.0
            st.session_state["data"] = normalize_trades_to_iso(trade_rows)
        except Exception:
            st.session_state["data"] = pd.DataFrame(columns=EXPECTED_COLS)
            st.session_state["capital"] = 0.0
    else:
        st.session_state["data"] = pd.DataFrame(columns=EXPECTED_COLS)
        st.session_state["capital"] = 0.0

if "show_edit_form" not in st.session_state:
    st.session_state["show_edit_form"] = False
if "edit_index" not in st.session_state:
    st.session_state["edit_index"] = None
if "edit_row" not in st.session_state:
    st.session_state["edit_row"] = {}

# ------------------------------------------------------------
# 📋 Entrée d'un trade
# ------------------------------------------------------------
st.subheader("📋 Entrée d'un trade")
with st.form("add_trade_form"):
    col1, col2 = st.columns(2)

    with col1:
        date_obj = st.date_input("Date", value=datetime.now())
        date_iso = pd.to_datetime(date_obj).strftime("%Y-%m-%d")
        actif = st.selectbox("Actif", ASSETS, index=0)
        session = st.selectbox("Session", ["OPR 9h", "OPR 15h30", "OPR 18h30"])

        # Type de Setup (affiché en blanc, non modifiable)
        st.markdown(f"<div class='setup-pill'>{SETUP_FIXED}</div>", unsafe_allow_html=True)

        # --- Cassure de l'OPR ---
        st.markdown("<span class='cassure-title'><strong>Cassure de l’OPR</strong></span>", unsafe_allow_html=True)
        c_opr1, c_opr2 = st.columns(2)
        with c_opr1:
            cassure_menu = st.selectbox(" ",
                                        CASSURE_MENU, index=0,
                                        help="Sélectionne OPR HIGH / OPR LOW ou laisse vide.")
        with c_opr2:
            cassure_note = st.text_input(" ", value="", placeholder="Écris un détail / note ici")

    with col2:
        reward = st.number_input("Reward (%)", min_value=0.0, step=0.1, format="%.2f", value=2.50)
        motif_value = st.selectbox("Motif", MOTIF_OPTIONS, index=0)
        resultat = st.selectbox("Résultat", VALID_RESULTS)
        mise = st.number_input("Mise (€)", min_value=0.0, step=10.0, format="%.2f")

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
            "Session": session,
            "Setup": SETUP_FIXED,
            "Cassure OPR": cassure_menu,
            "Cassure note": cassure_note,
            "Actif": actif,
            "Résultat": resultat,
            "Motif": motif_value,
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

# ------------------------------------------------------------
# 💰 Mise de départ
# ------------------------------------------------------------
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

# ------------------------------------------------------------
# 📊 Liste des trades (affichage US)
# ------------------------------------------------------------
st.subheader("📊 Liste des trades")
df = st.session_state["data"]

NUM_COLS = {"Mise (€)", "Risk (%)", "Reward (%)", "Gain (€)"}

for i in df.index:
    result = df.loc[i, "Résultat"]
    color = "green" if result == "TP" else "red" if result == "SL" else "blue" if result == "Breakeven" else "white"

    n_cols = len(df.columns)
    cols = st.columns([1]*n_cols + [1.2])

    for j, col_name in enumerate(df.columns):
        value = df.loc[i, col_name]
        value = "" if pd.isna(value) else value

        if col_name in NUM_COLS:
            num_val = pd.to_numeric(value, errors="coerce")
            if pd.notna(num_val):
                value = f"{num_val:.2f}"

        if col_name == "Date" and value:
            value = us_fmt(value)

        cols[j].markdown(f"<span style='color:{color}'>{value}</span>", unsafe_allow_html=True)

    with cols[-1]:
        c1, c2 = st.columns(2)
        with c1:
            st.button("✏️", key=f"edit_{i}", use_container_width=True)
        with c2:
            st.button("🗑️", key=f"delete_{i}", use_container_width=True)

        if st.session_state.get(f"edit_{i}", False):
            st.session_state["edit_index"] = i
            st.session_state["edit_row"] = df.loc[i].to_dict()
            st.session_state["show_edit_form"] = True
            st.rerun()
        if st.session_state.get(f"delete_{i}", False):
            st.session_state["data"] = df.drop(i).reset_index(drop=True)
            save_data()
            st.rerun()

# ------------------------------------------------------------
# ✏️ Formulaire d'édition
# ------------------------------------------------------------
if st.session_state.get("show_edit_form", False):
    st.subheader("✏️ Modifier le trade")
    row = st.session_state.get("edit_row", {})

    _date_iso = row.get("Date", "")
    _date_val = pd.to_datetime(_date_iso, errors="coerce")
    if pd.isna(_date_val):
        _date_val = datetime.now()

    _actif = str(row.get("Actif", ""))
    _session = str(row.get("Session", "OPR 9h"))
    _reward = float(pd.to_numeric(row.get("Reward (%)", 2.5), errors="coerce") or 2.5)
    _resultat = str(row.get("Résultat", VALID_RESULTS[0]))
    _mise = float(pd.to_numeric(row.get("Mise (€)", 0), errors="coerce") or 0.0)
    _motif_val = str(row.get("Motif", "") or "")
    _cassure_menu = row.get("Cassure OPR", "")
    _cassure_note = row.get("Cassure note", "")

    with st.form("edit_trade_form"):
        col1, col2 = st.columns(2)
        with col1:
            date_obj = st.date_input("Date", value=_date_val)

            _edit_assets = ASSETS if (_actif in ASSETS or _actif == "") else [*ASSETS, _actif]
            actif = st.selectbox("Actif", _edit_assets,
                                 index=_edit_assets.index(_actif) if _actif in _edit_assets else 0)

            session = st.selectbox(
                "Session", ["OPR 9h", "OPR 15h30", "OPR 18h30"],
                index=["OPR 9h", "OPR 15h30", "OPR 18h30"].index(_session) if _session in ["OPR 9h", "OPR 15h30", "OPR 18h30"] else 0
            )

            # Type de Setup (affiché en blanc, non modifiable)
            st.markdown(f"<div class='setup-pill'>{SETUP_FIXED}</div>", unsafe_allow_html=True)

            default_idx = MOTIF_OPTIONS.index(_motif_val) if _motif_val in MOTIF_OPTIONS else 0
            motif_value = st.selectbox("Motif", MOTIF_OPTIONS, index=default_idx)

            # Cassure de l’OPR (menu + note)
            st.markdown("<span class='cassure-title'><strong>Cassure de l’OPR</strong></span>", unsafe_allow_html=True)
            c_opr1, c_opr2 = st.columns(2)
            with c_opr1:
                cassure_menu = st.selectbox(" ", CASSURE_MENU,
                                            index=CASSURE_MENU.index(_cassure_menu) if _cassure_menu in CASSURE_MENU else 0)
            with c_opr2:
                cassure_note = st.text_input(" ", value=_cassure_note, placeholder="Écris un détail / note ici")

            reward = st.number_input("Reward (%)", min_value=0.0, step=0.1, format="%.2f", value=float(_reward))
            resultat = st.selectbox("Résultat", VALID_RESULTS,
                                    index=VALID_RESULTS.index(_resultat) if _resultat in VALID_RESULTS else 0)
            mise = st.number_input("Mise (€)", min_value=0.0, step=10.0, format="%.2f", value=_mise)

        c_save, c_cancel = st.columns([1, 1])
        with c_save:
            submitted_edit = st.form_submit_button("💾 Sauvegarder")
        with c_cancel:
            cancel_edit = st.form_submit_button("❌ Annuler")

        if cancel_edit:
            st.session_state["show_edit_form"] = False
            st.session_state["edit_index"] = None
            st.session_state["edit_row"] = {}
            st.rerun()

        if submitted_edit:
            if resultat == "TP":
                gain = mise * reward
            elif resultat == "SL":
                gain = -mise
            elif resultat == "Breakeven":
                gain = mise
            else:
                gain = 0.0

            st.session_state["data"].iloc[st.session_state["edit_index"]] = {
                "Date": pd.to_datetime(date_obj).strftime("%Y-%m-%d"),
                "Session": session,
                "Setup": SETUP_FIXED,
                "Cassure OPR": cassure_menu,
                "Cassure note": cassure_note,
                "Actif": actif,
                "Résultat": resultat,
                "Motif": motif_value,
                "Mise (€)": mise,
                "Risk (%)": 1.00,
                "Reward (%)": reward,
                "Gain (€)": gain
            }
            save_data()
            st.session_state["show_edit_form"] = False
            st.session_state["edit_index"] = None
            st.session_state["edit_row"] = {}
            st.success("✅ Trade modifié")
            st.rerun()

# ------------------------------------------------------------
# 📈 Statistiques
# ------------------------------------------------------------
st.subheader("📈 Statistiques")
df_stats = st.session_state["data"].copy()
df_stats["Risk (%)"] = pd.to_numeric(df_stats["Risk (%)"], errors="coerce").fillna(0)
df_stats["Reward (%)"] = pd.to_numeric(df_stats["Reward (%)"], errors="coerce").fillna(0)
df_stats["Gain (€)"] = pd.to_numeric(df_stats["Gain (€)"], errors="coerce").fillna(0)

total_tp = (df_stats["Résultat"] == "TP").sum()
total_sl = (df_stats["Résultat"] == "SL").sum()
total_be = (df_stats["Résultat"] == "Breakeven").sum()
total_nt = (df_stats["Résultat"] == "No Trade").sum()
total_gain = df_stats["Gain (€)"].sum()
total_risk = df_stats[df_stats["Résultat"] == "SL"]["Risk (%)"].sum()
total_reward = df_stats[df_stats["Résultat"] == "TP"]["Reward (%)"].sum()
winrate = (total_tp / (total_tp + total_sl)) * 100 if (total_tp + total_sl) > 0 else 0
capital_total = st.session_state["capital"] + total_gain

col1, col2, col3, col4 = st.columns(4)
col1.metric("✅ Total TP", total_tp)
col2.metric("❌ Total SL", total_sl)
col3.metric("🟦 Breakeven", total_be)
col4.metric("⛔️ No Trades", total_nt)

col5, col6, col7, col8 = st.columns(4)
col5.metric("📈 Total Reward", f"{total_reward:.2f}")
col6.metric("📉 Total Risk", f"{total_risk:.2f}")
col7.metric("🏆 Winrate", f"{winrate:.2f}%")
col8.metric("💰 Gain total (€)", f"{total_gain:.2f}")

st.success(f"💼 Capital total (Capital + Gains) : {capital_total:.2f} €")

# ------------------------------------------------------------
# 📆 Bilan annuel
# ------------------------------------------------------------
st.subheader("📆 Bilan annuel")

df_an = st.session_state["data"].copy()
df_an["Date"] = pd.to_datetime(df_an["Date"], format="%Y-%m-%d", errors="coerce")
df_valid = df_an.dropna(subset=["Date"]).copy()
df_valid = df_valid[df_valid["Résultat"].isin(VALID_RESULTS)]

if df_valid.empty:
    st.info("Aucune date valide trouvée pour établir un bilan annuel.")
else:
    df_valid["Year"] = df_valid["Date"].dt.year
    df_valid["Month"] = df_valid["Date"].dt.month

    available_years = sorted(df_valid["Year"].unique(), reverse=True)
    selected_year = st.selectbox("📤 Choisir une année", available_years, index=0)

    df_year = df_valid[df_valid["Year"] == selected_year].copy()
    months_with_trades = (
        df_year.groupby("Month").size().loc[lambda s: s > 0].sort_index().index.tolist()
    )

    month_names = {
        1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin",
        7: "Juillet", 8: "Août", 9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre"
    }

    if not months_with_trades:
        st.info(f"Aucun trade pour {selected_year}.")
    else:
        for month in months_with_trades:
            month_data = df_year[df_year["Month"] == month].copy()
            month_data["Gain (€)"] = pd.to_numeric(month_data["Gain (€)"], errors="coerce").fillna(0)

            tp = (month_data["Résultat"] == "TP").sum()
            sl = (month_data["Résultat"] == "SL").sum()
            be = (month_data["Résultat"] == "Breakeven").sum()
            nt = (month_data["Résultat"] == "No Trade").sum()

            executed_trades = tp + sl + be
            gain = month_data["Gain (€)"].sum()
            winrate_month = (tp / (tp + sl) * 100) if (tp + sl) > 0 else 0.0

            with st.expander(f"📅 {month_names.get(month, str(month))} {selected_year}"):
                c1, c2, c3, c4 = st.columns(4)
                c1.metric("🧾 Trades", int(executed_trades))
                c2.metric("⛔ No Trades", int(nt))
                c3.metric("🏆 Winrate", f"{winrate_month:.2f}%")
                c4.metric("💰 Gain", f"{gain:.2f} €")

# ------------------------------------------------------------
# 💾 Export & Import
# ------------------------------------------------------------
st.markdown("---")
st.subheader("💾 Exporter / Importer manuellement")

csv = pd.concat([
    st.session_state["data"].copy(),
    pd.DataFrame([{
        "Date": "", "Session": "", "Setup": "",
        "Cassure OPR": "", "Cassure note": "",
        "Actif": "__CAPITAL__", "Résultat": "", "Motif": "",
        "Mise (€)": "", "Risk (%)": "", "Reward (%)": "", "Gain (€)": st.session_state["capital"]
    }])
], ignore_index=True)

dt = pd.to_datetime(csv["Date"], errors="coerce", format="%Y-%m-%d")
csv["Date"] = dt.dt.strftime("%Y-%m-%d").fillna("")
csv_bytes = csv.to_csv(index=False).encode("utf-8")

st.download_button(
    label="📤 Exporter tout (CSV)",
    data=csv_bytes,
    file_name="journal_trading.csv",
    mime="text/csv"
)

uploaded_file = st.file_uploader("📥 Importer un fichier CSV", type=["csv"])
if uploaded_file and st.button("✅ Accepter l'import"):
    try:
        full_df = pd.read_csv(uploaded_file, dtype=str).fillna("")
        cap_rows = full_df[full_df["Actif"] == "__CAPITAL__"]
        trade_rows = full_df[full_df["Actif"] != "__CAPITAL__"]
        st.session_state["capital"] = float(cap_rows["Gain (€)"].iloc[0]) if not cap_rows.empty else 0.0
        st.session_state["data"] = normalize_trades_to_iso(trade_rows)
        save_data()
        st.success("✅ Données et capital importés.")
        st.rerun()
    except Exception as e:
        st.error(f"❌ Erreur d'importation : {e}")
