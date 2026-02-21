import streamlit as st
import pandas as pd
import os
from datetime import date, datetime
import plotly.graph_objects as go
st.set_page_config(
page_title="Daily Cycle Journal - EUR/USD",
page_icon="chart",
layout="wide",
initial_sidebar_state="collapsed"
)
CSV_FILE = "trades.csv"
COLUMNS = ["id","date","heure","biais","session","direction",
"entree","sl","tp","rr","pl","outcome","rules","raison","lecon"]
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@7
html, body,
[data-testid="stAppViewContainer"],
[data-testid="stAppViewBlockContainer"],
[data-testid="block-container"],
[data-testid="stMain"],
.main, .block-container,
section[data-testid="stSidebar"],
[class*="css"] {
background-color: #0a0e14 !important;
color: #e0eeff !important;
font-family: 'DM Mono', monospace !important;
}
h1,h2,h3,h4 { font-family:'Syne',sans-serif !important; color:#ffffff !important; }
[data-testid="stTabs"] button[role="tab"] {
background: transparent !important;
color: #6080a0 !important;
font-size: 14px !important;
border-bottom: 2px solid transparent !important;
padding: 10px 18px !important;
}
[data-testid="stTabs"] button[role="tab"][aria-selected="true"] {
color: #00d4ff !important;
border-bottom: 2px solid #00d4ff !important;
}
input, textarea, select,
.stTextInput input,
.stNumberInput input,
.stTextArea textarea,
.stDateInput input,
[data-testid="stTextInput"] input,
[data-testid="stNumberInput"] input,
[data-testid="stDateInput"] input {
background-color: #111a24 !important;
color: #e0eeff !important;
border: 1px solid #2a3f55 !important;
border-radius: 6px !important;
font-size: 15px !important;
font-family: 'DM Mono', monospace !important;
}
input::placeholder, textarea::placeholder { color: #3a5570 !important; }
[data-testid="stSelectbox"] > div > div {
background-color: #111a24 !important;
color: #e0eeff !important;
border: 1px solid #2a3f55 !important;
border-radius: 6px !important;
font-size: 15px !important;
}
[data-testid="stSelectbox"] span { color: #e0eeff !important; }
[data-testid="stRadio"] {
background-color: #111a24 !important;
border: 1px solid #2a3f55 !important;
border-radius: 8px !important;
padding: 10px 14px !important;
}
[data-testid="stRadio"] label,
[data-testid="stRadio"] p,
[data-testid="stRadio"] span { color: #e0eeff !important; font-size: 15px !important; }
label, .stMarkdown p, p, span, div { color: #e0eeff !important; }
.stButton > button {
background-color: #00d4ff !important;
color: #000000 !important;
font-family: 'Syne', sans-serif !important;
font-weight: 800 !important;
font-size: 16px !important;
border: none !important;
border-radius: 8px !important;
padding: 14px 20px !important;
width: 100% !important;
letter-spacing: 0.5px !important;
}
.stButton > button:hover { background-color: #33ddff !important; }
[data-testid="stForm"] {
background-color: #0d1520 !important;
border: 1px solid #1e3040 !important;
border-radius: 12px !important;
padding: 20px !important;
}
.stNumberInput button {
background-color: #1a2a3a !important;
color: #00d4ff !important;
border: 1px solid #2a3f55 !important;
font-size: 18px !important;
}
[data-testid="stAlert"] {
background-color: #0d2010 !important;
border: 1px solid #00e5a0 !important;
color: #00e5a0 !important;
border-radius: 6px !important;
}
[data-testid="stDownloadButton"] button {
background-color: #0d1520 !important;
color: #00d4ff !important;
border: 2px solid #00d4ff !important;
font-size: 14px !important;
font-weight: 700 !important;
}
hr { border-color: #1e3040 !important; }
.metric-card {
background: #0d1520; border: 1px solid #1e3040;
border-radius: 10px; padding: 18px; margin-bottom: 10px;
}
.metric-value { font-family:'Syne',sans-serif; font-size:30px; font-weight:800; line-height:1
.metric-label { font-size:11px; color:#4a7090 !important; text-transform:uppercase; letter-sp
.metric-sub { font-size:12px; color:#4a7090 !important; margin-top:5px; }
.trade-card {
background: #0d1520; border: 1px solid #1e3040;
border-radius: 10px; padding: 16px; margin-bottom: 12px;
}
.badge {
display:inline-block; padding:4px 10px; border-radius:5px;
font-size:13px; font-weight:600; margin-right:5px;
}
.info-box {
background:rgba(0,212,255,0.07); border:1px solid rgba(0,212,255,0.25);
border-radius:8px; padding:14px 18px; font-size:13px; color:#00d4ff !important;
margin-bottom:18px; line-height:1.8;
}
.insight-box {
background:#0d1520; border-left:3px solid #00d4ff;
border-radius:6px; padding:14px 18px; font-size:14px; line-height:1.8; margin-bottom:18px
}
#MainMenu, footer, header { visibility:hidden !important; }
[data-testid="stToolbar"] { display:none !important; }
</style>
""", unsafe_allow_html=True)
def load_trades():
if os.path.exists(CSV_FILE):
df = pd.read_csv(CSV_FILE)
for col in COLUMNS:
if col not in df.columns:
df[col] = ""
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
def chart_layout(title, height=300):
return dict(
title=dict(text=title, font=dict(color="#ffffff", size=16, family="Syne")),
plot_bgcolor="#0d1520",
paper_bgcolor="#0d1520",
font=dict(color="#c0d8f0", size=13),
xaxis=dict(gridcolor="#1e3040", tickfont=dict(color="#c0d8f0", size=13), linecolor="#
yaxis=dict(gridcolor="#1e3040", tickfont=dict(color="#c0d8f0", size=13), linecolor="#
showlegend=False,
height=height,
margin=dict(l=20, r=20, t=55, b=40)
)
# HEADER
df = load_trades()
n = len(df)
wins = len(df[df["outcome"] == "Win"]) if n else 0
losses = len(df[df["outcome"] == "Loss"]) if n else 0
bes = len(df[df["outcome"] == "BE"]) if n else 0
wr = round(wins / n * 100) if n else None
total_pl = df["pl"].astype(float).sum() if n else 0
st.markdown("""
<div style='padding:20px 0 10px 0;'>
<span style='font-family:Syne,sans-serif;font-size:30px;font-weight:800;color:#fff;'>
DailyCycle <span style='color:#00d4ff'>Journal</span>
</span><br>
<span style='font-size:12px;color:#4a7090;letter-spacing:2px;text-transform:uppercase;'>
EUR/USD . IC MARKETS . CHRISTOPHE MEONI
</span>
</div>
""", unsafe_allow_html=True)
c1, c2, c3, c4 = st.columns(4)
with c1:
st.markdown(f"<div class='metric-card'><div class='metric-label'>Trades totaux</div><div
with c2:
wr_c = "#00e5a0" if wr and wr >= 50 else "#ff4060" if wr else "#00d4ff"
st.markdown(f"<div class='metric-card'><div class='metric-label'>Win Rate</div><div class
with c3:
pl_c = "#00e5a0" if total_pl > 0 else "#ff4060" if total_pl < 0 else "#00d4ff"
pl_str = f"+{total_pl:.2f}EUR" if total_pl >= 0 else f"{total_pl:.2f}EUR"
st.markdown(f"<div class='metric-card'><div class='metric-label'>P&L Net</div><div with c4:
class=
rules_ok = len(df[df["rules"] == "yes"]) if n else 0
rp = round(rules_ok / n * 100) if n else 0
r_c = "#00e5a0" if rp >= 70 else "#ffd060" if rp >= 50 else "#ff4060"
st.markdown(f"<div class='metric-card'><div class='metric-label'>Dans le plan</div><div c
st.markdown("---")
tab1, tab2, tab3 = st.tabs([" Nouveau Trade", " Journal", " Statistiques"])
# TAB 1 - SAISIE
with tab1:
edit_id = st.session_state.get("edit_id", None)
edit_data = None
if edit_id:
rows = df[df["id"] == edit_id]
if not rows.empty:
edit_data = rows.iloc[0]
st.markdown("### Modifier le trade" if edit_id else "### Nouveau trade EUR/USD")
st.markdown("""<div class='info-box'>
Rappel Daily Cycle : Trace la box <strong style='color:#fff'>7h00 -&gt; 13h00</strong>
. Identifie le <strong style='color:#fff'>CHOCH M15</strong> a l'interieur
. Determine le biais . Entre en position
<strong style='color:#fff'>apres 13h00</strong> dans la continuite New York
</div>""", unsafe_allow_html=True)
with st.form("trade_form", clear_on_submit=not bool(edit_id)):
col1, col2 = st.columns(2)
with col1:
f_date = st.date_input("Date",
value=pd.to_datetime(edit_data["date"]).date() if edit_data is not None else
with col2:
f_heure = st.text_input("Heure d'entree (ex: 13:15)",
value=str(edit_data["heure"]) if edit_data is not None else "",
placeholder="13:15")
st.markdown("**Biais - CHOCH M15 dans la box 7h-13h**")
f_biais = st.radio("Biais",
options=["bullish", "bearish", "neutral"],
format_func=lambda x: "Haussier" if x=="bullish" else "Baissier" if x=="bearish"
index=["bullish","bearish","neutral"].index(edit_data["biais"]) if edit_data is n
horizontal=True, label_visibility="collapsed")
st.markdown("**Moment d'entree**")
f_session = st.radio("Session",
options=["New York (13h-17h)", "Fin session (17h+)", "Pre-NY (avant 13h)"],
index=["New York (13h-17h)","Fin session (17h+)","Pre-NY (avant 13h)"].index(edit
horizontal=True, label_visibility="collapsed")
col1, col2 = st.columns(2)
with col1:
f_direction = st.selectbox("Direction", ["Long", "Short"],
index=["Long","Short"].index(edit_data["direction"]) if edit_data is not None
with col2:
f_entree = st.number_input("Prix d'entree",
value=float(edit_data["entree"]) if edit_data is not None and edit_data["entr
format="%.5f", step=0.00001)
col1, col2, col3 = st.columns(3)
with col1:
f_sl = st.number_input("Stop Loss",
value=float(edit_data["sl"]) if edit_data is not None and edit_data["sl"] els
format="%.5f", step=0.00001)
with col2:
f_tp = st.number_input("Take Profit",
value=float(edit_data["tp"]) if edit_data is not None and edit_data["tp"] els
format="%.5f", step=0.00001)
with col3:
f_pl = st.number_input("Resultat (EUR)",
value=float(edit_data["pl"]) if edit_data is not None and edit_data["pl"] els
format="%.2f", step=0.01)
rr_val = calc_rr(f_entree, f_sl, f_tp)
if rr_val:
rr_col = "#00e5a0" if rr_val >= 2 else "#ffd060" if rr_val >= 1 else "#ff4060"
rr_txt = "OK" if rr_val >= 2 else "moyen" if rr_val >= 1 else "faible"
st.markdown(f"<div style='font-size:17px;font-weight:700;color:{rr_col};padding:8
st.markdown("**Outcome**")
f_outcome = st.radio("Outcome",
["Win", "Loss", "BE"],
format_func=lambda x: "Win" if x=="Win" else "Loss" if x=="Loss" else "Break Even
index=["Win","Loss","BE"].index(edit_data["outcome"]) if edit_data is not None an
horizontal=True, label_visibility="collapsed")
st.markdown("**Regles Daily Cycle respectees ? (biais defini + entree apres 13h)**")
auto_no = f_session == "Pre-NY (avant 13h)"
f_rules = st.radio("Regles",
["yes", "no"],
format_func=lambda x: "Dans le plan" if x=="yes" else "Hors plan",
index=1 if auto_no else (["yes","no"].index(edit_data["rules"]) if edit_data is n
horizontal=True, label_visibility="collapsed")
f_raison = st.text_area("Setup - Pourquoi tu es entre ? (structure, niveau, declenche
value=str(edit_data["raison"]) if edit_data is not None and pd.notna(edit_data["r
placeholder="Ex : CHOCH M15 haussier forme a 10h30 dans la box. Low casse a 13h10
height=90)
f_lecon = st.text_area("Lecon du jour - Ce qui s'est passe, ce que tu retiens",
value=str(edit_data["lecon"]) if edit_data is not None and pd.notna(edit_data["le
placeholder="Ex : Trade valide, j'ai coupe a +8EUR par peur. Lecon : faire confia
height=90)
submitted = st.form_submit_button(
"METTRE A JOUR LE TRADE" if edit_id else "ENREGISTRER LE TRADE"
)
if submitted:
df = load_trades()
new_id = edit_id if edit_id else int(datetime.now().timestamp() * 1000)
new_trade = {
"id": new_id, "date": str(f_date), "heure": f_heure,
"biais": f_biais, "session": f_session, "direction": f_direction,
"entree": f_entree if f_entree else "",
"sl": f_sl if f_sl else "", "tp": f_tp if f_tp else "",
"rr": rr_val if rr_val else "-",
"pl": f_pl, "outcome": f_outcome, "rules": f_rules,
"raison": f_raison, "lecon": f_lecon,
}
if edit_id:
df = df[df["id"] != edit_id]
st.session_state.pop("edit_id", None)
df = pd.concat([df, pd.DataFrame([new_trade])], ignore_index=True)
save_trades(df)
st.success("Trade enregistre avec succes !")
st.rerun()
if edit_id:
if st.button("ANNULER LA MODIFICATION"):
st.session_state.pop("edit_id", None)
st.rerun()
# TAB 2 - JOURNAL
with tab2:
st.markdown("### Historique des trades")
df = load_trades()
if df.empty:
st.markdown("<div style='text-align:center;padding:60px 20px;color:#4a7090;font-size:
else:
df_sorted = df.sort_values("date", ascending=False)
for _, t in df_sorted.iterrows():
pl = float(t["pl"]) if t["pl"] != "" else 0
pl_c = "#00e5a0" if pl > 0 else "#ff4060" if pl < 0 else "#6080a0"
pl_str = f"+{pl:.2f}EUR" if pl >= 0 else f"{pl:.2f}EUR"
biais_map = {"bullish":("Haussier","#00e5a0"),"bearish":("Baissier","#ff4060"),"n
biais_label, biais_c = biais_map.get(t["biais"], ("-","#6080a0"))
outcome_map = {"Win":("Win","#00e5a0"),"Loss":("Loss","#ff4060"),"BE":("BE","#a06
out_label, out_c = outcome_map.get(t["outcome"], ("-","#6080a0"))
rules_label = "Dans le plan" if t["rules"] == "yes" else "Hors plan"
rules_c = "#00e5a0" if t["rules"] == "yes" else "#ff4060"
dir_c = "#00e5a0" if t["direction"] == "Long" else "#ff4060"
rr_str = f"RR 1:{t['rr']}" if t["rr"] and t["rr"] != "-" else ""
col_card, col_btns = st.columns([8, 1])
with col_card:
st.markdown(f"""
<div class='trade-card'>
<div style='display:flex;justify-content:space-between;align-items:center
<div>
<span style='color:#00d4ff;font-size:15px;font-weight:600;'>{t["d
<span style='color:#6080a0;margin-left:10px;font-size:14px;'>{t["
<span style='color:{dir_c};margin-left:12px;font-size:15px;font-w
</div>
<div style='font-family:Syne,sans-serif;font-size:20px;font-weight:80
</div>
<div style='margin-bottom:8px;'>
<span class='badge' style='background:{biais_c}22;color:{biais_c};bor
<span class='badge' style='background:{out_c}22;color:{out_c};border:
<span class='badge' style='background:{rules_c}22;color:{rules_c};bor
{f"<span class='badge' style='background:#00d4ff22;color:#00d4ff;bord
</div>
<div style='font-size:13px;color:#6080a0;'>
{f"Entree: {t['entree']}" if t['entree'] else ""}{f" . SL: {t['sl']}"
</div>
{f"<div style='font-size:13px;color:#8090a0;margin-top:8px;border-top:1px
{f"<div style='font-size:13px;color:#00d4ff;margin-top:6px;'>{t['lecon']}
</div>
""", unsafe_allow_html=True)
with col_btns:
st.markdown("<br>", unsafe_allow_html=True)
if st.button("EDIT", key=f"edit_{t['id']}",
help="Modifier ce trade",
type="secondary"):
st.session_state["edit_id"] = t["id"]
st.rerun()
if st.button("DEL", key=f"del_{t['id']}",
help="Supprimer ce trade",
type="secondary"):
st.session_state[f"confirm_{t['id']}"] = True
st.rerun()
if st.session_state.get(f"confirm_{t['id']}", False):
st.warning("Confirmer ?")
if st.button("OUI", key=f"yes_{t['id']}", type="secondary"):
df2 = load_trades()
save_trades(df2[df2["id"] != t["id"]])
st.session_state.pop(f"confirm_{t['id']}", None)
st.rerun()
if st.button("NON", key=f"no_{t['id']}", type="secondary"):
st.session_state.pop(f"confirm_{t['id']}", None)
st.rerun()
# TAB 3 - STATS
with tab3:
st.markdown("### Statistiques")
df = load_trades()
if df.empty:
st.markdown("<div style='text-align:center;padding:60px 20px;color:#4a7090;font-size:
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
if wr < 35:
insight = f"Win rate {wr}% - Priorite a la qualite des setups."
elif wr >= 50:
insight = f"Excellent win rate {wr}% ! Continue sur cette lancee."
else:
insight = f"Win rate {wr}% - Verifie que ton RR moyen compense les pertes."
if rules_ok < n:
insight += f" | Plan: {round(rules_ok/n*100)}% - Dans le plan: {'+' if pl_rules>=
st.markdown(f"<div class='insight-box'>{insight}</div>", unsafe_allow_html=True)
df_sorted["cumpl"] = df_sorted["pl"].cumsum()
line_col = "#00e5a0" if total_pl >= 0 else "#ff4060"
fill_col = "rgba(0,229,160,0.12)" if total_pl >= 0 else "rgba(255,64,96,0.12)"
fig_eq = go.Figure()
fig_eq.add_trace(go.Scatter(
x=df_sorted["date"], y=df_sorted["cumpl"],
mode="lines+markers",
line=dict(color=line_col, width=3),
marker=dict(size=9, color=line_col, line=dict(color="#ffffff", width=1.5)),
fill="tozeroy", fillcolor=fill_col
))
fig_eq.add_hline(y=0, line_dash="dash", line_color="#4a7090", line_width=1.5)
layout = chart_layout("Courbe de capital - P&L cumule (EUR)", height=340)
layout["yaxis"]["ticksuffix"] = " EUR"
fig_eq.update_layout(**layout)
st.plotly_chart(fig_eq, use_container_width=True)
col1, col2 = st.columns(2)
with col1:
fig_wl = go.Figure(go.Pie(
labels=["Win", "Loss", "Break Even"],
values=[max(wins,0), max(losses,0), max(bes,0)],
hole=0.55,
marker=dict(colors=["#00e5a0","#ff4060","#a060ff"], line=dict(color="#0d1520"
textfont=dict(color="#ffffff", size=15),
textinfo="label+percent"
))
l = chart_layout("Win / Loss / Break Even", height=320)
l["showlegend"] = True
l["legend"] = dict(font=dict(color="#c0d8f0", size=13))
del l["xaxis"]; del l["yaxis"]
fig_wl.update_layout(**l)
st.plotly_chart(fig_wl, use_container_width=True)
with col2:
biais_data = df.groupby("biais")["pl"].sum().reset_index()
biais_data["label"] = biais_data["biais"].map({"bullish":"Haussier","bearish":"Ba
biais_data["color"] = biais_data["pl"].apply(lambda x: "#00e5a0" if x>=0 else "#f
fig_b = go.Figure(go.Bar(
x=biais_data["label"], y=biais_data["pl"],
marker_color=biais_data["color"],
marker_line=dict(color="#ffffff", width=1),
text=biais_data["pl"].apply(lambda x: f"{'+' if x>=0 else ''}{x:.2f}EUR"),
textposition="outside", textfont=dict(color="#ffffff", size=14)
))
fig_b.update_layout(**chart_layout("P&L par biais", height=320))
st.plotly_chart(fig_b, use_container_width=True)
col3, col4 = st.columns(2)
with col3:
fig_r = go.Figure(go.Bar(
x=["Dans le plan", "Hors plan"],
y=[pl_rules, pl_no_rules],
marker_color=["#00e5a0" if pl_rules>=0 else "#ff4060", "#00e5a0" if pl_no_rul
marker_line=dict(color="#ffffff", width=1),
text=[f"{'+' if pl_rules>=0 else ''}{pl_rules:.2f}EUR", f"{'+' if pl_no_rules
textposition="outside", textfont=dict(color="#ffffff", size=14)
))
fig_r.update_layout(**chart_layout("Dans le plan vs Hors plan", height=320))
st.plotly_chart(fig_r, use_container_width=True)
with col4:
sess_data = df.groupby("session")["pl"].sum().reset_index()
sess_data["label"] = sess_data["session"].apply(
lambda x: "NY 13h-17h" if "13h" in x else "Fin 17h+" if "17h" in x else "Avan
)
sess_data["color"] = sess_data["pl"].apply(lambda x: "#00e5a0" if x>=0 else "#ff4
fig_s = go.Figure(go.Bar(
x=sess_data["label"], y=sess_data["pl"],
marker_color=sess_data["color"],
marker_line=dict(color="#ffffff", width=1),
text=sess_data["pl"].apply(lambda x: f"{'+' if x>=0 else ''}{x:.2f}EUR"),
textposition="outside", textfont=dict(color="#ffffff", size=14)
))
fig_s.update_layout(**chart_layout("P&L par session", height=320))
st.plotly_chart(fig_s, use_container_width=True)
st.markdown("---")
csv_export = df.to_csv(index=False).encode("utf-8")
st.download_button(
label="EXPORTER EN CSV",
data=csv_export,
file_name="journal_daily_cycle.csv",
mime="text/csv"
)
