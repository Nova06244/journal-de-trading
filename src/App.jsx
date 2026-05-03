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
const LC = { R2:"#ef4444", R1:"#f97316", PP:"#eab308", S1:"#22c55e", S2:"#3b82f6" };
const CC = { FORTE:"#22c55e", MOYENNE:"#eab308", FAIBLE:"#ef4444" };
const TODAY = new Date().toISOString().slice(0,10);
const SLP = 0.0010;
const TPP = 0.0020;
const MOIS = ["Janv","Févr","Mars","Avr","Mai","Juin","Juil","Août","Sept","Oct","Nov","Déc"];

function gn(){const n=new Date();return String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");}
function fv(h){const p=h.split(":").map(Number),m=p[0]*60+p[1];return(m>=510&&m<=720)||(m>=810&&m<=930);}
function calcLot(cap,rsk){const l=Math.floor(((cap*rsk/100)/(SLP*10000*10))*100)/100;return Math.max(0.01,l);}
function tradePL(t){
  var comm=parseFloat(t.commission)||0;
  if(t.gain!==undefined&&t.gain!==null&&t.gain!==""&&!isNaN(parseFloat(t.gain))) return parseFloat((parseFloat(t.gain)+comm).toFixed(2));
  const l=parseFloat(t.lot)||0.01;
  if(t.resultat==="WIN") return parseFloat((TPP*10000*l*10+comm).toFixed(2));
  return parseFloat((-(SLP*10000*l*10)+comm).toFixed(2));
}
function capCourant(capD,journal){return journal.reduce(function(acc,t){return acc+tradePL(t);},parseFloat(capD)||0);}

// ─── ANALYSE ─────────────────────────────────────────────────────────────────
function buildSc(niv,val,dir,tpv,tpn,mode){
  const e=mode==="limite"?val:(dir==="LONG"?val+0.00002:val-0.00002);
  const sl=dir==="LONG"?val-SLP:val+SLP;
  const tp=dir==="LONG"?e+TPP:e-TPP;
  const ok=tpv?(dir==="LONG"?tp<=tpv:tp>=tpv):true;
  const ord=mode==="limite"?(dir==="LONG"?"BUY LIMIT":"SELL LIMIT"):(dir==="LONG"?"BUY marché":"SELL marché");
  return {niv,val:val.toFixed(5),dir,e:e.toFixed(5),sl:sl.toFixed(5),tp:tp.toFixed(5),tpn,tpv:tpv?tpv.toFixed(5):null,ok,ord};
}

function doAnalyse(price,pp,r1,r2,s1,s2,heure,mode){
  var p=parseFloat(price)||0;
  var vPP=parseFloat(pp),vR1=parseFloat(r1),vR2=parseFloat(r2),vS1=parseFloat(s1),vS2=parseFloat(s2);
  var fen=fv(heure),dPP=p>=vPP?"LONG":"SHORT";
  var all=[
    buildSc("R2",vR2,"SHORT",vR1,"R1",mode),
    buildSc("R1",vR1,"SHORT",vPP,"PP",mode),
    buildSc("PP",vPP,dPP,dPP==="LONG"?vR1:vS1,dPP==="LONG"?"R1":"S1",mode),
    buildSc("S1",vS1,"LONG",vPP,"PP",mode),
    buildSc("S2",vS2,"LONG",vS1,"S1",mode),
  ];
  var nv={R2:vR2,R1:vR1,PP:vPP,S1:vS1,S2:vS2};
  var cn=null,md=Infinity;
  Object.keys(nv).forEach(function(k){var d=Math.abs(p-nv[k]);if(d<md){md=d;cn=k;}});
  var dp=Math.round(md*10000),sur=md<=0.00150;
  var ms=all.find(function(s){return s.niv===cn;});
  var sig,conf,anl,csl;
  if(mode==="limite"){
    var nb=all.filter(function(s){return s.ok;}).length;
    sig="ORDRES DU JOUR";conf=fen?"FORTE":"MOYENNE";
    anl=nb+" ordre(s) valide(s). RR 1:2. Annule les ordres non déclenchés en fin de session.";
    csl=fen?"Place les ordres sur ICMarkets dès l'ouverture de Londres.":"⚠ Hors fenêtre.";
  } else if(sur&&ms){
    sig=ms.ok?ms.dir:"NO TRADE";conf=!ms.ok?"FAIBLE":(fen?"FORTE":"MOYENNE");
    anl=ms.ok?"Prix sur "+cn+". Rebond "+ms.dir+". SL 10p TP 20p RR 1:2.":"TP dépasse "+ms.tpn+". Trade invalide.";
    csl=ms.ok?"Attendre confirmation M15 sur "+cn+(fen?".":" ⚠ Hors fenêtre."):"Ne pas prendre.";
  } else {
    sig="NO TRADE";conf="FAIBLE";anl="Zone neutre à "+dp+" pips de "+cn+".";csl="Attendre l'approche de "+cn+" ("+nv[cn].toFixed(5)+").";
  }
  all.sort(function(a,b){return Math.abs(p-parseFloat(a.val))-Math.abs(p-parseFloat(b.val));});
  return {sig,conf,anl,csl,fen,dp,cn,sur,all,mode};
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
var BG="#0a0e1a";
var CARD={background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:16,marginBottom:14};
var INP={background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"9px 10px",color:"#e2e8f0",fontSize:12,fontFamily:"'DM Mono',monospace",outline:"none",width:"100%"};
var SEL={background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px",fontSize:12,fontFamily:"'DM Mono',monospace",outline:"none",width:"100%"};

// ─── COMPOSANTS ──────────────────────────────────────────────────────────────
function Tab(props){
  return(
    <button onClick={props.onClick} style={{flex:1,padding:"8px 2px",background:props.active?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.active?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.06)"),borderRadius:8,color:props.active?"#93c5fd":"#475569",fontSize:9,letterSpacing:1,fontFamily:"'DM Mono',monospace",cursor:"pointer",fontWeight:props.active?600:400}}>
      {props.label}
    </button>
  );
}

function SCard(props){
  var sc=props.sc,dc=sc.dir==="LONG"?"#22c55e":"#ef4444";
  var lbl=props.mode==="limite"?(sc.dir==="LONG"?"BUY LMT":"SELL LMT"):"PE";
  return(
    <div style={{background:props.cur?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.02)",border:"1px solid "+(sc.ok?(props.cur?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)"):"rgba(239,68,68,0.2)"),borderRadius:10,padding:14,marginBottom:10,opacity:sc.ok?1:0.35}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,fontWeight:600,color:LC[sc.niv]}}>{sc.niv}</span>
          <span style={{fontSize:11,color:"#64748b"}}>{sc.val}</span>
          {!sc.ok&&<span style={{fontSize:9,background:"rgba(239,68,68,0.15)",color:"#ef4444",padding:"2px 6px",borderRadius:4}}>INVALIDE</span>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <span style={{fontSize:10,color:dc,fontWeight:700}}>{sc.dir==="LONG"?"▲":"▼"} {sc.dir}</span>
          <span style={{fontSize:10,color:"#22c55e",fontWeight:600}}>RR 1:2</span>
        </div>
      </div>
      {props.mode==="limite"&&sc.ok&&(
        <div style={{background:sc.dir==="LONG"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",border:"1px solid "+(sc.dir==="LONG"?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"),borderRadius:6,padding:"6px 12px",marginBottom:10}}>
          <span style={{fontSize:12,fontWeight:700,color:dc,letterSpacing:1}}>{sc.ord}</span>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
        {[{l:lbl,v:sc.e,c:"#e2e8f0"},{l:"SL",v:sc.sl,c:"#ef4444"},{l:"TP",v:sc.tp,c:"#22c55e"}].map(function(x){
          return(
            <div key={x.l} style={{background:"rgba(0,0,0,0.25)",borderRadius:6,padding:8,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:3}}>{x.l}</div>
              <div style={{fontSize:11,color:x.c,fontWeight:600}}>{x.v}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#334155"}}>
        <span>{"SL 10p · TP 20p"+(props.lot?" · "+props.lot+" lot":"")}</span>
        {sc.tpv&&<span>{sc.tpn} {sc.tpv} {sc.ok?"✓":"✗"}</span>}
      </div>
    </div>
  );
}

// ─── TAB SIGNAL ──────────────────────────────────────────────────────────────
function TabSignal(props){
  var isLim=props.mode==="limite";
  var res=props.res;
  var sigC=!res?"#94a3b8":res.sig==="LONG"?"#22c55e":res.sig==="SHORT"?"#ef4444":isLim?"#3b82f6":"#94a3b8";
  var sigB=!res?"transparent":res.sig==="LONG"?"rgba(34,197,94,0.10)":res.sig==="SHORT"?"rgba(239,68,68,0.10)":isLim?"rgba(59,130,246,0.08)":"rgba(148,163,184,0.07)";
  return(
    <div>
      {/* Mode toggle */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        <button onClick={function(){props.setMode("confirmation");props.setRes(null);}} style={{background:props.mode==="confirmation"?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.mode==="confirmation"?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.06)"),borderRadius:10,padding:"10px 8px",color:props.mode==="confirmation"?"#93c5fd":"#475569",cursor:"pointer",textAlign:"center"}}>
          <div style={{fontSize:10,fontWeight:600,marginBottom:2}}>📊 CONFIRMATION M15</div>
          <div style={{fontSize:9,color:"#64748b"}}>Tu surveilles</div>
        </button>
        <button onClick={function(){props.setMode("limite");props.setRes(null);}} style={{background:props.mode==="limite"?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.mode==="limite"?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.06)"),borderRadius:10,padding:"10px 8px",color:props.mode==="limite"?"#93c5fd":"#475569",cursor:"pointer",textAlign:"center"}}>
          <div style={{fontSize:10,fontWeight:600,marginBottom:2}}>⏰ ORDRES LIMITES</div>
          <div style={{fontSize:9,color:"#64748b"}}>Mode passif</div>
        </button>
      </div>

      {/* Statut sauvegarde */}
      {props.syncOk&&<div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:8,padding:"7px 14px",marginBottom:12,fontSize:11,color:"#4ade80"}}>✓ Niveaux synchronisés — Supabase</div>}
      {props.syncErr&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"7px 14px",marginBottom:12,fontSize:11,color:"#fca5a5"}}>⚠ Erreur de synchronisation</div>}

      {/* Pivots */}
      <div style={CARD}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:10,letterSpacing:2,color:"#475569"}}>NIVEAUX PIVOTS DAILY</span>
          <button onClick={props.onSave} style={{background:props.smsg?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.05)",border:"1px solid "+(props.smsg?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.1)"),borderRadius:6,padding:"4px 10px",color:props.smsg?"#4ade80":"#94a3b8",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>{props.smsg||"☁ SYNC"}</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{l:"R2",v:props.r2,s:props.setR2},{l:"R1",v:props.r1,s:props.setR1},{l:"PP",v:props.pp,s:props.setPp},{l:"S1",v:props.s1,s:props.setS1},{l:"S2",v:props.s2,s:props.setS2}].map(function(x){
            return(
              <div key={x.l} style={{position:"relative"}}>
                <div style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:10,fontWeight:600,color:LC[x.l]}}>{x.l}</div>
                <input type="number" step="0.00001" placeholder="1.XXXXX" value={x.v} onChange={function(e){x.s(e.target.value);}} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid "+LC[x.l]+"33",borderRadius:8,padding:"9px 8px 9px 36px",color:"#e2e8f0",fontSize:12,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
              </div>
            );
          })}
          {!isLim&&(
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:9,color:"#94a3b8"}}>NOW</div>
              <input type="number" step="0.00001" placeholder="Prix actuel" value={props.price} onChange={function(e){props.setPrice(e.target.value);}} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"9px 8px 9px 36px",color:"#fff",fontSize:12,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
            </div>
          )}
        </div>
      </div>

      {/* Heure + contexte */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10,marginBottom:12}}>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:9,color:"#475569"}}>HEURE</span>
            <span style={{fontSize:9,color:props.hauto?"#22c55e":"#f97316",cursor:"pointer"}} onClick={props.resetHeure}>{props.hauto?"● AUTO":"↺ RESET"}</span>
          </div>
          <input type="time" value={props.heure} onChange={function(e){props.setHeure(e.target.value);props.setHauto(false);}} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid "+(props.hauto?"rgba(34,197,94,0.25)":"rgba(255,165,0,0.3)"),borderRadius:8,padding:8,color:"#e2e8f0",fontSize:13,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
        </div>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:12}}>
          <div style={{fontSize:9,color:"#475569",marginBottom:6}}>CONTEXTE</div>
          <textarea placeholder="Biais H1, contexte macro..." value={props.ctx} onChange={function(e){props.setCtx(e.target.value);}} rows={2} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:8,color:"#e2e8f0",fontSize:11,resize:"none",fontFamily:"'DM Mono',monospace",outline:"none"}}/>
        </div>
      </div>

      {props.err&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#fca5a5"}}>⚠ {props.err}</div>}

      <button onClick={props.onAnalyse} style={{width:"100%",padding:13,background:isLim?"#1d4ed8":"#3b82f6",border:"none",borderRadius:10,color:"#fff",fontSize:12,letterSpacing:2,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace",marginBottom:16}}>
        {isLim?"⏰ GÉNÉRER LES ORDRES LIMITES":"→ ANALYSER LE SETUP"}
      </button>

      {res&&(
        <div>
          <div style={{background:sigB,border:"1px solid "+sigC+"44",borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22,color:sigC}}>{res.sig==="LONG"?"▲":res.sig==="SHORT"?"▼":isLim?"⏰":"◆"}</span>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:sigC,letterSpacing:2}}>{res.sig}</div>
                  {!isLim&&<div style={{fontSize:9,color:"#64748b"}}>{res.cn} · {res.dp} pips</div>}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:9,color:"#64748b",marginBottom:3}}>CONFIANCE</div>
                <div style={{fontSize:12,fontWeight:600,color:CC[res.conf]||"#94a3b8"}}>{res.conf}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              <span style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:6,padding:"5px 10px",fontSize:10,color:"#22c55e",fontWeight:600}}>RR 1:2 · SL 10 · TP 20</span>
              <span style={{background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"5px 10px",fontSize:10,color:res.fen?"#22c55e":"#f97316"}}>{res.fen?"✓ Fenêtre valide":"⚠ Hors fenêtre"}</span>
              {props.lot&&<span style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:6,padding:"5px 10px",fontSize:10,color:"#93c5fd"}}>Lot : {props.lot}</span>}
            </div>
            <p style={{fontSize:11,color:"#94a3b8",lineHeight:1.6,margin:"0 0 10px"}}>{res.anl}</p>
            <div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:8,padding:"8px 12px"}}>
              <span style={{fontSize:10,color:"#3b82f6"}}>→ </span>
              <span style={{fontSize:11,color:"#93c5fd"}}>{res.csl}</span>
            </div>
          </div>
          <p style={{fontSize:9,color:"#475569",letterSpacing:2,marginBottom:10}}>{isLim?"ORDRES À PLACER":"SCÉNARIOS DU JOUR"}</p>
          {res.all.map(function(s){return <SCard key={s.niv} sc={s} cur={s.niv===res.cn} mode={props.mode} lot={props.lot}/>;} )}
        </div>
      )}
    </div>
  );
}

// ─── TAB CAPITAL ─────────────────────────────────────────────────────────────
function TabCapital(props){
  var plTotal=props.capDepart?props.capActuel-parseFloat(props.capDepart):0;
  var plPct=props.capDepart?(plTotal/parseFloat(props.capDepart)*100):0;
  return(
    <div>
      <div style={CARD}>
        <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:16,marginTop:0}}>CAPITAL & GESTION DU RISQUE</p>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:"#475569",marginBottom:6}}>CAPITAL DE DÉPART (EUR)</div>
          <div style={{display:"flex",gap:8}}>
            <input type="number" placeholder="Ex: 1000" value={props.capDepart} onChange={function(e){props.setCapDepart(e.target.value);props.setCapSaved(false);}} style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid "+(props.capSaved?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.1)"),borderRadius:8,padding:"10px 12px",color:"#fff",fontSize:14,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
            <button onClick={props.onSaveCapital} style={{padding:"10px 14px",background:props.capSaved?"rgba(34,197,94,0.15)":"rgba(59,130,246,0.2)",border:"1px solid "+(props.capSaved?"rgba(34,197,94,0.4)":"rgba(59,130,246,0.4)"),borderRadius:8,color:props.capSaved?"#4ade80":"#93c5fd",fontSize:10,cursor:"pointer",fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{props.capSaved?"✓ SYNC":"☁ SYNC"}</button>
          </div>
        </div>
        <div style={{fontSize:10,color:"#475569",marginBottom:8}}>RISQUE PAR TRADE (%)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          {["0.5","1","1.5","2"].map(function(v){
            return(
              <button key={v} onClick={function(){props.setRsk(v);}} style={{padding:"8px",background:props.rsk===v?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.04)",border:"1px solid "+(props.rsk===v?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.08)"),borderRadius:8,color:props.rsk===v?"#93c5fd":"#64748b",fontSize:12,cursor:"pointer",fontWeight:props.rsk===v?600:400}}>{v}%</button>
            );
          })}
        </div>
      </div>

      {props.capDepart&&props.capSaved&&(
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
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#475569",marginBottom:4}}>LOT ACTUEL</div>
                <div style={{fontSize:13,color:"#3b82f6",fontWeight:700}}>{props.lot||"—"}</div>
              </div>
              <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#475569",marginBottom:4}}>RISQUE MAX</div>
                <div style={{fontSize:13,color:"#ef4444",fontWeight:700}}>{(props.capActuel*parseFloat(props.rsk)/100).toFixed(2)}€</div>
              </div>
              <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#475569",marginBottom:4}}>TP POTENTIEL</div>
                <div style={{fontSize:13,color:"#22c55e",fontWeight:700}}>{((props.lot||0)*10*20).toFixed(2)}€</div>
              </div>
            </div>
          </div>
          {props.journal.length>0&&(
            <div style={CARD}>
              <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:12,marginTop:0}}>ÉVOLUTION DU CAPITAL</p>
              <div style={{display:"flex",alignItems:"flex-end",gap:3,height:60}}>
                {(function(){
                  var pts=[],cur=parseFloat(props.capDepart);
                  var trades=[...props.journal].reverse().slice(-20);
                  trades.forEach(function(t){cur+=tradePL(t);pts.push(cur);});
                  var mn=Math.min.apply(null,[parseFloat(props.capDepart)].concat(pts));
                  var mx=Math.max.apply(null,[parseFloat(props.capDepart)].concat(pts));
                  return pts.map(function(c,i){
                    var h=mx===mn?30:Math.max(4,Math.round(((c-mn)/(mx-mn))*56));
                    return <div key={i} style={{flex:1,height:h+"px",background:c>=parseFloat(props.capDepart)?"#22c55e":"#ef4444",borderRadius:2,opacity:0.7}}/>;
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
      {(!props.capDepart||!props.capSaved)&&<div style={{textAlign:"center",padding:40,color:"#334155",fontSize:12}}>{props.capDepart?"Clique sur ☁ SYNC pour sauvegarder.":"Saisis ton capital de départ."}</div>}
    </div>
  );
}

// ─── TAB JOURNAL ─────────────────────────────────────────────────────────────
function TabJournal(props){
  var wins=props.journal.filter(function(t){return t.resultat==="WIN";}).length;
  var total=props.journal.length;
  var wr=total?Math.round(wins/total*100):0;
  var plTotal=props.journal.reduce(function(a,t){return a+tradePL(t);},0);
  return(
    <div>
      <div style={CARD}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{fontSize:10,letterSpacing:2,color:"#475569",margin:0}}>AJOUTER UN TRADE</p>
          {props.lot&&<span style={{fontSize:10,color:"#3b82f6",background:"rgba(59,130,246,0.1)",borderRadius:6,padding:"3px 8px"}}>Lot : {props.lot}</span>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>NIVEAU</div>
            <select value={props.jNiv} onChange={function(e){props.setJNiv(e.target.value);}} style={{...SEL,color:LC[props.jNiv]}}>
              {["R2","R1","PP","S1","S2"].map(function(n){return <option key={n} value={n}>{n}</option>;})}
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>DIRECTION</div>
            <select value={props.jDir} onChange={function(e){props.setJDir(e.target.value);}} style={{...SEL,color:props.jDir==="LONG"?"#22c55e":"#ef4444"}}>
              <option value="LONG">▲ LONG</option>
              <option value="SHORT">▼ SHORT</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>RÉSULTAT</div>
            <select value={props.jRes} onChange={function(e){
              var v=e.target.value;
              props.setJRes(v);
              var g=parseFloat(props.jGain);
              if(!isNaN(g)&&g!==0){
                if(v==="LOSS"&&g>0) props.setJGain(String(-Math.abs(g)));
                if(v==="WIN"&&g<0) props.setJGain(String(Math.abs(g)));
              }
              if(v==="LOSS"&&(props.jGain===""||props.jGain==="0")) props.setJGain("-");
              if(v==="WIN"&&props.jGain==="-") props.setJGain("");
            }} style={{...SEL,color:props.jRes==="WIN"?"#22c55e":"#ef4444"}}>
              <option value="WIN">✓ WIN</option>
              <option value="LOSS">✗ LOSS</option>
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>DATE</div>
            <input type="date" value={props.jDate} onChange={function(e){props.setJDate(e.target.value);}} style={{...INP}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>HEURE</div>
            <input type="time" value={props.jHeure2} onChange={function(e){props.setJHeure2(e.target.value);}} style={{...INP}}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>GAINS / PERTES (€)</div>
            <input type="number" step="0.01" placeholder="Ex: 2.40" value={props.jGain} onChange={function(e){props.setJGain(e.target.value);}} style={{...INP,background:parseFloat(props.jGain)>0?"rgba(34,197,94,0.06)":parseFloat(props.jGain)<0?"rgba(239,68,68,0.06)":"rgba(255,255,255,0.04)",border:"1px solid "+(parseFloat(props.jGain)>0?"rgba(34,197,94,0.3)":parseFloat(props.jGain)<0?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.1)"),color:parseFloat(props.jGain)>0?"#22c55e":parseFloat(props.jGain)<0?"#ef4444":"#e2e8f0",fontWeight:600}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>COMMISSION (€)</div>
            <input type="number" step="0.01" value={props.jComm} onChange={function(e){props.setJComm(e.target.value);}} style={{...INP,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",color:"#ef4444"}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>NOTE</div>
            <input type="text" placeholder="Note..." value={props.jNote} onChange={function(e){props.setJNote(e.target.value);}} style={INP}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:props.editTrade?"1fr 1fr":"1fr",gap:8}}>
          <button onClick={props.onAdd} disabled={props.loading} style={{padding:10,background:props.editTrade?"rgba(234,179,8,0.2)":"rgba(59,130,246,0.2)",border:"1px solid "+(props.editTrade?"rgba(234,179,8,0.4)":"rgba(59,130,246,0.4)"),borderRadius:8,color:props.editTrade?"#fbbf24":"#93c5fd",fontSize:11,letterSpacing:1,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
            {props.loading?"⟳ SYNC...":props.editTrade?"✏ MODIFIER":"+ ENREGISTRER"}
          </button>
          {props.editTrade&&<button onClick={props.onCancelEdit} style={{padding:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#64748b",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>✕ ANNULER</button>}
        </div>
      </div>

      {total>0&&(
        <div style={CARD}>
          <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:12,marginTop:0}}>STATISTIQUES</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>TRADES</div>
              <div style={{fontSize:16,color:"#e2e8f0",fontWeight:700}}>{total}</div>
            </div>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>WIN RATE</div>
              <div style={{fontSize:16,color:wr>=50?"#22c55e":"#ef4444",fontWeight:700}}>{wr}%</div>
            </div>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>P&L TOTAL</div>
              <div style={{fontSize:14,color:plTotal>=0?"#22c55e":"#ef4444",fontWeight:700}}>{plTotal>=0?"+":""}{plTotal.toFixed(2)}€</div>
            </div>
          </div>
        </div>
      )}

      {props.journal.length>0?(
        <div>
          <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:10}}>HISTORIQUE</p>
          {props.journal.map(function(t){
            var pl=tradePL(t);
            return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"9px 10px",marginBottom:8}}>
                <span style={{fontSize:10,fontWeight:600,color:LC[t.niveau]||"#94a3b8",width:24}}>{t.niveau}</span>
                <span style={{fontSize:10,color:t.dir==="LONG"?"#22c55e":"#ef4444"}}>{t.dir==="LONG"?"▲":"▼"}</span>
                <span style={{fontSize:10,fontWeight:600,color:t.resultat==="WIN"?"#22c55e":"#ef4444"}}>{t.resultat==="WIN"?"✓":"✗"}</span>
                <span style={{fontSize:9,color:"#334155",flex:1}}>{t.date} {t.heure}</span>
                <span style={{fontSize:9,color:"#475569"}}>{t.lot}L</span>
                <span style={{fontSize:11,fontWeight:700,color:pl>=0?"#22c55e":"#ef4444"}}>{pl>=0?"+":""}{pl.toFixed(2)}€</span>
                <span onClick={function(){props.startEdit(t);}} style={{cursor:"pointer",opacity:0.5,fontSize:12,color:"#fbbf24",marginRight:4}}>✏</span>
                <span onClick={function(){props.onDel(t.id);}} style={{cursor:"pointer",opacity:0.4,fontSize:12,color:"#94a3b8"}}>✕</span>
              </div>
            );
          })}
        </div>
      ):<div style={{textAlign:"center",padding:40,color:"#334155",fontSize:12}}>Aucun trade enregistré.</div>}
    </div>
  );
}

// ─── TAB CALENDRIER ──────────────────────────────────────────────────────────
function TabCal(props){
  var now=new Date();
  var [yr,setYr]=useState(now.getFullYear());
  var [mo,setMo]=useState(now.getMonth());
  var [sel,setSel]=useState(null);
  var byDay={};
  props.journal.forEach(function(t){if(!byDay[t.date])byDay[t.date]=[];byDay[t.date].push(t);});
  function dayPL(d){return(byDay[d]||[]).reduce(function(a,t){return a+tradePL(t);},0);}
  var fd=new Date(yr,mo,1).getDay(),dim=new Date(yr,mo+1,0).getDate(),off=fd===0?6:fd-1;
  var cells=[];for(var i=0;i<off;i++)cells.push(null);for(var d=1;d<=dim;d++)cells.push(d);
  function prev(){if(mo===0){setMo(11);setYr(function(y){return y-1;});}else setMo(function(m){return m-1;});setSel(null);}
  function next(){if(mo===11){setMo(0);setYr(function(y){return y+1;});}else setMo(function(m){return m+1;});setSel(null);}
  var mStr=String(mo+1).padStart(2,"0"),prefix=yr+"-"+mStr;
  var mDates=Object.keys(byDay).filter(function(d){return d.startsWith(prefix);});
  var plMois=mDates.reduce(function(a,d){return a+dayPL(d);},0);
  var trMois=mDates.reduce(function(a,d){return a+(byDay[d]||[]).length;},0);
  var winMois=mDates.reduce(function(a,d){return a+(byDay[d]||[]).filter(function(t){return t.resultat==="WIN";}).length;},0);
  var selDate=sel?yr+"-"+mStr+"-"+String(sel).padStart(2,"0"):null;
  var selTrades=selDate?(byDay[selDate]||[]):[];
  var selPL=selDate?dayPL(selDate):0;
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[{l:"TRADES",v:String(trMois),c:"#e2e8f0"},{l:"P&L MOIS",v:(plMois>=0?"+":"")+plMois.toFixed(2)+"€",c:plMois>=0?"#22c55e":"#ef4444"},{l:"WIN RATE",v:trMois?Math.round(winMois/trMois*100)+"%":"—",c:trMois&&winMois/trMois>=0.5?"#22c55e":"#ef4444"},{l:"WINS",v:winMois+"/"+trMois,c:"#22c55e"}].map(function(x){
          return(
            <div key={x.l} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:700,color:x.c,marginBottom:4}}>{x.v}</div>
              <div style={{fontSize:8,color:"#475569"}}>{x.l}</div>
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
          {["L","M","M","J","V","S","D"].map(function(d,i){return <div key={i} style={{textAlign:"center",fontSize:9,color:i>=5?"#ef4444":"#475569",padding:"3px 0"}}>{d}</div>;})}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {cells.map(function(day,i){
            if(!day)return <div key={i}/>;
            var ds=yr+"-"+mStr+"-"+String(day).padStart(2,"0");
            var tr=byDay[ds]||[],pl=tr.length?dayPL(ds):null;
            var isT=ds===TODAY,isS=day===sel,isW=(i%7)>=5;
            var bg=isS?"rgba(59,130,246,0.2)":pl!==null?(pl>=0?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)"):"rgba(255,255,255,0.02)";
            var bd=isS?"rgba(59,130,246,0.5)":isT?"rgba(59,130,246,0.3)":pl!==null?(pl>=0?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.2)"):"rgba(255,255,255,0.04)";
            return(
              <div key={i} onClick={function(){setSel(day===sel?null:day);}} style={{minHeight:46,borderRadius:7,padding:4,cursor:tr.length?"pointer":"default",background:bg,border:"1px solid "+bd}}>
                <div style={{fontSize:10,color:isT?"#3b82f6":isW?"#94a3b8":"#64748b",fontWeight:isT?700:400}}>{day}</div>
                {pl!==null&&<div style={{fontSize:9,color:pl>=0?"#22c55e":"#ef4444",fontWeight:600}}>{pl>=0?"+":""}{pl.toFixed(1)}€</div>}
                {pl!==null&&<div style={{fontSize:8,color:"#334155"}}>{tr.length}T</div>}
              </div>
            );
          })}
        </div>
      </div>
      {sel&&(
        <div style={CARD}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:11,color:"#94a3b8"}}>{sel} {MOIS[mo]} {yr}</span>
            <span style={{fontSize:14,fontWeight:700,color:selPL>=0?"#22c55e":"#ef4444"}}>{selPL>=0?"+":""}{selPL.toFixed(2)} €</span>
          </div>
          {selTrades.length===0?<div style={{textAlign:"center",padding:20,color:"#334155",fontSize:11}}>Aucun trade ce jour.</div>:selTrades.map(function(t){
            var pl=tradePL(t);
            return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 12px",marginBottom:8}}>
                <span style={{fontSize:10,fontWeight:600,color:LC[t.niveau]||"#94a3b8",width:24}}>{t.niveau}</span>
                <span style={{fontSize:10,color:t.dir==="LONG"?"#22c55e":"#ef4444"}}>{t.dir==="LONG"?"▲":"▼"} {t.dir}</span>
                <span style={{fontSize:10,fontWeight:600,color:t.resultat==="WIN"?"#22c55e":"#ef4444"}}>{t.resultat==="WIN"?"✓ WIN":"✗ LOSS"}</span>
                <span style={{fontSize:10,color:"#475569",flex:1}}>{t.heure}</span>
                <span style={{fontSize:9,color:"#64748b"}}>{t.lot}L</span>
                <span style={{fontSize:11,fontWeight:700,color:pl>=0?"#22c55e":"#ef4444"}}>{pl>=0?"+":""}{pl.toFixed(2)}€</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{display:"flex",gap:16,justifyContent:"center",fontSize:9,color:"#475569"}}>
        <span><span style={{color:"#22c55e"}}>■</span> Positif</span>
        <span><span style={{color:"#ef4444"}}>■</span> Négatif</span>
        <span><span style={{color:"#3b82f6"}}>■</span> Aujourd'hui</span>
      </div>
    </div>
  );
}

// ─── TAB NEWS ────────────────────────────────────────────────────────────────
function TabNews(props){
  var items=["Vérifier le calendrier économique (Forex Factory / Investing.com)","Aucune news ROUGE dans la fenêtre 08h30–12h00 ?","Aucune news ROUGE dans la fenêtre 13h30–15h30 ?","Pas de décision BCE ou Fed ce jour ?","Spread ICMarkets normal (proche de 0) ?","Niveaux pivots sauvegardés pour aujourd'hui ?"];
  var news=[{h:"14:30",l:"NFP (1er vendredi du mois)",i:"ROUGE",c:"Éviter tous les ordres ce jour"},{h:"14:30",l:"CPI USA (inflation)",i:"ROUGE",c:"Fermer les ordres en cours avant"},{h:"13:45",l:"Décision BCE (jeudi)",i:"ROUGE",c:"Pas d'ordres ouverts"},{h:"14:15",l:"ADP Emploi US (mercredi)",i:"ORANGE",c:"Prudence sur les ordres limites"},{h:"09:00",l:"CPI Zone Euro",i:"ROUGE",c:"Attendre après la news"},{h:"15:45",l:"PMI USA",i:"ORANGE",c:"Réduire l'exposition"},{h:"10:00",l:"PMI Zone Euro",i:"ORANGE",c:"Vérifier avant l'ouverture Londres"}];
  return(
    <div>
      <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:16,marginBottom:14}}>
        <p style={{fontSize:10,letterSpacing:2,color:"#ef4444",marginBottom:12,marginTop:0}}>⚠ CHECKLIST AVANT DE POSER LES ORDRES</p>
        {items.map(function(item,i){
          return(
            <div key={i} onClick={function(){props.tc(i);}} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}}>
              <span style={{fontSize:14,color:props.checks[i]?"#22c55e":"#334155",marginTop:1,minWidth:16}}>{props.checks[i]?"✓":"○"}</span>
              <span style={{fontSize:11,color:props.checks[i]?"#64748b":"#94a3b8",textDecoration:props.checks[i]?"line-through":"none",lineHeight:1.5}}>{item}</span>
            </div>
          );
        })}
      </div>
      <div style={CARD}>
        <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:14,marginTop:0}}>NEWS RÉCURRENTES</p>
        {news.map(function(n,i){
          return(
            <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <span style={{fontSize:10,color:"#475569",minWidth:40}}>{n.h}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:11,color:"#e2e8f0"}}>{n.l}</span>
                  <span style={{fontSize:9,background:n.i==="ROUGE"?"rgba(239,68,68,0.15)":"rgba(234,179,8,0.15)",color:n.i==="ROUGE"?"#ef4444":"#eab308",padding:"1px 6px",borderRadius:4}}>{n.i}</span>
                </div>
                <span style={{fontSize:10,color:"#475569"}}>{n.c}</span>
              </div>
            </div>
          );
        })}
        <div style={{marginTop:14,background:"rgba(59,130,246,0.06)",borderRadius:8,padding:"10px 12px",fontSize:11,color:"#64748b"}}>📅 <span style={{color:"#3b82f6"}}>forexfactory.com</span> ou <span style={{color:"#3b82f6"}}>investing.com/economic-calendar</span></div>
      </div>
    </div>
  );
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function PivotAgent(){
  var [tab,setTab]=useState("signal");
  var [mode,setMode]=useState("limite");
  var [price,setPrice]=useState("");
  var [pp,setPp]=useState(""); var [r1,setR1]=useState(""); var [r2,setR2]=useState("");
  var [s1,setS1]=useState(""); var [s2,setS2]=useState("");
  var [heure,setHeure]=useState(gn);
  var [hauto,setHauto]=useState(true);
  var [ctx,setCtx]=useState("");
  var [res,setRes]=useState(null);
  var [err,setErr]=useState("");
  var [smsg,setSmsg]=useState("");
  var [syncOk,setSyncOk]=useState(false);
  var [syncErr,setSyncErr]=useState(false);
  var [pivotId,setPivotId]=useState(null);
  var [capDepart,setCapDepart]=useState("");
  var [capSaved,setCapSaved]=useState(false);
  var [capId,setCapId]=useState(null);
  var [rsk,setRsk]=useState("1");
  var [checks,setChecks]=useState([false,false,false,false,false,false]);
  var [journal,setJournal]=useState([]);
  var [jNiv,setJNiv]=useState("R1");
  var [jDir,setJDir]=useState("SHORT");
  var [jRes,setJRes]=useState("WIN");
  var [jNote,setJNote]=useState("");
  var [jDate,setJDate]=useState(TODAY);
  var [jHeure2,setJHeure2]=useState(gn);
  var [jGain,setJGain]=useState("");
  var [jComm,setJComm]=useState("-0.06");
  var [editTrade,setEditTrade]=useState(null);
  var [loading,setLoading]=useState(false);
  var [initializing,setInitializing]=useState(true);

  var capActuel=capDepart&&capSaved?capCourant(capDepart,journal):0;
  var lot=capDepart&&capSaved?calcLot(capActuel,parseFloat(rsk)):null;
  var plTotal=capDepart&&capSaved?capActuel-parseFloat(capDepart):0;

  // Heure auto
  useEffect(function(){
    if(!hauto)return;
    var iv=setInterval(function(){setHeure(gn());},30000);
    return function(){clearInterval(iv);};
  },[hauto]);

  // Chargement initial depuis Supabase
  useEffect(function(){
    async function init(){
      try {
        // Charger pivots du jour
        var pivots=await sbGet("pivots","date=eq."+TODAY+"&limit=1");
        if(pivots&&pivots.length>0){
          var pv=pivots[0];
          setR2(String(pv.r2||""));setR1(String(pv.r1||""));setPp(String(pv.pp||""));
          setS1(String(pv.s1||""));setS2(String(pv.s2||""));setPivotId(pv.id);setSyncOk(true);
        }
        // Charger capital
        var caps=await sbGet("capital","limit=1");
        if(caps&&caps.length>0){
          var cap=caps[0];
          setCapDepart(String(cap.capital_depart||""));setRsk(cap.risque||"1");setCapId(cap.id);setCapSaved(true);
        }
        // Charger trades
        var trades=await sbGet("trades","");
        if(trades&&trades.length>0) setJournal(trades);
      } catch(e){console.error(e);}
      setInitializing(false);
    }
    init();
  },[]);

  async function onSave(){
    if(!pp||!r1||!r2||!s1||!s2){setErr("Remplis tous les niveaux.");return;}
    setErr(""); setSyncOk(false); setSyncErr(false);
    var data={date:TODAY,r2:parseFloat(r2),r1:parseFloat(r1),pp:parseFloat(pp),s1:parseFloat(s1),s2:parseFloat(s2)};
    try {
      if(pivotId){await sbUpdate("pivots",pivotId,data);setSyncOk(true);}
      else{var n=await sbInsert("pivots",data);if(n){setPivotId(n.id);setSyncOk(true);}else setSyncErr(true);}
      setSmsg("✓ Synchronisé");setTimeout(function(){setSmsg("");},2500);
    } catch(e){setSyncErr(true);}
  }

  async function onSaveCapital(){
    if(!capDepart||parseFloat(capDepart)<=0){setErr("Capital invalide.");return;}
    var data={capital_depart:parseFloat(capDepart),risque:rsk,updated_at:new Date().toISOString()};
    try {
      if(capId){await sbUpdate("capital",capId,data);}
      else{var n=await sbInsert("capital",data);if(n){setCapId(n.id);}}
      setCapSaved(true);
    } catch(e){setErr("Erreur synchronisation capital.");}
  }

  function onAnalyse(){
    if(!pp||!r1||!r2||!s1||!s2){setErr("Remplis tous les niveaux.");return;}
    if(mode==="confirmation"&&!price){setErr("Remplis le prix actuel.");return;}
    setErr("");setRes(doAnalyse(price||"0",pp,r1,r2,s1,s2,heure,mode));
  }

  async function onAdd(){
    var lotTrade=capDepart&&capSaved?calcLot(capActuel,parseFloat(rsk)):0.01;
    var data={date:jDate,heure:jHeure2,niveau:jNiv,dir:jDir,resultat:jRes,note:jNote,lot:lotTrade,gain:jGain!==""?parseFloat(jGain):null,commission:jComm!==""?parseFloat(jComm):0};
    setLoading(true);
    try {
      if(editTrade){
        await sbUpdate("trades",editTrade,data);
        var updated=await sbGet("trades","");
        if(updated&&updated.length>0){
          setJournal(updated);
        } else {
          setJournal(function(j){return j.map(function(t){return t.id===editTrade?Object.assign({},t,data,{id:editTrade}):t;});});
        }
        setEditTrade(null);
      } else {
        var n=await sbInsert("trades",data);
        if(n){setJournal(function(j){return [n].concat(j);});}
      }
      setJNote("");setJGain("");setJComm("-0.06");setJDate(TODAY);setJHeure2(gn());
    } catch(e){setErr("Erreur lors de l'enregistrement.");}
    setLoading(false);
  }

  function startEdit(t){
    setJNiv(t.niveau);setJDir(t.dir);setJRes(t.resultat);
    setJDate(t.date);setJHeure2(t.heure||gn());
    setJGain(t.gain!=null?String(t.gain):"");
    setJComm(t.commission!=null?String(t.commission):"-0.06");
    setJNote(t.note||"");setEditTrade(t.id);
    window.scrollTo(0,0);
  }

  async function onDel(id){
    await sbDelete("trades",id);
    setJournal(function(j){return j.filter(function(t){return t.id!==id;});});
  }

  function tc(i){setChecks(function(c){return c.map(function(v,x){return x===i?!v:v;});});}

  if(initializing){
    return(
      <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,color:"#3b82f6"}}>PIVOT AGENT</div>
        <div style={{fontSize:11,color:"#475569",letterSpacing:2}}>☁ CONNEXION SUPABASE...</div>
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'DM Mono','Courier New',monospace",color:"#e2e8f0",padding:"18px 14px",backgroundImage:"radial-gradient(ellipse at 20% 0%,rgba(59,130,246,.06) 0%,transparent 60%)"}}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}"}</style>

      <div style={{maxWidth:640,margin:"0 auto 14px"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:4}}>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,color:"#fff"}}>PIVOT</span>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,color:"#3b82f6"}}>AGENT</span>
          <span style={{fontSize:9,color:"#475569",letterSpacing:2,marginLeft:4}}>EUR/USD · M15</span>
        </div>
        <div style={{height:1,background:"linear-gradient(90deg,#3b82f6,transparent)",marginBottom:5}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:9,color:"#334155"}}>SL 10p · TP 20p · RR 1:2 · ICMARKETS</span>
          {capDepart&&capSaved&&(
            <span style={{fontSize:10,fontWeight:600,color:plTotal>=0?"#22c55e":"#ef4444"}}>
              {capActuel.toFixed(2)}€ {plTotal>=0?"▲":"▼"} {plTotal>=0?"+":""}{plTotal.toFixed(2)}€
            </span>
          )}
        </div>
      </div>

      <div style={{maxWidth:640,margin:"0 auto 14px",display:"flex",gap:5}}>
        {[{id:"signal",l:"📊"},{id:"lot",l:"💰"},{id:"journal",l:"📒"},{id:"cal",l:"📅"},{id:"news",l:"📰"}].map(function(x){
          return <Tab key={x.id} label={x.l} active={tab===x.id} onClick={function(){setTab(x.id);}}/>;
        })}
      </div>

      <div style={{maxWidth:640,margin:"0 auto"}}>
        {tab==="signal"&&<TabSignal mode={mode} setMode={setMode} res={res} setRes={setRes} syncOk={syncOk} syncErr={syncErr} smsg={smsg} onSave={onSave} r2={r2} setR2={setR2} r1={r1} setR1={setR1} pp={pp} setPp={setPp} s1={s1} setS1={setS1} s2={s2} setS2={setS2} price={price} setPrice={setPrice} heure={heure} setHeure={setHeure} hauto={hauto} setHauto={setHauto} resetHeure={function(){setHauto(true);setHeure(gn());}} ctx={ctx} setCtx={setCtx} err={err} onAnalyse={onAnalyse} lot={lot}/>}
        {tab==="lot"&&<TabCapital capDepart={capDepart} setCapDepart={setCapDepart} capSaved={capSaved} setCapSaved={setCapSaved} capActuel={capActuel} rsk={rsk} setRsk={setRsk} lot={lot} journal={journal} onSaveCapital={onSaveCapital}/>}
        {tab==="journal"&&<TabJournal journal={journal} jNiv={jNiv} setJNiv={setJNiv} jDir={jDir} setJDir={setJDir} jRes={jRes} setJRes={setJRes} jNote={jNote} setJNote={setJNote} jGain={jGain} setJGain={setJGain} jComm={jComm} setJComm={setJComm} jDate={jDate} setJDate={setJDate} jHeure2={jHeure2} setJHeure2={setJHeure2} editTrade={editTrade} startEdit={startEdit} onCancelEdit={function(){setEditTrade(null);setJNote("");setJGain("");setJComm("-0.06");setJDate(TODAY);setJHeure2(gn());}} onAdd={onAdd} onDel={onDel} lot={lot} loading={loading}/>}
        {tab==="cal"&&<TabCal journal={journal}/>}
        {tab==="news"&&<TabNews checks={checks} tc={tc}/>}
        <p style={{textAlign:"center",fontSize:9,color:"#1e293b",marginTop:24}}>PIVOT AGENT · EUR/USD · ICMARKETS · ☁ SUPABASE</p>
      </div>
    </div>
  );
}
