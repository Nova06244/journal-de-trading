import { useState, useEffect } from "react";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SB_URL = "https://zqtmjxsjurdrcnwissmn.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxdG1qeHNqdXJkcmNud2lzc21uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTY3NjksImV4cCI6MjA4NzI3Mjc2OX0.hAiO03vpGlfAnqlkVZ34yy-tQ3JqRhWDCG3h05Nq-qM";

async function sbGet(table, params) {
  var url = SB_URL + "/rest/v1/" + table + "?order=id.desc";
  if (params) url += "&" + params;
  var r = await fetch(url, { headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY } });
  if (!r.ok) return [];
  return await r.json();
}

async function sbInsert(table, data) {
  var r = await fetch(SB_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(data)
  });
  if (!r.ok) return null;
  var res = await r.json();
  return res[0] || null;
}

async function sbUpdate(table, id, data) {
  var r = await fetch(SB_URL + "/rest/v1/" + table + "?id=eq." + id, {
    method: "PATCH",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return r.ok;
}

async function sbDelete(table, id) {
  var r = await fetch(SB_URL + "/rest/v1/" + table + "?id=eq." + id, {
    method: "DELETE",
    headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
  });
  return r.ok;
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);
const MOIS = ["Janv","Févr","Mars","Avr","Mai","Juin","Juil","Août","Sept","Oct","Nov","Déc"];
const STATUS_LABEL = { OPEN:"EN COURS", CLOSED_TP:"TP", CLOSED_SL:"SL", CLOSED_BE:"BE", CLOSED_MANUAL:"MANUEL" };
const STATUS_COLOR = { OPEN:"#3b82f6", CLOSED_TP:"#22c55e", CLOSED_SL:"#ef4444", CLOSED_BE:"#eab308", CLOSED_MANUAL:"#94a3b8" };

function gn(){const n=new Date();return String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");}

function calcLot(cap, rsk, slPoints) {
  var riskAmount = cap * (parseFloat(rsk) / 100);
  var lots = riskAmount / (parseFloat(slPoints) || 50);
  return Math.max(0.01, Math.round(lots * 100) / 100);
}

function tradePL(t) {
  if (t.pnl !== null && t.pnl !== undefined && t.pnl !== "") return parseFloat(t.pnl);
  return 0;
}

function capCourant(capD, journal) {
  return journal.reduce(function(acc, t){ return acc + tradePL(t); }, parseFloat(capD) || 0);
}

function calcDureeMinutes(entryTime, exitTime) {
  if (!entryTime || !exitTime) return null;
  try {
    var diff = Math.round((new Date(exitTime) - new Date(entryTime)) / 60000);
    return diff > 0 ? diff : null;
  } catch(e) { return null; }
}

function formatDuree(min) {
  if (!min || min <= 0) return null;
  if (min < 60) return min + "min";
  var h = Math.floor(min / 60), m = min % 60;
  return h + "h" + (m > 0 ? " " + m + "min" : "");
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
var BG = "#0a0e1a";
var CARD = { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:16, marginBottom:14 };
var INP = { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"9px 10px", color:"#e2e8f0", fontSize:12, fontFamily:"'DM Mono',monospace", outline:"none", width:"100%", boxSizing:"border-box" };
var SEL = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"9px 10px", fontSize:12, fontFamily:"'DM Mono',monospace", outline:"none", width:"100%", color:"#e2e8f0", boxSizing:"border-box" };
var LABEL = { fontSize:9, color:"#475569", marginBottom:5, letterSpacing:1 };

// ─── COMPOSANTS ──────────────────────────────────────────────────────────────
function Tab(props){
  return(
    <button onClick={props.onClick} style={{flex:1,padding:"10px 4px",background:props.active?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.active?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.06)"),borderRadius:8,color:props.active?"#93c5fd":"#475569",fontSize:10,letterSpacing:1,fontFamily:"'DM Mono',monospace",cursor:"pointer",fontWeight:props.active?600:400}}>
      {props.label}
    </button>
  );
}

// ─── TAB NOUVEAU TRADE (saisie manuelle) ─────────────────────────────────────
function TabTrade(props){
  return(
    <div>
      <div style={{...CARD, marginBottom: 14}}>
        <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:14,marginTop:0}}>ENREGISTRER UN TRADE — NASDAQ (NAS100)</p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <div style={LABEL}>DIRECTION</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <button onClick={function(){props.setTDir("LONG");}} style={{padding:"9px 4px",background:props.tDir==="LONG"?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.tDir==="LONG"?"rgba(34,197,94,0.5)":"rgba(255,255,255,0.1)"),borderRadius:8,color:props.tDir==="LONG"?"#22c55e":"#475569",fontSize:11,fontWeight:props.tDir==="LONG"?700:400,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>▲ LONG</button>
              <button onClick={function(){props.setTDir("SHORT");}} style={{padding:"9px 4px",background:props.tDir==="SHORT"?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.tDir==="SHORT"?"rgba(239,68,68,0.5)":"rgba(255,255,255,0.1)"),borderRadius:8,color:props.tDir==="SHORT"?"#ef4444":"#475569",fontSize:11,fontWeight:props.tDir==="SHORT"?700:400,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>▼ SHORT</button>
            </div>
          </div>
          <div>
            <div style={LABEL}>STATUT</div>
            <select value={props.tStatus} onChange={function(e){props.setTStatus(e.target.value);}} style={{...SEL,color:STATUS_COLOR[props.tStatus]||"#e2e8f0"}}>
              {Object.keys(STATUS_LABEL).map(function(k){return <option key={k} value={k}>{STATUS_LABEL[k]}</option>;})}
            </select>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <div style={LABEL}>PRIX D'ENTRÉE</div>
            <input type="number" step="0.01" placeholder="29500" value={props.tEntry} onChange={function(e){props.setTEntry(e.target.value);}} style={INP}/>
          </div>
          <div>
            <div style={LABEL}>SL (points)</div>
            <input type="number" placeholder="50" value={props.tSlPoints} onChange={function(e){props.setTSlPoints(e.target.value);}} style={INP}/>
          </div>
          <div>
            <div style={LABEL}>TP (points)</div>
            <input type="number" placeholder="100" value={props.tTpPoints} onChange={function(e){props.setTTpPoints(e.target.value);}} style={INP}/>
          </div>
        </div>

        <div style={{marginBottom:10}}>
          <div style={LABEL}>VOLUME (lots)</div>
          <input type="number" step="0.01" placeholder="Obligatoire" value={props.tVolume} onChange={function(e){props.setTVolume(e.target.value);}} style={INP}/>
        </div>

        <div style={{marginBottom:10}}>
          <div style={LABEL}>BE DÉCLENCHÉ ?</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <button onClick={function(){props.setTBe(false);}} style={{padding:"9px 4px",background:!props.tBe?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#64748b",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>NON</button>
            <button onClick={function(){props.setTBe(true);}} style={{padding:"9px 4px",background:props.tBe?"rgba(234,179,8,0.2)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.tBe?"rgba(234,179,8,0.5)":"rgba(255,255,255,0.1)"),borderRadius:8,color:props.tBe?"#eab308":"#475569",fontSize:11,fontWeight:props.tBe?700:400,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>OUI</button>
          </div>
        </div>

        <div style={{marginBottom:10}}>
          <div style={LABEL}>DATE / HEURE ENTRÉE</div>
          <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:6}}>
            <input type="date" value={props.tDateEntry} onChange={function(e){props.setTDateEntry(e.target.value);}} style={{...INP,colorScheme:"dark"}}/>
            <input type="time" value={props.tHeureEntry} onChange={function(e){props.setTHeureEntry(e.target.value);}} style={{...INP,colorScheme:"dark"}}/>
          </div>
        </div>

        <div style={{marginBottom:10}}>
          <div style={LABEL}>P&amp;L (€)</div>
          <input type="number" step="0.01" placeholder="Ex: 68.90 ou -36.70" value={props.tPnl} onChange={function(e){props.setTPnl(e.target.value);}} style={{...INP,color:parseFloat(props.tPnl)>0?"#22c55e":parseFloat(props.tPnl)<0?"#ef4444":"#e2e8f0",fontWeight:600}}/>
        </div>

        <div style={{marginBottom:12}}>
          <div style={LABEL}>COMMENTAIRE</div>
          <input type="text" placeholder="Note libre (optionnel)" value={props.tComment} onChange={function(e){props.setTComment(e.target.value);}} style={INP}/>
        </div>

        {props.err && <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#fca5a5"}}>⚠ {props.err}</div>}

        <div style={{display:"grid",gridTemplateColumns:props.editTrade?"1fr 1fr":"1fr",gap:8}}>
          <button onClick={props.onAdd} disabled={props.loading} style={{padding:11,background:props.editTrade?"rgba(234,179,8,0.2)":"rgba(59,130,246,0.2)",border:"1px solid "+(props.editTrade?"rgba(234,179,8,0.4)":"rgba(59,130,246,0.4)"),borderRadius:8,color:props.editTrade?"#fbbf24":"#93c5fd",fontSize:11,letterSpacing:1,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
            {props.loading?"⟳ SYNC...":props.editTrade?"✏ MODIFIER":"+ ENREGISTRER"}
          </button>
          {props.editTrade && <button onClick={props.onCancelEdit} style={{padding:11,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#64748b",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✕ ANNULER</button>}
        </div>
      </div>
    </div>
  );
}

// ─── TAB CAPITAL ─────────────────────────────────────────────────────────────
function TabCapital(props){
  var plTotal = props.capDepart ? props.capActuel - parseFloat(props.capDepart) : 0;
  var plPct = props.capDepart ? (plTotal / parseFloat(props.capDepart) * 100) : 0;
  return(
    <div>
      <div style={CARD}>
        <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:16,marginTop:0}}>CAPITAL &amp; GESTION DU RISQUE</p>
        <div style={{marginBottom:14}}>
          <div style={{...LABEL,marginBottom:6}}>CAPITAL DE DÉPART (EUR)</div>
          <div style={{display:"flex",gap:8}}>
            <input type="number" placeholder="Ex: 200" value={props.capDepart} onChange={function(e){props.setCapDepart(e.target.value);props.setCapSaved(false);}} style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid "+(props.capSaved?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.1)"),borderRadius:8,padding:"10px 12px",color:"#fff",fontSize:14,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
            <button onClick={props.onSaveCapital} style={{padding:"10px 14px",background:props.capSaved?"rgba(34,197,94,0.15)":"rgba(59,130,246,0.2)",border:"1px solid "+(props.capSaved?"rgba(34,197,94,0.4)":"rgba(59,130,246,0.4)"),borderRadius:8,color:props.capSaved?"#4ade80":"#93c5fd",fontSize:10,cursor:"pointer",fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{props.capSaved?"✓ SYNC":"☁ SYNC"}</button>
          </div>
        </div>
        <div style={{...LABEL,marginBottom:8}}>RISQUE PAR TRADE (%)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          {["0.5","1","1.5","2"].map(function(v){
            return(
              <button key={v} onClick={function(){props.setRsk(v);}} style={{padding:"8px",background:props.rsk===v?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.04)",border:"1px solid "+(props.rsk===v?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.08)"),borderRadius:8,color:props.rsk===v?"#93c5fd":"#64748b",fontSize:12,cursor:"pointer",fontWeight:props.rsk===v?600:400}}>{v}%</button>
            );
          })}
        </div>
      </div>
      {props.capDepart && props.capSaved && (
        <div>
          <div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:12,padding:20,marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:9,color:"#475569",letterSpacing:2,marginBottom:6}}>DÉPART</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:"#64748b"}}>{parseFloat(props.capDepart).toFixed(2)}</div>
                <div style={{fontSize:10,color:"#475569"}}>EUR</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:9,color:"#475569",letterSpacing:2,marginBottom:6}}>ACTUEL</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:plTotal>=0?"#22c55e":"#ef4444"}}>{props.capActuel.toFixed(2)}</div>
                <div style={{fontSize:10,color:"#475569"}}>EUR</div>
              </div>
            </div>
            <div style={{background:"rgba(0,0,0,0.2)",borderRadius:10,padding:14,marginBottom:14,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",letterSpacing:2,marginBottom:6}}>PERFORMANCE TOTALE</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,color:plTotal>=0?"#22c55e":"#ef4444"}}>{plTotal>=0?"+":""}{plTotal.toFixed(2)} €</div>
              <div style={{fontSize:12,color:plTotal>=0?"#22c55e":"#ef4444",marginTop:4}}>{plPct>=0?"+":""}{plPct.toFixed(2)}%</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#475569",marginBottom:4}}>LOT SUGGÉRÉ (SL 50pts)</div>
                <div style={{fontSize:13,color:"#3b82f6",fontWeight:700}}>{calcLot(props.capActuel,props.rsk,50)}</div>
              </div>
              <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#475569",marginBottom:4}}>RISQUE MAX / TRADE</div>
                <div style={{fontSize:13,color:"#ef4444",fontWeight:700}}>{(props.capActuel*parseFloat(props.rsk)/100).toFixed(2)}€</div>
              </div>
            </div>
          </div>
          {props.journal.length > 0 && (
            <div style={CARD}>
              <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:12,marginTop:0}}>COURBE DU CAPITAL</p>
              <div style={{display:"flex",alignItems:"flex-end",gap:3,height:60}}>
                {(function(){
                  var pts=[],cur=parseFloat(props.capDepart);
                  var trades=[...props.journal].reverse().slice(-20);
                  trades.forEach(function(t){cur+=tradePL(t);pts.push(cur);});
                  var mn=Math.min.apply(null,[parseFloat(props.capDepart)].concat(pts));
                  var mx=Math.max.apply(null,[parseFloat(props.capDepart)].concat(pts));
                  return pts.map(function(c,i){
                    var h=mx===mn?30:Math.max(4,Math.round(((c-mn)/(mx-mn))*56));
                    var prevC=i===0?parseFloat(props.capDepart):pts[i-1];
                    var col=c>=prevC?"#22c55e":"#ef4444";
                    return <div key={i} style={{flex:1,height:h+"px",background:col,borderRadius:2,opacity:0.7}}/>;
                  });
                })()}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#334155",marginTop:4}}>
                <span>{"← "+Math.min(props.journal.length,20)+" derniers trades"}</span>
                <span>Aujourd'hui →</span>
              </div>
            </div>
          )}
        </div>
      )}
      {(!props.capDepart || !props.capSaved) && <div style={{textAlign:"center",padding:40,color:"#334155",fontSize:12}}>{props.capDepart?"Clique sur ☁ SYNC pour sauvegarder.":"Saisis ton capital de départ."}</div>}
    </div>
  );
}

// ─── TAB JOURNAL ─────────────────────────────────────────────────────────────
function TabJournal(props){
  var closed = props.journal.filter(function(t){ return t.status !== "OPEN"; });
  var wins = closed.filter(function(t){ return t.status === "CLOSED_TP"; }).length;
  var losses = closed.filter(function(t){ return t.status === "CLOSED_SL"; }).length;
  var be = closed.filter(function(t){ return t.status === "CLOSED_BE"; }).length;
  var total = wins + losses;
  var wr = total ? Math.round(wins / total * 100) : 0;
  var plTotal = props.journal.reduce(function(a,t){ return a + tradePL(t); }, 0);
  var open = props.journal.filter(function(t){ return t.status === "OPEN"; }).length;

  return(
    <div>
      {props.journal.length > 0 && (
        <div style={CARD}>
          <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:12,marginTop:0}}>STATISTIQUES</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>TRADES</div>
              <div style={{fontSize:16,color:"#e2e8f0",fontWeight:700}}>{props.journal.length}</div>
            </div>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>WIN RATE</div>
              <div style={{fontSize:16,color:wr>=50?"#22c55e":"#ef4444",fontWeight:700}}>{total?wr+"%":"—"}</div>
            </div>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>P&amp;L TOTAL</div>
              <div style={{fontSize:14,color:plTotal>=0?"#22c55e":"#ef4444",fontWeight:700}}>{plTotal>=0?"+":""}{plTotal.toFixed(2)}€</div>
            </div>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>EN COURS</div>
              <div style={{fontSize:16,color:"#3b82f6",fontWeight:700}}>{open}</div>
            </div>
          </div>
        </div>
      )}
      {props.journal.length > 0 ? (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <p style={{fontSize:10,letterSpacing:2,color:"#475569",margin:0}}>HISTORIQUE</p>
            <button onClick={function(){
              var headers=["symbol","direction","source","entry_time","entry_price","sl_price","tp_price","sl_points","tp_points","volume","status","be_triggered","exit_time","exit_price","pnl","comment"];
              var rows=props.journal.map(function(t){
                return headers.map(function(h){
                  var v=t[h];
                  if(v===null||v===undefined)return "";
                  if(typeof v==="string"&&v.includes(","))return '"'+v+'"';
                  return v;
                }).join(",");
              });
              var csv=[headers.join(",")].concat(rows).join("\n");
              var blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
              var url=URL.createObjectURL(blob);
              var a=document.createElement("a");
              a.href=url;
              a.download="trades_nasdaq_"+new Date().toISOString().slice(0,10)+".csv";
              a.click();
              URL.revokeObjectURL(url);
            }} style={{padding:"5px 12px",background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:7,color:"#93c5fd",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:1}}>
              ↓ CSV
            </button>
          </div>
          {props.journal.map(function(t){
            var pl = tradePL(t);
            var dureeMin = calcDureeMinutes(t.entry_time, t.exit_time);
            var entryDate = t.entry_time ? t.entry_time.slice(0,10) : "";
            var entryHeure = t.entry_time ? t.entry_time.slice(11,16) : "";
            return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"9px 10px",marginBottom:8,flexWrap:"wrap"}}>
                <span style={{fontSize:9,color:t.source==="auto"?"#3b82f6":"#94a3b8"}}>{t.source==="auto"?"🤖":"✍️"}</span>
                <span style={{fontSize:9,color:"#64748b"}}>{t.symbol}</span>
                <span style={{fontSize:10,color:t.direction==="LONG"?"#22c55e":"#ef4444"}}>{t.direction==="LONG"?"▲":"▼"}</span>
                <span style={{fontSize:9,fontWeight:700,color:STATUS_COLOR[t.status]}}>{STATUS_LABEL[t.status]}</span>
                {t.be_triggered && <span style={{fontSize:8,color:"#eab308",background:"rgba(234,179,8,0.1)",borderRadius:4,padding:"1px 5px"}}>BE</span>}
                <span style={{fontSize:9,color:"#334155",flex:1}}>{entryDate} {entryHeure}</span>
                {dureeMin && <span style={{fontSize:9,color:dureeMin<=30?"#22c55e":dureeMin<=120?"#eab308":"#ef4444"}}>⏱{formatDuree(dureeMin)}</span>}
                <span style={{fontSize:9,color:"#475569"}}>{t.volume}L</span>
                <span style={{fontSize:11,fontWeight:700,color:pl>=0?"#22c55e":"#ef4444"}}>{pl!==0?(pl>=0?"+":"")+pl.toFixed(2)+"€":"—"}</span>
                <span onClick={function(){props.startEdit(t);props.setTab("signal");window.scrollTo(0,0);}} style={{cursor:"pointer",opacity:0.5,fontSize:12,color:"#fbbf24",marginRight:4}}>✏</span>
                <span onClick={function(){props.onDel(t.id);}} style={{cursor:"pointer",opacity:0.4,fontSize:12,color:"#94a3b8"}}>✕</span>
              </div>
            );
          })}
        </div>
      ) : <div style={{textAlign:"center",padding:40,color:"#334155",fontSize:12}}>Aucun trade enregistré.</div>}
    </div>
  );
}

// ─── TAB CALENDRIER ──────────────────────────────────────────────────────────
function TabCal(props){
  var now = new Date();
  var [yr,setYr] = useState(now.getFullYear());
  var [mo,setMo] = useState(now.getMonth());
  var [sel,setSel] = useState(null);

  function dayKey(t){ return t.entry_time ? t.entry_time.slice(0,10) : null; }
  var byDay = {};
  props.journal.forEach(function(t){ var d=dayKey(t); if(!d)return; if(!byDay[d])byDay[d]=[]; byDay[d].push(t); });
  function dayPL(d){ return (byDay[d]||[]).reduce(function(a,t){ return a+tradePL(t); },0); }

  var mStr=String(mo+1).padStart(2,"0"), prefix=yr+"-"+mStr;
  var fd=new Date(yr,mo,1).getDay(), dim=new Date(yr,mo+1,0).getDate(), off=fd===0?6:fd-1;
  var cells=[]; for(var i=0;i<off;i++)cells.push(null); for(var d=1;d<=dim;d++)cells.push(d);
  function prev(){ if(mo===0){setMo(11);setYr(function(y){return y-1;});}else setMo(function(m){return m-1;}); setSel(null); }
  function next(){ if(mo===11){setMo(0);setYr(function(y){return y+1;});}else setMo(function(m){return m+1;}); setSel(null); }

  var mDates = Object.keys(byDay).filter(function(dd){ return dd.startsWith(prefix); });
  var plMois = parseFloat(mDates.reduce(function(a,dd){ return a+dayPL(dd); },0).toFixed(2));
  var trMois = mDates.reduce(function(a,dd){ return a+(byDay[dd]||[]).length; },0);
  var winMois = mDates.reduce(function(a,dd){ return a+(byDay[dd]||[]).filter(function(t){return t.status==="CLOSED_TP";}).length; },0);
  var lossMois = mDates.reduce(function(a,dd){ return a+(byDay[dd]||[]).filter(function(t){return t.status==="CLOSED_SL";}).length; },0);
  var totalWL = winMois+lossMois;
  var wrMois = totalWL ? Math.round(winMois/totalWL*100) : 0;

  var selDate = sel ? yr+"-"+mStr+"-"+String(sel).padStart(2,"0") : null;
  var selTrades = selDate ? (byDay[selDate]||[]) : [];
  var selPL = selDate ? dayPL(selDate) : 0;

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[{l:"TRADES",v:String(trMois),c:"#e2e8f0"},{l:"P&L MOIS",v:(plMois>=0?"+":"")+plMois.toFixed(2)+"€",c:plMois>=0?"#22c55e":"#ef4444"},{l:"WIN RATE",v:totalWL?wrMois+"%":"—",c:wrMois>=50?"#22c55e":"#ef4444"},{l:"WIN/LOSS",v:winMois+"/"+lossMois,c:"#22c55e"}].map(function(x){
          return(
            <div key={x.l} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
              <div style={{fontSize:13,fontWeight:700,color:x.c,marginBottom:3}}>{x.v}</div>
              <div style={{fontSize:8,color:"#475569",letterSpacing:1}}>{x.l}</div>
            </div>
          );
        })}
      </div>

      <div style={CARD}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button onClick={prev} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 14px",color:"#94a3b8",cursor:"pointer",fontSize:16}}>‹</button>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#fff",letterSpacing:2}}>{MOIS[mo]} {yr}</span>
          <button onClick={next} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 14px",color:"#94a3b8",cursor:"pointer",fontSize:16}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
          {["L","M","M","J","V","S","D"].map(function(dd,i){return <div key={i} style={{textAlign:"center",fontSize:9,color:i>=5?"#ef4444":"#475569",padding:"3px 0"}}>{dd}</div>;})}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {cells.map(function(day,i){
            if(!day) return <div key={i}/>;
            var ds=yr+"-"+mStr+"-"+String(day).padStart(2,"0");
            var tr=byDay[ds]||[], pl=tr.length?dayPL(ds):null;
            var isT=ds===TODAY, isS=day===sel, isW=(i%7)>=5;
            var bg=isS?"rgba(59,130,246,0.2)":pl!==null?(pl>=0?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)"):"rgba(255,255,255,0.02)";
            var bd=isS?"rgba(59,130,246,0.5)":isT?"rgba(59,130,246,0.3)":pl!==null?(pl>=0?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.2)"):"rgba(255,255,255,0.04)";
            return(
              <div key={i} onClick={function(){setSel(day===sel?null:day);}} style={{minHeight:46,borderRadius:7,padding:4,cursor:tr.length?"pointer":"default",background:bg,border:"1px solid "+bd}}>
                <div style={{fontSize:10,color:isT?"#3b82f6":isW?"#94a3b8":"#64748b",fontWeight:isT?700:400}}>{day}</div>
                {pl!==null && <div style={{fontSize:9,color:pl>=0?"#22c55e":"#ef4444",fontWeight:600}}>{pl>=0?"+":""}{pl.toFixed(1)}€</div>}
                {pl!==null && <div style={{fontSize:8,color:"#334155"}}>{tr.length}T</div>}
              </div>
            );
          })}
        </div>
      </div>

      {sel && selTrades.length > 0 && (
        <div style={CARD}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:11,color:"#94a3b8"}}>{sel} {MOIS[mo]} {yr}</span>
            <span style={{fontSize:14,fontWeight:700,color:selPL>=0?"#22c55e":"#ef4444"}}>{selPL>=0?"+":""}{selPL.toFixed(2)}€</span>
          </div>
          {selTrades.map(function(t){
            var pl = tradePL(t);
            var heure = t.entry_time ? t.entry_time.slice(11,16) : "";
            return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                <span style={{fontSize:10,fontWeight:600,color:STATUS_COLOR[t.status]}}>{STATUS_LABEL[t.status]}</span>
                <span style={{fontSize:9,color:"#94a3b8"}}>{heure}</span>
                <span style={{fontSize:9,color:t.direction==="LONG"?"#22c55e":"#ef4444"}}>{t.direction==="LONG"?"▲":"▼"}</span>
                <span style={{fontSize:9,color:"#475569",flex:1}}>{t.symbol}</span>
                <span style={{fontSize:11,fontWeight:700,color:pl>=0?"#22c55e":"#ef4444"}}>{pl!==0?(pl>=0?"+":"")+pl.toFixed(2)+"€":"—"}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{display:"flex",gap:16,justifyContent:"center",fontSize:9,color:"#475569",marginTop:4}}>
        <span><span style={{color:"#22c55e"}}>■</span> Positif</span>
        <span><span style={{color:"#ef4444"}}>■</span> Négatif</span>
        <span><span style={{color:"#3b82f6"}}>■</span> Aujourd'hui</span>
      </div>
    </div>
  );
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function App(){
  var [tab,setTab] = useState("signal");

  var [tDir,setTDir] = useState("");
  var [tStatus,setTStatus] = useState("OPEN");
  var [tEntry,setTEntry] = useState("");
  var [tSlPoints,setTSlPoints] = useState("50");
  var [tTpPoints,setTTpPoints] = useState("100");
  var [tVolume,setTVolume] = useState("");
  var [tBe,setTBe] = useState(false);
  var [tDateEntry,setTDateEntry] = useState(TODAY);
  var [tHeureEntry,setTHeureEntry] = useState(gn);
  var [tPnl,setTPnl] = useState("");
  var [tComment,setTComment] = useState("");

  var [err,setErr] = useState("");
  var [editTrade,setEditTrade] = useState(null);
  var [loading,setLoading] = useState(false);
  var [initializing,setInitializing] = useState(true);

  var [capDepart,setCapDepart] = useState("");
  var [capSaved,setCapSaved] = useState(false);
  var [capId,setCapId] = useState(null);
  var [rsk,setRsk] = useState("1");
  var [journal,setJournal] = useState([]);

  var capActuel = capDepart && capSaved ? capCourant(capDepart, journal) : 0;
  var plTotal = capDepart && capSaved ? capActuel - parseFloat(capDepart) : 0;

  useEffect(function(){
    async function init(){
      try {
        var caps = await sbGet("capital","limit=1");
        if(caps && caps.length>0){
          var cap = caps[0];
          setCapDepart(String(cap.capital_depart||""));
          setRsk(cap.risque||"1");
          setCapId(cap.id);
          setCapSaved(true);
        }
        var trades = await sbGet("trades","");
        if(trades) setJournal(trades);
      } catch(e){ console.error(e); }
      setInitializing(false);
    }
    init();
  },[]);

  async function onSaveCapital(){
    if(!capDepart || parseFloat(capDepart)<=0){ setErr("Capital invalide."); return; }
    var data = { capital_depart: parseFloat(capDepart), risque: rsk, updated_at: new Date().toISOString() };
    try {
      if(capId){ await sbUpdate("capital",capId,data); }
      else { var n = await sbInsert("capital",data); if(n) setCapId(n.id); }
      setCapSaved(true);
    } catch(e){ setErr("Erreur synchronisation capital."); }
  }

  function resetForm(){
    setTDir("");setTStatus("OPEN");setTEntry("");setTSlPoints("50");setTTpPoints("100");
    setTVolume("");setTBe(false);setTDateEntry(TODAY);setTHeureEntry(gn());
    setTPnl("");setTComment("");
    setEditTrade(null);
  }

  async function onAdd(){
    if(!tDir){ setErr("Choisis une direction."); return; }
    if(!tEntry){ setErr("Renseigne le prix d'entrée."); return; }
    setErr("");

    if(!tVolume){ setErr("Renseigne le volume."); return; }

    var entryPrice = parseFloat(tEntry);
    var slPts = parseFloat(tSlPoints) || 50;
    var tpPts = parseFloat(tTpPoints) || 100;
    var slPrice = tDir==="LONG" ? entryPrice - slPts : entryPrice + slPts;
    var tpPrice = tDir==="LONG" ? entryPrice + tpPts : entryPrice - tpPts;
    var volume = parseFloat(tVolume);

    var entryTime = tDateEntry + "T" + (tHeureEntry||"00:00") + ":00";

    var data = {
      symbol: "NAS100",
      direction: tDir,
      source: "manual",
      entry_time: entryTime,
      entry_price: entryPrice,
      sl_price: slPrice,
      tp_price: tpPrice,
      sl_points: slPts,
      tp_points: tpPts,
      volume: volume,
      risk_percent: parseFloat(rsk) || null,
      account_balance_before: capSaved ? capActuel : null,
      be_triggered: tBe,
      status: tStatus,
      exit_time: null,
      exit_price: null,
      pnl: tPnl !== "" ? parseFloat(tPnl) : null,
      comment: tComment || null
    };

    setLoading(true);
    try {
      if(editTrade){
        await sbUpdate("trades", editTrade, data);
        var updated = await sbGet("trades","");
        if(updated) setJournal(updated);
      } else {
        var n = await sbInsert("trades", data);
        if(n) setJournal(function(j){ return [n].concat(j); });
      }
      resetForm();
    } catch(e){ setErr("Erreur lors de l'enregistrement."); }
    setLoading(false);
  }

  function startEdit(t){
    setTDir(t.direction||"");
    setTStatus(t.status||"OPEN");
    setTEntry(t.entry_price!=null?String(t.entry_price):"");
    setTSlPoints(t.sl_points!=null?String(t.sl_points):"50");
    setTTpPoints(t.tp_points!=null?String(t.tp_points):"100");
    setTVolume(t.volume!=null?String(t.volume):"");
    setTBe(!!t.be_triggered);
    if(t.entry_time){ setTDateEntry(t.entry_time.slice(0,10)); setTHeureEntry(t.entry_time.slice(11,16)); }
    setTPnl(t.pnl!=null?String(t.pnl):"");
    setTComment(t.comment||"");
    setEditTrade(t.id);
    setTab("signal");
    window.scrollTo(0,0);
  }

  async function onDel(id){
    await sbDelete("trades", id);
    setJournal(function(j){ return j.filter(function(t){ return t.id!==id; }); });
  }

  if(initializing){
    return(
      <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:3,color:"#3b82f6",textAlign:"center"}}>NASDAQ REVERSAL</div>
        <div style={{fontSize:11,color:"#475569",letterSpacing:2}}>☁ CONNEXION SUPABASE...</div>
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'DM Mono','Courier New',monospace",color:"#e2e8f0",padding:"18px 14px",backgroundImage:"radial-gradient(ellipse at 20% 0%,rgba(59,130,246,.06) 0%,transparent 60%)"}}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}"}</style>

      <div style={{maxWidth:640,margin:"0 auto 14px"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:4,flexWrap:"wrap"}}>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:3,color:"#fff"}}>NASDAQ REVERSAL</span>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:3,color:"#3b82f6"}}>M1</span>
        </div>
        <div style={{height:1,background:"linear-gradient(90deg,#3b82f6,transparent)",marginBottom:5}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:9,color:"#334155"}}>NAS100 · 15h30 Paris · RR 1:2 · IC MARKETS DÉMO</span>
          {capDepart && capSaved && (
            <span style={{fontSize:10,fontWeight:600,color:plTotal>=0?"#22c55e":"#ef4444"}}>
              {capActuel.toFixed(2)}€ {plTotal>=0?"▲":"▼"} {plTotal>=0?"+":""}{plTotal.toFixed(2)}€
            </span>
          )}
        </div>
      </div>

      <div style={{maxWidth:640,margin:"0 auto 14px",display:"flex",gap:5}}>
        <Tab label="TRADE" active={tab==="signal"} onClick={function(){setTab("signal");}}/>
        <Tab label="CAPITAL" active={tab==="lot"} onClick={function(){setTab("lot");}}/>
        <Tab label="JOURNAL" active={tab==="journal"} onClick={function(){setTab("journal");}}/>
        <Tab label="CALENDRIER" active={tab==="cal"} onClick={function(){setTab("cal");}}/>
      </div>

      <div style={{maxWidth:640,margin:"0 auto"}}>
        {tab==="signal" && <TabTrade
          tDir={tDir} setTDir={setTDir}
          tStatus={tStatus} setTStatus={setTStatus}
          tEntry={tEntry} setTEntry={setTEntry}
          tSlPoints={tSlPoints} setTSlPoints={setTSlPoints}
          tTpPoints={tTpPoints} setTTpPoints={setTTpPoints}
          tVolume={tVolume} setTVolume={setTVolume}
          tBe={tBe} setTBe={setTBe}
          tDateEntry={tDateEntry} setTDateEntry={setTDateEntry}
          tHeureEntry={tHeureEntry} setTHeureEntry={setTHeureEntry}
          tPnl={tPnl} setTPnl={setTPnl}
          tComment={tComment} setTComment={setTComment}
          capDepart={capDepart} capSaved={capSaved} capActuel={capActuel} rsk={rsk}
          err={err} editTrade={editTrade} onCancelEdit={resetForm}
          onAdd={onAdd} loading={loading}
        />}
        {tab==="lot" && <TabCapital capDepart={capDepart} setCapDepart={setCapDepart} capSaved={capSaved} setCapSaved={setCapSaved} capActuel={capActuel} rsk={rsk} setRsk={setRsk} journal={journal} onSaveCapital={onSaveCapital}/>}
        {tab==="journal" && <TabJournal journal={journal} setTab={setTab} startEdit={startEdit} onDel={onDel}/>}
        {tab==="cal" && <TabCal journal={journal}/>}
        <p style={{textAlign:"center",fontSize:9,color:"#1e293b",marginTop:24}}>NASDAQ REVERSAL · M1 · IC MARKETS · ☁ SUPABASE</p>
      </div>
    </div>
  );
}
