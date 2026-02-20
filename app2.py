import streamlit as st
import pandas as pd
import os
from datetime import date, datetime
import plotly.express as px
import plotly.graph_objects as go

# ─────────────────────────────────────────

# CONFIG

# ─────────────────────────────────────────

st.set_page_config(
page_title=“Daily Cycle Journal — EUR/USD”,
page_icon=“📈”,
layout=“wide”,
initial_sidebar_state=“collapsed”
)

CSV_FILE = “trades.csv”
COLUMNS = [“id”,“date”,“heure”,“biais”,“session”,“direction”,
“entree”,“sl”,“tp”,“rr”,“pl”,“outcome”,“rules”,“raison”,“lecon”]

# ─────────────────────────────────────────

# CSS

# ─────────────────────────────────────────

st.markdown(”””

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');

html, body, [class*="css"] {
    font-family: 'DM Mono', monospace;
    background-color: #080c10;
    color: #c8d8e8;
}

.main { background-color: #080c10; }

h1, h2, h3 {
    font-family: 'Syne', sans-serif !important;
    color: #ffffff !important;
}

.stButton > button {
    background-color: #00d4ff;
    color: #000000;
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    border: none;
    border-radius: 6px;
    padding: 10px 24px;
    width: 100%;
}

.stButton > button:hover {
    background-color: #00eaff;
    color: #000;
}

.stTextInput > div > div > input,
.stNumberInput > div > div > input,
.stSelectbox > div > div,
.stTextArea > div > div > textarea,
.stTimeInput > div > div > input {
    background-color: #131920 !important;
    color: #c8d8e8 !important;
    border: 1px solid #253040 !important;
    border-radius: 6px !important;
    font-family: 'DM Mono', monospace !important;
}

.stDateInput > div > div > input {
    background-color: #131920 !important;
    color: #c8d8e8 !important;
    border: 1px solid #253040 !important;
}

.metric-card {
    background: #0d1117;
    border: 1px solid #1e2830;
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 10px;
}

.metric-value {
    font-family: 'Syne', sans-serif;
    font-size: 28px;
    font-weight: 800;
    line-height: 1.1;
}

.metric-label {
    font-size: 10px;
    color: #4a6070;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 6px;
}

.metric-sub {
    font-size: 11px;
    color: #4a6070;
    margin-top: 4px;
}

.trade-card {
    background: #0d1117;
    border: 1px solid #1e2830;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 10px;
}

.badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    margin-right: 4px;
}

.info-box {
    background: rgba(0,212,255,0.06);
    border: 1px solid rgba(0,212,255,0.2);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 12px;
    color: #00d4ff;
    margin-bottom: 16px;
    line-height: 1.7;
}

.insight-box {
    background: #131920;
    border-left: 3px solid #00d4ff;
    border-radius: 6px;
    padding: 12px 16px;
    font-size: 13px;
    line-height: 1.7;
    margin-bottom: 16px;
}

.green { color: #00e5a0; }
.red { color: #ff4060; }
.accent { color: #00d4ff; }
.muted { color: #4a6070; }
.yellow { color: #ffd060; }

div[data-testid="stHorizontalBlock"] {
    gap: 10px;
}

.stRadio > div {
    background: #131920;
    border: 1px solid #253040;
    border-radius: 6px;
    padding: 8px 12px;
}

footer { display: none; }
#MainMenu { display: none; }
header { display: none; }
</style>

“””, unsafe_allow_html=True)

# ─────────────────────────────────────────

# DATA

# ─────────────────────────────────────────

def load_trades():
if os.path.exists(CSV_FILE):
df = pd.read_csv(CSV_FILE)
for col in COLUMNS:
if col not in df.columns:
df[col] = “”
return df
return pd.DataFrame(columns=COLUMNS)

def save_trades(df):
df.to_csv(CSV_FILE, index=False)

def calc_rr(entree, sl, tp):
try:
e, s, t = float(entree), float(sl), float(tp)
risk = abs(e - s)
reward = abs(t - e)
if risk == 0:
return None
return round(reward / risk, 2)
except:
return None

# ─────────────────────────────────────────

# HEADER

# ─────────────────────────────────────────

df = load_trades()
n = len(df)
wins = len(df[df[“outcome”] == “Win”]) if n else 0
losses = len(df[df[“outcome”] == “Loss”]) if n else 0
bes = len(df[df[“outcome”] == “BE”]) if n else 0
wr = round(wins / n * 100) if n else None
total_pl = df[“pl”].astype(float).sum() if n else 0

st.markdown(”””

<div style='padding: 20px 0 10px 0;'>
    <span style='font-family: Syne, sans-serif; font-size: 28px; font-weight: 800; color: #fff;'>
        Daily<span style='color:#00d4ff'>Cycle</span> Journal
    </span><br>
    <span style='font-size: 11px; color: #4a6070; letter-spacing: 2px; text-transform: uppercase;'>
        EUR/USD · IC Markets · Christophe Meoni
    </span>
</div>
""", unsafe_allow_html=True)

# Header KPIs

col1, col2, col3, col4 = st.columns(4)
with col1:
st.markdown(f”””<div class='metric-card'>
<div class='metric-label'>Trades totaux</div>
<div class='metric-value accent'>{n}</div>
</div>”””, unsafe_allow_html=True)

with col2:
wr_color = “green” if wr and wr >= 50 else “red” if wr else “accent”
st.markdown(f”””<div class='metric-card'>
<div class='metric-label'>Win Rate</div>
<div class='metric-value {wr_color}'>{wr}%</div>
<div class='metric-sub'>{wins}W · {losses}L · {bes}BE</div>
</div>”””, unsafe_allow_html=True)

with col3:
pl_color = “green” if total_pl > 0 else “red” if total_pl < 0 else “accent”
pl_str = f”+{total_pl:.2f}€” if total_pl >= 0 else f”{total_pl:.2f}€”
st.markdown(f”””<div class='metric-card'>
<div class='metric-label'>P&L Net</div>
<div class='metric-value {pl_color}'>{pl_str}</div>
</div>”””, unsafe_allow_html=True)

with col4:
rules_ok = len(df[df[“rules”] == “yes”]) if n else 0
rules_pct = round(rules_ok / n * 100) if n else 0
r_color = “green” if rules_pct >= 70 else “yellow” if rules_pct >= 50 else “red”
st.markdown(f”””<div class='metric-card'>
<div class='metric-label'>Dans le plan</div>
<div class='metric-value {r_color}'>{rules_pct}%</div>
<div class='metric-sub'>{rules_ok} / {n} trades</div>
</div>”””, unsafe_allow_html=True)

st.markdown(”—”)

# ─────────────────────────────────────────

# TABS

# ─────────────────────────────────────────

tab1, tab2, tab3 = st.tabs([“➕ Nouveau Trade”, “📋 Journal”, “📊 Statistiques”])

# ─────────────────────────────────────────

# TAB 1 — SAISIE

# ─────────────────────────────────────────

with tab1:
# Check if editing
edit_id = st.session_state.get(“edit_id”, None)
edit_data = None
if edit_id:
rows = df[df[“id”] == edit_id]
if not rows.empty:
edit_data = rows.iloc[0]

```
if edit_id:
    st.markdown("### ✏️ Modifier le trade")
else:
    st.markdown("### Saisir un trade EUR/USD")

st.markdown("""<div class='info-box'>
    📋 <strong style='color:#fff'>Rappel Daily Cycle :</strong>
    Trace la box <strong style='color:#fff'>7h00 → 13h00</strong> ·
    Identifie le <strong style='color:#fff'>CHOCH M15</strong> à l'intérieur ·
    Détermine le biais · Entre en position
    <strong style='color:#fff'>après 13h00</strong> dans la continuité New York
</div>""", unsafe_allow_html=True)

with st.form("trade_form", clear_on_submit=not bool(edit_id)):
    col1, col2, col3 = st.columns(3)

    with col1:
        f_date = st.date_input("📅 Date",
            value=pd.to_datetime(edit_data["date"]).date() if edit_data is not None else date.today())

    with col2:
        f_heure = st.text_input("🕐 Heure d'entrée (HH:MM)",
            value=str(edit_data["heure"]) if edit_data is not None else "",
            placeholder="13:15")

    with col3:
        st.markdown("**⚖️ Ratio RR**")
        st.markdown("<div class='muted' style='font-size:12px'>Calculé automatiquement</div>", unsafe_allow_html=True)

    st.markdown("**📐 Biais Daily Cycle — CHOCH M15 dans la box 7h–13h**")
    f_biais = st.radio("Biais",
        options=["bullish", "bearish", "neutral"],
        format_func=lambda x: "▲ Haussier" if x == "bullish" else "▼ Baissier" if x == "bearish" else "◆ Indécis",
        index=["bullish","bearish","neutral"].index(edit_data["biais"]) if edit_data is not None and edit_data["biais"] in ["bullish","bearish","neutral"] else 0,
        horizontal=True, label_visibility="collapsed")

    st.markdown("**⏰ Moment d'entrée**")
    f_session = st.radio("Session",
        options=["New York (13h–17h)", "Fin session (17h+)", "Pré-NY (avant 13h)"],
        index=["New York (13h–17h)","Fin session (17h+)","Pré-NY (avant 13h)"].index(edit_data["session"]) if edit_data is not None and edit_data["session"] in ["New York (13h–17h)","Fin session (17h+)","Pré-NY (avant 13h)"] else 0,
        horizontal=True, label_visibility="collapsed")

    col1, col2 = st.columns(2)
    with col1:
        f_direction = st.selectbox("📊 Direction",
            ["Long", "Short"],
            index=["Long","Short"].index(edit_data["direction"]) if edit_data is not None else 0)
    with col2:
        f_entree = st.number_input("💹 Prix d'entrée",
            value=float(edit_data["entree"]) if edit_data is not None and edit_data["entree"] else 0.0,
            format="%.5f", step=0.00001)

    col1, col2, col3 = st.columns(3)
    with col1:
        f_sl = st.number_input("🔴 Stop Loss",
            value=float(edit_data["sl"]) if edit_data is not None and edit_data["sl"] else 0.0,
            format="%.5f", step=0.00001)
    with col2:
        f_tp = st.number_input("🟢 Take Profit",
            value=float(edit_data["tp"]) if edit_data is not None and edit_data["tp"] else 0.0,
            format="%.5f", step=0.00001)
    with col3:
        f_pl = st.number_input("💰 Résultat (€)",
            value=float(edit_data["pl"]) if edit_data is not None and edit_data["pl"] else 0.0,
            format="%.2f", step=0.01)

    # RR display
    rr_val = calc_rr(f_entree, f_sl, f_tp)
    if rr_val:
        rr_color = "green" if rr_val >= 2 else "yellow" if rr_val >= 1 else "red"
        rr_icon = "✅" if rr_val >= 2 else "⚠️" if rr_val >= 1 else "❌"
        st.markdown(f"<div class='{rr_color}'>⚖️ Ratio RR : <strong>1 : {rr_val}</strong> {rr_icon}</div>", unsafe_allow_html=True)

    st.markdown("**🏆 Outcome**")
    f_outcome = st.radio("Outcome",
        ["Win", "Loss", "BE"],
        format_func=lambda x: "✅ Win" if x == "Win" else "❌ Loss" if x == "Loss" else "⚡ Break Even",
        index=["Win","Loss","BE"].index(edit_data["outcome"]) if edit_data is not None and edit_data["outcome"] in ["Win","Loss","BE"] else 0,
        horizontal=True, label_visibility="collapsed")

    st.markdown("**📏 Règles Daily Cycle respectées ? (biais défini + entrée après 13h)**")
    auto_no = f_session == "Pré-NY (avant 13h)"
    f_rules = st.radio("Règles",
        ["yes", "no"],
        format_func=lambda x: "✓ Dans le plan" if x == "yes" else "✗ Hors plan",
        index=1 if auto_no else (["yes","no"].index(edit_data["rules"]) if edit_data is not None and edit_data["rules"] in ["yes","no"] else 0),
        horizontal=True, label_visibility="collapsed")

    f_raison = st.text_area("📌 Setup — Pourquoi tu es entré ? (structure, niveau, déclencheur)",
        value=str(edit_data["raison"]) if edit_data is not None and pd.notna(edit_data["raison"]) else "",
        placeholder="Ex : CHOCH M15 haussier formé à 10h30 dans la box. Low cassé à 13h10. Entrée sur retest IFVG à 1.0845. SL sous le CHOCH.",
        height=80)

    f_lecon = st.text_area("💡 Leçon du jour — Ce qui s'est passé, ce que tu retiens",
        value=str(edit_data["lecon"]) if edit_data is not None and pd.notna(edit_data["lecon"]) else "",
        placeholder="Ex : Trade valide, j'ai coupé à +8€ par peur alors que le TP était à +22€. Leçon : faire confiance au setup.",
        height=80)

    submitted = st.form_submit_button("💾 Enregistrer le trade" if not edit_id else "✅ Mettre à jour")

    if submitted:
        df = load_trades()
        new_id = edit_id if edit_id else int(datetime.now().timestamp() * 1000)
        new_trade = {
            "id": new_id,
            "date": str(f_date),
            "heure": f_heure,
            "biais": f_biais,
            "session": f_session,
            "direction": f_direction,
            "entree": f_entree if f_entree else "",
            "sl": f_sl if f_sl else "",
            "tp": f_tp if f_tp else "",
            "rr": rr_val if rr_val else "—",
            "pl": f_pl,
            "outcome": f_outcome,
            "rules": f_rules,
            "raison": f_raison,
            "lecon": f_lecon,
        }
        if edit_id:
            df = df[df["id"] != edit_id]
            st.session_state.pop("edit_id", None)
        df = pd.concat([df, pd.DataFrame([new_trade])], ignore_index=True)
        save_trades(df)
        st.success("✅ Trade enregistré avec succès !")
        st.rerun()

if edit_id:
    if st.button("❌ Annuler la modification"):
        st.session_state.pop("edit_id", None)
        st.rerun()
```

# ─────────────────────────────────────────

# TAB 2 — JOURNAL

# ─────────────────────────────────────────

with tab2:
st.markdown(”### 📋 Historique des trades”)

```
df = load_trades()

if df.empty:
    st.markdown("""<div style='text-align:center; padding: 60px 20px; color: #4a6070;'>
        <div style='font-size:36px; margin-bottom:12px;'>📋</div>
        Aucun trade enregistré.<br>Commence par saisir ton premier trade.
    </div>""", unsafe_allow_html=True)
else:
    df_sorted = df.sort_values("date", ascending=False)

    for _, t in df_sorted.iterrows():
        pl = float(t["pl"]) if t["pl"] != "" else 0
        pl_color = "#00e5a0" if pl > 0 else "#ff4060" if pl < 0 else "#4a6070"
        pl_str = f"+{pl:.2f}€" if pl >= 0 else f"{pl:.2f}€"

        biais_map = {"bullish": ("▲ Haussier", "#00e5a0"), "bearish": ("▼ Baissier", "#ff4060"), "neutral": ("◆ Indécis", "#ffd060")}
        biais_label, biais_color = biais_map.get(t["biais"], ("—", "#4a6070"))

        outcome_map = {"Win": ("✅ Win", "#00e5a0"), "Loss": ("❌ Loss", "#ff4060"), "BE": ("⚡ BE", "#a060ff")}
        out_label, out_color = outcome_map.get(t["outcome"], ("—", "#4a6070"))

        rules_label = "✓ Plan" if t["rules"] == "yes" else "✗ Hors plan"
        rules_color = "#00e5a0" if t["rules"] == "yes" else "#ff4060"

        dir_color = "#00e5a0" if t["direction"] == "Long" else "#ff4060"
        rr_str = f"RR 1:{t['rr']}" if t["rr"] and t["rr"] != "—" else ""

        with st.container():
            col_main, col_pl, col_actions = st.columns([5, 2, 1])

            with col_main:
                st.markdown(f"""
                <div class='trade-card'>
                    <div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;'>
                        <div>
                            <span style='color:#00d4ff; font-weight:500;'>{t["date"]}</span>
                            <span style='color:#4a6070; margin-left:8px;'>{t["heure"] or ""}</span>
                            <span style='color:{dir_color}; margin-left:10px; font-weight:500;'>{t["direction"]}</span>
                        </div>
                        <div style='font-family:Syne,sans-serif; font-size:18px; font-weight:700; color:{pl_color};'>{pl_str}</div>
                    </div>
                    <div style='margin-bottom:6px;'>
                        <span class='badge' style='background:{biais_color}20; color:{biais_color};'>{biais_label}</span>
                        <span class='badge' style='background:{out_color}20; color:{out_color};'>{out_label}</span>
                        <span class='badge' style='background:{rules_color}20; color:{rules_color};'>{rules_label}</span>
                        {f"<span class='badge' style='background:#00d4ff20; color:#00d4ff;'>{rr_str}</span>" if rr_str else ""}
                    </div>
                    <div style='font-size:11px; color:#4a6070;'>
                        {f"Entrée: {t['entree']}" if t['entree'] else ""}
                        {f" · SL: {t['sl']}" if t['sl'] else ""}
                        {f" · TP: {t['tp']}" if t['tp'] else ""}
                    </div>
                    {f"<div style='font-size:11px; color:#4a6070; margin-top:6px; border-top:1px solid #1e2830; padding-top:6px;'>📌 {t['raison']}</div>" if pd.notna(t['raison']) and t['raison'] else ""}
                    {f"<div style='font-size:11px; color:#00d4ff; margin-top:4px;'>💡 {t['lecon']}</div>" if pd.notna(t['lecon']) and t['lecon'] else ""}
                </div>
                """, unsafe_allow_html=True)

            with col_actions:
                if st.button("✏️", key=f"edit_{t['id']}", help="Modifier"):
                    st.session_state["edit_id"] = t["id"]
                    st.rerun()
                if st.button("🗑️", key=f"del_{t['id']}", help="Supprimer"):
                    st.session_state[f"confirm_del_{t['id']}"] = True
                    st.rerun()

                if st.session_state.get(f"confirm_del_{t['id']}", False):
                    st.warning("Confirmer ?")
                    if st.button("✅ Oui", key=f"yes_{t['id']}"):
                        df = df[df["id"] != t["id"]]
                        save_trades(df)
                        st.session_state.pop(f"confirm_del_{t['id']}", None)
                        st.rerun()
                    if st.button("❌ Non", key=f"no_{t['id']}"):
                        st.session_state.pop(f"confirm_del_{t['id']}", None)
                        st.rerun()
```

# ─────────────────────────────────────────

# TAB 3 — STATS

# ─────────────────────────────────────────

with tab3:
st.markdown(”### 📊 Statistiques”)

```
df = load_trades()

if df.empty:
    st.markdown("""<div style='text-align:center; padding: 60px 20px; color: #4a6070;'>
        <div style='font-size:36px; margin-bottom:12px;'>📊</div>
        Enregistre des trades pour voir tes statistiques.
    </div>""", unsafe_allow_html=True)
else:
    df["pl"] = pd.to_numeric(df["pl"], errors="coerce").fillna(0)
    df["date"] = pd.to_datetime(df["date"])
    df_sorted = df.sort_values("date")

    n = len(df)
    wins = len(df[df["outcome"] == "Win"])
    losses = len(df[df["outcome"] == "Loss"])
    bes = len(df[df["outcome"] == "BE"])
    wr = round(wins / n * 100) if n else 0
    total_pl = df["pl"].sum()
    pl_rules = df[df["rules"] == "yes"]["pl"].sum()
    pl_no_rules = df[df["rules"] == "no"]["pl"].sum()
    rules_ok = len(df[df["rules"] == "yes"])

    # Insight
    insight = ""
    if wr < 35:
        insight = f"⚠️ Win rate {wr}% — priorité à la qualité des setups, pas à la quantité."
    elif wr >= 50:
        insight = f"🔥 Excellent win rate {wr}% ! Continue sur cette lancée."
    else:
        insight = f"📊 Win rate {wr}% — vérifie que ton RR moyen compense les pertes."

    if rules_ok < n:
        insight += f" | Plan respecté {round(rules_ok/n*100)}% du temps — Dans le plan : {'+' if pl_rules>=0 else ''}{pl_rules:.2f}€ · Hors plan : {'+' if pl_no_rules>=0 else ''}{pl_no_rules:.2f}€"

    st.markdown(f"<div class='insight-box'>{insight}</div>", unsafe_allow_html=True)

    # Equity curve
    df_sorted["cumpl"] = df_sorted["pl"].cumsum()
    fig_eq = go.Figure()
    fig_eq.add_trace(go.Scatter(
        x=df_sorted["date"],
        y=df_sorted["cumpl"],
        mode="lines+markers",
        line=dict(color="#00e5a0" if total_pl >= 0 else "#ff4060", width=2),
        marker=dict(size=6, color=["#00e5a0" if v >= 0 else "#ff4060" for v in df_sorted["cumpl"]]),
        fill="tozeroy",
        fillcolor="rgba(0,229,160,0.06)" if total_pl >= 0 else "rgba(255,64,96,0.06)",
        name="P&L cumulé"
    ))
    fig_eq.add_hline(y=0, line_dash="dash", line_color="#253040")
    fig_eq.update_layout(
        title="Courbe de capital — P&L cumulé",
        plot_bgcolor="#0d1117", paper_bgcolor="#0d1117",
        font=dict(color="#c8d8e8", family="DM Mono"),
        xaxis=dict(gridcolor="#1e2830", showgrid=True),
        yaxis=dict(gridcolor="#1e2830", showgrid=True),
        showlegend=False, height=280, margin=dict(l=10,r=10,t=40,b=10)
    )
    st.plotly_chart(fig_eq, use_container_width=True)

    col1, col2 = st.columns(2)

    with col1:
        # Win/Loss donut
        fig_wl = go.Figure(go.Pie(
            labels=["Win", "Loss", "BE"],
            values=[wins, losses, bes],
            hole=0.65,
            marker=dict(colors=["#00e5a0", "#ff4060", "#a060ff"], line=dict(width=0)),
        ))
        fig_wl.update_layout(
            title="Win / Loss / BE",
            plot_bgcolor="#0d1117", paper_bgcolor="#0d1117",
            font=dict(color="#c8d8e8", family="DM Mono"),
            showlegend=True, height=260, margin=dict(l=10,r=10,t=40,b=10)
        )
        st.plotly_chart(fig_wl, use_container_width=True)

    with col2:
        # Biais chart
        biais_data = df.groupby("biais")["pl"].sum().reset_index()
        biais_data["label"] = biais_data["biais"].map({"bullish": "▲ Haussier", "bearish": "▼ Baissier", "neutral": "◆ Indécis"})
        biais_data["color"] = biais_data["pl"].apply(lambda x: "#00e5a0" if x >= 0 else "#ff4060")
        fig_b = go.Figure(go.Bar(
            x=biais_data["label"], y=biais_data["pl"],
            marker_color=biais_data["color"],
            text=biais_data["pl"].apply(lambda x: f"{'+' if x>=0 else ''}{x:.2f}€"),
            textposition="outside"
        ))
        fig_b.update_layout(
            title="P&L par biais",
            plot_bgcolor="#0d1117", paper_bgcolor="#0d1117",
            font=dict(color="#c8d8e8", family="DM Mono"),
            xaxis=dict(gridcolor="#1e2830"), yaxis=dict(gridcolor="#1e2830"),
            showlegend=False, height=260, margin=dict(l=10,r=10,t=40,b=10)
        )
        st.plotly_chart(fig_b, use_container_width=True)

    col3, col4 = st.columns(2)

    with col3:
        # Rules chart
        fig_r = go.Figure(go.Bar(
            x=["Dans le plan", "Hors plan"],
            y=[pl_rules, pl_no_rules],
            marker_color=["#00e5a0" if pl_rules >= 0 else "#ff4060", "#00e5a0" if pl_no_rules >= 0 else "#ff4060"],
            text=[f"{'+' if pl_rules>=0 else ''}{pl_rules:.2f}€", f"{'+' if pl_no_rules>=0 else ''}{pl_no_rules:.2f}€"],
            textposition="outside"
        ))
        fig_r.update_layout(
            title="P&L : Dans le plan vs Hors plan",
            plot_bgcolor="#0d1117", paper_bgcolor="#0d1117",
            font=dict(color="#c8d8e8", family="DM Mono"),
            xaxis=dict(gridcolor="#1e2830"), yaxis=dict(gridcolor="#1e2830"),
            showlegend=False, height=260, margin=dict(l=10,r=10,t=40,b=10)
        )
        st.plotly_chart(fig_r, use_container_width=True)

    with col4:
        # Session chart
        sess_data = df.groupby("session")["pl"].sum().reset_index()
        sess_data["color"] = sess_data["pl"].apply(lambda x: "#00e5a0" if x >= 0 else "#ff4060")
        fig_s = go.Figure(go.Bar(
            x=sess_data["session"], y=sess_data["pl"],
            marker_color=sess_data["color"],
            text=sess_data["pl"].apply(lambda x: f"{'+' if x>=0 else ''}{x:.2f}€"),
            textposition="outside"
        ))
        fig_s.update_layout(
            title="P&L par session",
            plot_bgcolor="#0d1117", paper_bgcolor="#0d1117",
            font=dict(color="#c8d8e8", family="DM Mono"),
            xaxis=dict(gridcolor="#1e2830"), yaxis=dict(gridcolor="#1e2830"),
            showlegend=False, height=260, margin=dict(l=10,r=10,t=40,b=10)
        )
        st.plotly_chart(fig_s, use_container_width=True)

    # Export CSV
    st.markdown("---")
    csv_export = df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="⬇️ Exporter en CSV",
        data=csv_export,
        file_name="journal_daily_cycle.csv",
        mime="text/csv"
    )
```
