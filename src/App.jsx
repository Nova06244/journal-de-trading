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

// SL/TP par actif et news
function getSlTp(pair, news) {
  return {sl:5, tp:10};
}

function gn(){const n=new Date();return String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");}
// Fenêtres : London 09h00-12h00, New York 13h30-17h00
function fv(h){const p=h.split(":").map(Number),m=p[0]*60+p[1];return(m>=540&&m<=720)||(m>=810&&m<=1020);}
function calcLot(cap,rsk){const l=Math.floor(((cap*rsk/100)/(SLP*10000*10))*100)/100;return Math.max(0.01,l);}
function tradePL(t){
  var comm=parseFloat(t.commission)||0;
  if(t.gain!==undefined&&t.gain!==null&&t.gain!==""&&!isNaN(parseFloat(t.gain))){
    var g=parseFloat(t.gain);
    if(t.resultat==="WIN"&&g<0) g=Math.abs(g);
    if(t.resultat==="LOSS"&&g>0) g=-Math.abs(g);
    return parseFloat((g+comm).toFixed(2));
  }
  const l=parseFloat(t.lot)||0.01;
  if(t.resultat==="WIN") return parseFloat((TPP*10000*l*10+comm).toFixed(2));
  return parseFloat((-(SLP*10000*l*10)+comm).toFixed(2));
}
function capCourant(capD,journal){return journal.reduce(function(acc,t){return acc+tradePL(t);},parseFloat(capD)||0);}

// ─── CALCUL DURÉE ─────────────────────────────────────────────────────────────
function calcDureeMinutes(dateE,heureE,dateS,heureS){
  if(!dateE||!heureE||!dateS||!heureS)return null;
  try{
    var e=new Date(dateE+"T"+heureE+":00");
    var s=new Date(dateS+"T"+heureS+":00");
    var diff=Math.round((s-e)/60000);
    return diff>0?diff:null;
  }catch(e){return null;}
}
function formatDuree(min){
  if(!min||min<=0)return null;
  if(min<60)return min+"min";
  var j=Math.floor(min/1440);
  var h=Math.floor((min%1440)/60);
  var m=min%60;
  var s="";
  if(j>0)s+=j+"j ";
  if(h>0)s+=h+"h ";
  if(m>0)s+=m+"min";
  return s.trim();
}

// ─── CALCUL BIAIS JOURNÉE supprimé — MM9 seul suffit ─────────────────────────

// ─── ANALYSE ─────────────────────────────────────────────────────────────────
function buildSc(niv,val,dir,tpv,tpn,mode,biaisOverride,isStop){
  var d=biaisOverride||dir;
  var e;
  if(isStop){
    e=d==="LONG"?val+0.00002:val-0.00002;
  } else {
    e=mode==="limite"?val:(d==="LONG"?val+0.00002:val-0.00002);
  }
  const sl=d==="LONG"?val-SLP:val+SLP;
  const tp=d==="LONG"?e+TPP:e-TPP;
  const ok=tpv?(d==="LONG"?tp<=tpv:tp>=tpv):true;
  var ord;
  if(isStop){
    ord=d==="LONG"?"BUY STOP":"SELL STOP";
  } else if(mode==="limite"){
    ord=d==="LONG"?"BUY LIMIT":"SELL LIMIT";
  } else {
    ord=d==="LONG"?"BUY marché":"SELL marché";
  }
  return {niv,val:val.toFixed(5),dir:d,e:e.toFixed(5),sl:sl.toFixed(5),tp:tp.toFixed(5),tpn,tpv:tpv?tpv.toFixed(5):null,ok,ord,isStop};
}

function detectBiaisH4(ctx){
  if(!ctx)return null;
  var c=ctx.toLowerCase();
  if(c.includes("retournement"))return "RETOURNEMENT";
  if(c.includes("contra"))return "CONTRA";
  if(c.includes("long")||c.includes("haussier")||c.includes("au-dessus")||c.includes("bullish"))return "LONG";
  if(c.includes("short")||c.includes("baissier")||c.includes("en dessous")||c.includes("bearish"))return "SHORT";
  return null;
}

function doAnalyse(price,pp,r1,r2,s1,s2,heure,mode,ctx,cassPullback,isRet,baseBiais){
  var p=parseFloat(price)||0;
  var vPP=parseFloat(pp),vR1=parseFloat(r1),vR2=parseFloat(r2),vS1=parseFloat(s1),vS2=parseFloat(s2);
  var fen=fv(heure),dPP=p>=vPP?"LONG":"SHORT";
  var biaisH4=detectBiaisH4(ctx);
  var bLONG=biaisH4==="LONG";
  var bSHORT=biaisH4==="SHORT";
  var bRET=isRet;
  var all;
  if(bRET){
    all=[
      buildSc("R2",vR2,"SHORT",vR1,"R1",mode,null,baseBiais==="LONG"||(!baseBiais)),
      buildSc("R1",vR1,"SHORT",vPP,"PP",mode,null,baseBiais==="LONG"||(!baseBiais)),
      buildSc("PP",vPP,dPP,dPP==="LONG"?vR1:vS1,dPP==="LONG"?"R1":"S1",mode,null,false),
      buildSc("S1",vS1,"LONG",vPP,"PP",mode,null,baseBiais==="SHORT"||(!baseBiais)),
      buildSc("S2",vS2,"LONG",vS1,"S1",mode,null,baseBiais==="SHORT"||(!baseBiais)),
    ];
  } else {
    all=[
      buildSc("R2",vR2,bLONG?"LONG":"SHORT",bLONG?null:vR1,bLONG?null:"R1",mode),
      buildSc("R1",vR1,bLONG?"LONG":"SHORT",bLONG?null:vPP,bLONG?null:"PP",mode),
      buildSc("PP",vPP,bSHORT?"SHORT":bLONG?"LONG":dPP,bSHORT?vS1:bLONG?vR1:(dPP==="LONG"?vR1:vS1),bSHORT?"S1":bLONG?"R1":(dPP==="LONG"?"R1":"S1"),mode),
      buildSc("S1",vS1,bSHORT?"SHORT":"LONG",bSHORT?vPP:null,bSHORT?"PP":null,mode),
      buildSc("S2",vS2,bSHORT?"SHORT":"LONG",bSHORT?vS1:null,bSHORT?"S1":null,mode),
    ];
  }
  var nv={R2:vR2,R1:vR1,PP:vPP,S1:vS1,S2:vS2};
  var cn=null,md=Infinity;
  Object.keys(nv).forEach(function(k){var d=Math.abs(p-nv[k]);if(d<md){md=d;cn=k;}});
  var dp=Math.round(md*10000),sur=md<=0.00150;
  var ms=all.find(function(s){return s.niv===cn;});
  var sig,conf,anl,csl;

  if(mode==="limite"){
    var nb=all.filter(function(s){return s.ok;}).length;
    if(biaisH4==="LONG") nb=all.filter(function(s){return s.ok&&s.dir==="LONG";}).length;
    if(biaisH4==="SHORT") nb=all.filter(function(s){return s.ok&&s.dir==="SHORT";}).length;
    sig="ORDRES DU JOUR";conf=fen?"FORTE":"MOYENNE";
    var biaisMsg=biaisH4?" · Biais H4 "+biaisH4+" → ordres "+biaisH4+" uniquement":"";
    anl=nb+" ordre(s) valide(s) dans le sens du biais H4. RR 1:2."+biaisMsg;
    csl=fen?"Place les ordres "+( biaisH4||"")+" sur ICMarkets dès l'ouverture.":"⚠ Hors fenêtre.";
  } else if(sur&&ms){
    var contraH4=biaisH4&&biaisH4!=="CONTRA"&&biaisH4!=="RETOURNEMENT"&&ms.dir!==biaisH4;
    var isContraMode=biaisH4==="CONTRA";
    var isRetMode=biaisH4==="RETOURNEMENT"||biaisH4==="RETOURNEMENT_FROM_LONG"||biaisH4==="RETOURNEMENT_FROM_SHORT"||bRET;
    var retFromLong=biaisH4==="RETOURNEMENT_FROM_LONG"||(bRET&&baseBiais==="LONG");
    var retFromShort=biaisH4==="RETOURNEMENT_FROM_SHORT"||(bRET&&baseBiais==="SHORT");
    sig=contraH4?"NO TRADE":ms.ok?ms.dir:"NO TRADE";
    conf=contraH4?"FAIBLE":isContraMode?"MOYENNE":!ms.ok?"FAIBLE":(fen?"FORTE":"MOYENNE");
    if(contraH4){
      anl="Setup "+ms.dir+" sur "+cn+" mais CONTRA le biais H4. Trade invalide.";
      csl="Ignorer ce setup. Structure H4 contre ce trade.";
    } else if(isContraMode){
      anl="⚠ Mode CONTRA PP actif — structure H4 contredit la position du prix. Prudence maximale sur "+cn+".";
      csl=ms.ok?"Setup possible mais risqué — attendre confirmation M15 forte sur "+cn+".":"Trade invalide.";
    } else if(isRetMode){
      var isExtreme=(cn==="R1"||cn==="R2"||cn==="S1"||cn==="S2");
      var heure24=parseInt((heure||"00:00").split(":")[0]);
      var aprèsKZ=heure24>=17;
      sig=ms.ok?ms.dir:"NO TRADE";
      conf=isExtreme?(aprèsKZ?"FORTE":"MOYENNE"):"FAIBLE";
      anl="↩ Mode RETOURNEMENT — "+ms.dir+" sur "+cn+(isExtreme?" (niveau extrême ✓)":"")+(aprèsKZ?" · fin de session":"")+" · SL 10p TP 20p RR 1:2.";
      csl=isExtreme?"Placer un "+(ms.dir==="LONG"?"BUY STOP":"SELL STOP")+" au-dessus/en-dessous de "+cn+" — déclenché uniquement si recassure confirmée."+(aprèsKZ?" Fin de session — position légère recommandée.":""):"Niveau "+cn+" peu favorable au retournement. Attendre S1/S2 ou R1/R2.";
    } else {
      anl=ms.ok?"Prix sur "+cn+". Rebond "+ms.dir+" confirmé par biais H4. SL 10p TP 20p RR 1:2.":"TP dépasse "+ms.tpn+". Trade invalide.";
      csl=ms.ok?"Attendre bougie M15 de rejet sur "+cn+(fen?".":" ⚠ Hors fenêtre."):"Ne pas prendre.";
    }
  } else {
    sig="NO TRADE";conf="FAIBLE";
    anl="Zone neutre à "+dp+" pips de "+cn+(biaisH4?" · Biais H4 "+biaisH4:"")+".";
    csl="Attendre l'approche de "+cn+" ("+nv[cn].toFixed(5)+")"+(biaisH4?" dans le sens "+biaisH4:"")+".";
  }
  if(biaisH4){
    all=all.map(function(s){
      if(s.dir!==biaisH4)return Object.assign({},s,{ok:false});
      return s;
    });
  }
  var cpMsg="";
  if(cassPullback&&cn&&sur){
    var cpDir=biaisH4==="LONG"?"LONG":biaisH4==="SHORT"?"SHORT":dPP;
    var cpEntry=nv[cn].toFixed(5);
    var cpSL=cpDir==="LONG"?(nv[cn]-SLP).toFixed(5):(nv[cn]+SLP).toFixed(5);
    var cpTP=cpDir==="LONG"?(nv[cn]+TPP).toFixed(5):(nv[cn]-TPP).toFixed(5);
    cpMsg="⤴ CASS+PULLBACK sur "+cn+" ("+cpEntry+") → "+cpDir+" · SL "+cpSL+" · TP "+cpTP;
    if(sig==="NO TRADE") sig=cpDir;
    conf=fen?"FORTE":"MOYENNE";
    anl=cpMsg;
    csl="Attendre cassure de "+cn+" puis pullback → Buy/Sell Limit à "+cpEntry+(fen?".":" ⚠ Hors fenêtre.");
  }
  all.sort(function(a,b){
    var va=parseFloat(a.val),vb=parseFloat(b.val);
    if(biaisH4==="LONG"){
      var aBelow=va<=p,bBelow=vb<=p;
      if(aBelow&&!bBelow)return -1;
      if(!aBelow&&bBelow)return 1;
      if(aBelow&&bBelow)return vb-va;
      return va-vb;
    } else if(biaisH4==="SHORT"){
      var aAbove=va>=p,bAbove=vb>=p;
      if(aAbove&&!bAbove)return -1;
      if(!aAbove&&bAbove)return 1;
      if(aAbove&&bAbove)return va-vb;
      return vb-va;
    }
    return Math.abs(p-va)-Math.abs(p-vb);
  });
  var sigNiv=cn;
  var cnCard=all.find(function(s){return s.niv===cn;});
  if(!cnCard||!cnCard.ok){
    var firstValid=all.find(function(s){return s.ok;});
    if(firstValid)sigNiv=firstValid.niv;
  }
  return {sig,conf,anl,csl,fen,dp,cn,sigNiv,sur,all,mode,biaisH4,cassPullback};
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
  var lbl=sc.isStop?(sc.dir==="LONG"?"BUY STOP":"SELL STOP"):props.mode==="limite"?(sc.dir==="LONG"?"BUY LMT":"SELL LMT"):"PE";
  return(
    <div style={{background:props.cur?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.02)",border:"1px solid "+(sc.ok?(props.cur?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)"):"rgba(239,68,68,0.2)"),borderRadius:10,padding:14,marginBottom:10,opacity:1}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,fontWeight:600,color:LC[sc.niv]}}>{sc.niv}</span>
          <span style={{fontSize:11,color:"#64748b"}}>{sc.val}</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <span style={{fontSize:10,color:dc,fontWeight:700}}>{sc.dir==="LONG"?"▲":"▼"} {sc.dir}</span>
          <span style={{fontSize:10,color:"#22c55e",fontWeight:600}}>RR 1:2</span>
        </div>
      </div>
      {(props.mode==="limite"||sc.isStop)&&sc.ok&&(
        <div style={{background:sc.isStop?"rgba(168,85,247,0.1)":sc.dir==="LONG"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",border:"1px solid "+(sc.isStop?"rgba(168,85,247,0.4)":sc.dir==="LONG"?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"),borderRadius:6,padding:"6px 12px",marginBottom:10}}>
          <span style={{fontSize:12,fontWeight:700,color:sc.isStop?"#c084fc":dc,letterSpacing:1}}>{sc.ord}</span>
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

  return(
    <div>
      {/* Sélecteur de paire */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        {["EURUSD","GBPUSD"].map(function(p){
          return(
            <button key={p} onClick={function(){props.setActivePair(p);props.setNewsStatut("");}} style={{padding:"10px 8px",background:props.activePair===p?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.activePair===p?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.06)"),borderRadius:10,color:props.activePair===p?"#93c5fd":"#475569",fontSize:11,fontWeight:props.activePair===p?700:400,cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:1}}>
              {p==="EURUSD"?"EUR/USD":"GBP/USD"}
            </button>
          );
        })}
      </div>

      {/* Statut NEWS */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:10,marginBottom:14}}>
        <div style={{fontSize:9,color:"#475569",marginBottom:6,letterSpacing:1}}>STATUT NEWS{props.activePair?" — "+(props.activePair==="EURUSD"?"EUR/USD":"GBP/USD"):""}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
          {[{v:"VERT",c:"#22c55e",bg:"rgba(34,197,94,0.2)",label:"🟢 VERT"},{v:"ORANGE",c:"#eab308",bg:"rgba(234,179,8,0.2)",label:"🟡 ORANGE"},{v:"ROUGE",c:"#ef4444",bg:"rgba(239,68,68,0.2)",label:"🔴 ROUGE"}].map(function(s){
            return(
              <button key={s.v} onClick={function(){props.setNewsStatut(s.v);}} style={{padding:"7px 4px",background:props.newsStatut===s.v?s.bg:"rgba(255,255,255,0.03)",border:"1px solid "+(props.newsStatut===s.v?s.c+"80":"rgba(255,255,255,0.1)"),borderRadius:7,color:props.newsStatut===s.v?s.c:"#475569",fontSize:10,cursor:"pointer",fontWeight:props.newsStatut===s.v?700:400,fontFamily:"'DM Mono',monospace"}}>
                {s.label}
              </button>
            );
          })}
        </div>
        {props.newsStatut&&props.newsStatut!=="ROUGE"&&(
          <div style={{marginTop:8,fontSize:10,color:"#475569"}}>
            SL 5p · TP 10p · RR 1:2
          </div>
        )}
      </div>

      {/* Blocs VERT / ORANGE / ROUGE */}
      {props.activePair&&props.newsStatut&&(
        props.newsStatut==="ROUGE"?(
          <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:14,marginBottom:14,textAlign:"center"}}>
            <div style={{fontSize:14,marginBottom:6}}>🔴</div>
            <div style={{fontSize:12,color:"#ef4444",fontWeight:700,letterSpacing:1}}>NEWS ROUGE — PAS DE TRADE</div>
            <div style={{fontSize:10,color:"#fca5a5",marginTop:4}}>Attends la prochaine fenetre ou demain.</div>
          </div>
        ):props.newsStatut==="VERT"?(
          <div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:10,padding:14,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>🟢</span>
                <span style={{fontSize:11,fontWeight:700,color:"#22c55e",letterSpacing:1}}>NEWS VERTE</span>
              </div>
              <span style={{fontSize:10,color:"#475569"}}>{props.activePair==="EURUSD"?"EUR/USD":"GBP/USD"}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{l:"SL",v:"5 pips",c:"#ef4444"},{l:"TP",v:"10 pips",c:"#22c55e"},{l:"RR",v:"1 : 2",c:"#93c5fd"}].map(function(x){return(
                <div key={x.l} style={{background:"rgba(0,0,0,0.2)",borderRadius:7,padding:"8px 4px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#475569",marginBottom:3}}>{x.l}</div>
                  <div style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</div>
                </div>
              );})}
            </div>
          </div>
        ):(
          <div style={{background:"rgba(234,179,8,0.08)",border:"1px solid rgba(234,179,8,0.3)",borderRadius:10,padding:14,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>🟡</span>
                <span style={{fontSize:11,fontWeight:700,color:"#eab308",letterSpacing:1}}>NEWS ORANGE — PRUDENCE</span>
              </div>
              <span style={{fontSize:10,color:"#475569"}}>{props.activePair==="EURUSD"?"EUR/USD":"GBP/USD"}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{l:"SL",v:"5 pips",c:"#ef4444"},{l:"TP",v:"10 pips",c:"#eab308"},{l:"RR",v:"1 : 2",c:"#93c5fd"}].map(function(x){return(
                <div key={x.l} style={{background:"rgba(0,0,0,0.2)",borderRadius:7,padding:"8px 4px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#475569",marginBottom:3}}>{x.l}</div>
                  <div style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</div>
                </div>
              );})}
            </div>
          </div>
        )
      )}

      {/* Heure + contexte */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10,marginBottom:12}}>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:9,color:"#475569"}}>HEURE</span>
            <span style={{fontSize:9,color:props.hauto?"#22c55e":"#f97316",cursor:"pointer"}} onClick={props.resetHeure}>{props.hauto?"● AUTO":"↺ RESET"}</span>
          </div>
          <input type="text" value={props.heure} onChange={function(e){props.setHeure(e.target.value);props.setHauto(false);}} placeholder="09:30" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid "+(props.hauto?"rgba(34,197,94,0.25)":"rgba(255,165,0,0.3)"),borderRadius:8,padding:8,color:"#e2e8f0",fontSize:13,fontFamily:"'DM Mono',monospace",outline:"none",textAlign:"center"}}/>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>

          {/* ── MM9 (remplace BIAIS M30) ── */}
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:10}}>
            <div style={{fontSize:9,color:"#475569",marginBottom:6,letterSpacing:1}}>MM9</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <button onClick={function(){props.setBiaisM30sel("");}} style={{padding:"7px 4px",background:props.biaisM30sel===""?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,color:"#64748b",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>—</button>
              <button onClick={function(){props.setBiaisM30sel("LONG");}} style={{padding:"7px 4px",background:props.biaisM30sel==="LONG"?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.biaisM30sel==="LONG"?"rgba(34,197,94,0.5)":"rgba(255,255,255,0.1)"),borderRadius:7,color:props.biaisM30sel==="LONG"?"#22c55e":"#475569",fontSize:10,cursor:"pointer",fontWeight:props.biaisM30sel==="LONG"?700:400,fontFamily:"'DM Mono',monospace"}}>▲ AU-DESSUS</button>
              <button onClick={function(){props.setBiaisM30sel("SHORT");}} style={{padding:"7px 4px",background:props.biaisM30sel==="SHORT"?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.biaisM30sel==="SHORT"?"rgba(239,68,68,0.5)":"rgba(255,255,255,0.1)"),borderRadius:7,color:props.biaisM30sel==="SHORT"?"#ef4444":"#475569",fontSize:10,cursor:"pointer",fontWeight:props.biaisM30sel==="SHORT"?700:400,fontFamily:"'DM Mono',monospace"}}>▼ EN DESSOUS</button>
            </div>
          </div>

          {/* ── RSI 7 ── */}
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:10}}>
            <div style={{fontSize:9,color:"#475569",marginBottom:6,letterSpacing:1}}>RSI 7</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <button onClick={function(){props.setBiaisM15sel("SHORT");}} style={{padding:"7px 4px",background:props.biaisM15sel==="SHORT"?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.biaisM15sel==="SHORT"?"rgba(239,68,68,0.5)":"rgba(255,255,255,0.1)"),borderRadius:7,color:props.biaisM15sel==="SHORT"?"#ef4444":"#475569",fontSize:10,cursor:"pointer",fontWeight:props.biaisM15sel==="SHORT"?700:400,fontFamily:"'DM Mono',monospace"}}>🔴 &lt;30</button>
              <button onClick={function(){props.setBiaisM15sel("");}} style={{padding:"7px 4px",background:props.biaisM15sel===""?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,color:"#64748b",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>— NEUTRE</button>
              <button onClick={function(){props.setBiaisM15sel("LONG");}} style={{padding:"7px 4px",background:props.biaisM15sel==="LONG"?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.biaisM15sel==="LONG"?"rgba(239,68,68,0.5)":"rgba(255,255,255,0.1)"),borderRadius:7,color:props.biaisM15sel==="LONG"?"#ef4444":"#475569",fontSize:10,cursor:"pointer",fontWeight:props.biaisM15sel==="LONG"?700:400,fontFamily:"'DM Mono',monospace"}}>🔴 &gt;70</button>
            </div>
          </div>

          {/* ── SIGNAL ENTRÉE ── */}
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:10}}>
            <div style={{fontSize:9,color:"#475569",marginBottom:6,letterSpacing:1}}>SIGNAL ENTRÉE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:6}}>
              {[{v:"",l:"—",c:"#64748b",bg:"rgba(255,255,255,0.1)"},{v:"IFVG+",l:"◈ IFVG+",c:"#22c55e",bg:"rgba(34,197,94,0.2)"},{v:"IFVG-",l:"◈ IFVG-",c:"#ef4444",bg:"rgba(239,68,68,0.2)"}].map(function(s){
                return(
                  <button key={s.v} onClick={function(){props.setSignalType(s.v);props.setCassPullback(false);props.setIsRetournement(false);}} style={{padding:"6px 2px",background:props.signalType===s.v?s.bg:"rgba(255,255,255,0.03)",border:"1px solid "+(props.signalType===s.v?s.c+"80":"rgba(255,255,255,0.1)"),borderRadius:7,color:props.signalType===s.v?s.c:"#475569",fontSize:10,cursor:"pointer",fontWeight:props.signalType===s.v?700:400,fontFamily:"'DM Mono',monospace"}}>
                    {s.l}
                  </button>
                );
              })}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
              {[{v:"FVG+",l:"◇ FVG+",c:"#22c55e",bg:"rgba(34,197,94,0.2)"},{v:"FVG-",l:"◇ FVG-",c:"#ef4444",bg:"rgba(239,68,68,0.2)"}].map(function(s){
                return(
                  <button key={s.v} onClick={function(){props.setSignalType(s.v);props.setCassPullback(false);props.setIsRetournement(false);}} style={{padding:"6px 2px",background:props.signalType===s.v?s.bg:"rgba(255,255,255,0.03)",border:"1px solid "+(props.signalType===s.v?s.c+"80":"rgba(255,255,255,0.1)"),borderRadius:7,color:props.signalType===s.v?s.c:"#475569",fontSize:10,cursor:"pointer",fontWeight:props.signalType===s.v?700:400,fontFamily:"'DM Mono',monospace"}}>
                    {s.l}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {props.err&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#fca5a5"}}>⚠ {props.err}</div>}

      {/* ─── ENREGISTRER UN TRADE ─────────────────────────────────── */}
      <div style={{marginTop:8,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{fontSize:10,letterSpacing:2,color:"#475569",margin:0}}>ENREGISTRER LE TRADE</p>
          {props.lot&&<span style={{fontSize:10,color:"#3b82f6",background:"rgba(59,130,246,0.1)",borderRadius:6,padding:"3px 8px"}}>Lot : {props.lot}</span>}
        </div>

        {/* Résumé contexte */}
        {(props.activePair||props.newsStatut||props.biaisM30sel||props.biaisM15sel)&&(
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 10px",marginBottom:10,display:"flex",flexWrap:"wrap",gap:6}}>
            {props.activePair&&<span style={{fontSize:9,color:"#93c5fd",background:"rgba(59,130,246,0.1)",borderRadius:4,padding:"2px 6px"}}>{props.activePair==="EURUSD"?"EUR/USD":"GBP/USD"}</span>}
            {props.newsStatut&&<span style={{fontSize:9,color:props.newsStatut==="VERT"?"#22c55e":props.newsStatut==="ORANGE"?"#eab308":"#ef4444",background:props.newsStatut==="VERT"?"rgba(34,197,94,0.1)":props.newsStatut==="ORANGE"?"rgba(234,179,8,0.1)":"rgba(239,68,68,0.1)",borderRadius:4,padding:"2px 6px"}}>{props.newsStatut==="VERT"?"🟢":props.newsStatut==="ORANGE"?"🟡":"🔴"} {props.newsStatut}</span>}
            {props.biaisM30sel&&<span style={{fontSize:9,color:"#94a3b8",background:"rgba(255,255,255,0.05)",borderRadius:4,padding:"2px 6px"}}>{props.biaisM30sel==="LONG"?"▲":"▼"} MM9</span>}
            {props.biaisM15sel&&<span style={{fontSize:9,color:"#ef4444",background:"rgba(239,68,68,0.1)",borderRadius:4,padding:"2px 6px"}}>RSI7 {props.biaisM15sel==="SHORT"?"<30":">70"}</span>}
            {props.signalType&&<span style={{fontSize:9,color:props.signalType==="IFVG+"?"#22c55e":"#ef4444",background:props.signalType==="IFVG+"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",borderRadius:4,padding:"2px 6px"}}>{props.signalType}</span>}
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>NIVEAU</div>
            <select value={props.jNiv} onChange={function(e){props.setJNiv(e.target.value);}} style={{...SEL,color:LC[props.jNiv]||"#e2e8f0"}}>
              <option value="">—</option>
              <optgroup label="PIVOTS">
                {["R5","R4","R3","R2","R1","PP","S1","S2","S3","S4","S5"].map(function(n){return <option key={n} value={n}>{n}</option>;})}
              </optgroup>
              <optgroup label="LIQUIDITÉS">
                {["ASL","ASH","LDL","LDH","NYL","NYH"].map(function(n){return <option key={n} value={n}>{n}</option>;})}
              </optgroup>
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>TF</div>
            <select value={props.jTf} onChange={function(e){props.setJTf(e.target.value);}} style={{...SEL,color:"#e2e8f0"}}>
              <option value="">—</option>
              <option value="M1">M1</option>
              <option value="H1">H1</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>DIRECTION</div>
            <select value={props.jDir} onChange={function(e){props.setJDir(e.target.value);}} style={{...SEL,color:props.jDir==="LONG"?"#22c55e":props.jDir==="SHORT"?"#ef4444":"#e2e8f0"}}>
              <option value="">—</option>
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
            }} style={{...SEL,color:props.jRes==="WIN"?"#22c55e":props.jRes==="LOSS"?"#ef4444":props.jRes==="BE"?"#eab308":"#e2e8f0"}}>
              <option value="">—</option>
              <option value="WIN">✓ WIN</option>
              <option value="LOSS">✗ LOSS</option>
              <option value="BE">◎ BE</option>
            </select>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>DATE ENTRÉE</div>
            <input type="date" value={props.jDate} onChange={function(e){props.setJDate(e.target.value);props.setJDateSortie(e.target.value);}} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 4px",color:"#e2e8f0",fontSize:11,fontFamily:"'DM Mono',monospace",outline:"none",colorScheme:"dark",boxSizing:"border-box"}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>HEURE ENTRÉE</div>
            <input type="time" value={props.jHeure2} onChange={function(e){props.setJHeure2(e.target.value);}} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 4px",color:"#e2e8f0",fontSize:11,fontFamily:"'DM Mono',monospace",outline:"none",colorScheme:"dark",boxSizing:"border-box"}}/>
          </div>
        </div>

        {/* Sortie + durée calculée */}
        {(function(){
          var dureeMin=calcDureeMinutes(props.jDate,props.jHeure2,props.jDateSortie,props.jHeureSortie);
          var dureeLabel=dureeMin?formatDuree(dureeMin):null;
          var dureeCol=!dureeMin?"#475569":dureeMin<=120?"#22c55e":dureeMin<=300?"#eab308":"#ef4444";
          return(
            <div style={{marginBottom:10}}>
              <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:8,marginBottom:6}}>
                <div>
                  <div style={{fontSize:9,color:"#475569",marginBottom:4}}>DATE SORTIE</div>
                  <input type="date" value={props.jDateSortie} onChange={function(e){props.setJDateSortie(e.target.value);}} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 4px",color:"#e2e8f0",fontSize:11,fontFamily:"'DM Mono',monospace",outline:"none",colorScheme:"dark",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:"#475569",marginBottom:4}}>HEURE SORTIE</div>
                  <input type="time" value={props.jHeureSortie} onChange={function(e){props.setJHeureSortie(e.target.value);}} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 4px",color:props.jHeureSortie?"#e2e8f0":"#475569",fontSize:11,fontFamily:"'DM Mono',monospace",outline:"none",colorScheme:"dark",boxSizing:"border-box"}}/>
                </div>
              </div>
              {dureeLabel&&(
                <div style={{background:"rgba(0,0,0,0.2)",borderRadius:7,padding:"6px 12px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:9,color:"#475569"}}>DURÉE</span>
                  <span style={{fontSize:12,fontWeight:700,color:dureeCol}}>⏱ {dureeLabel}</span>
                  {dureeMin>300&&<span style={{fontSize:9,color:"#ef4444"}}>⚠ trade long</span>}
                </div>
              )}
            </div>
          );
        })()}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>GAIN/PERTE (€)</div>
            <input type="number" step="0.01" placeholder={props.jRes==="LOSS"?"-1.20":"2.40"} value={props.jGain} onChange={function(e){
              var v=e.target.value;
              var g=parseFloat(v);
              if(!isNaN(g)&&g!==0){
                if(props.jRes==="LOSS"&&g>0) v=String(-Math.abs(g));
                if(props.jRes==="WIN"&&g<0) v=String(Math.abs(g));
              }
              props.setJGain(v);
            }} style={{...INP,background:parseFloat(props.jGain)>0?"rgba(34,197,94,0.06)":parseFloat(props.jGain)<0?"rgba(239,68,68,0.06)":"rgba(255,255,255,0.04)",border:"1px solid "+(parseFloat(props.jGain)>0?"rgba(34,197,94,0.3)":parseFloat(props.jGain)<0?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.1)"),color:props.jRes==="WIN"?"#22c55e":"#ef4444",fontWeight:600}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:"#475569",marginBottom:4}}>COMMISSION</div>
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
      {(!props.capDepart||!props.capSaved)&&<div style={{textAlign:"center",padding:40,color:"#334155",fontSize:12}}>{props.capDepart?"Clique sur ☁ SYNC pour sauvegarder.":"Saisis ton capital de départ."}</div>}
    </div>
  );
}

// ─── TAB JOURNAL ─────────────────────────────────────────────────────────────
function TabJournal(props){
  var wins=props.journal.filter(function(t){return t.resultat==="WIN";}).length;
  var losses=props.journal.filter(function(t){return t.resultat==="LOSS";}).length;
  var total=wins+losses;
  var wr=total?Math.round(wins/total*100):0;
  var plTotal=props.journal.reduce(function(a,t){return a+tradePL(t);},0);
  return(
    <div>
      {total>0&&(
        <div style={CARD}>
          <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:12,marginTop:0}}>STATISTIQUES</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>TRADES</div>
              <div style={{fontSize:16,color:"#e2e8f0",fontWeight:700}}>{props.journal.length}</div>
            </div>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>WIN RATE</div>
              <div style={{fontSize:16,color:wr>=50?"#22c55e":"#ef4444",fontWeight:700}}>{wr}%</div>
            </div>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>P&L TOTAL</div>
              <div style={{fontSize:14,color:plTotal>=0?"#22c55e":"#ef4444",fontWeight:700}}>{plTotal>=0?"+":""}{plTotal.toFixed(2)}€</div>
            </div>
            <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9,color:"#475569",marginBottom:4}}>BE</div>
              <div style={{fontSize:16,color:"#eab308",fontWeight:700}}>{props.journal.filter(function(t){return t.resultat==="BE";}).length}</div>
            </div>
          </div>
        </div>
      )}
      {props.journal.length>0?(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <p style={{fontSize:10,letterSpacing:2,color:"#475569",margin:0}}>HISTORIQUE</p>
            <button onClick={function(){
              var headers=["date","heure","pair","niveau","timeframe","dir","resultat","gain","commission","lot","sl_pips","tp_pips","rr","news_statut","mm9","rsi7","signal_entree","date_sortie","heure_sortie","duree_minutes","note"];
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
              a.download="trades_"+new Date().toISOString().slice(0,10)+".csv";
              a.click();
              URL.revokeObjectURL(url);
            }} style={{padding:"5px 12px",background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:7,color:"#93c5fd",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:1}}>
              ↓ CSV
            </button>
          </div>
          {props.journal.map(function(t){
            var pl=tradePL(t);
            return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"9px 10px",marginBottom:8}}>
                <span style={{fontSize:9,color:t.pair==="GBPUSD"?"#a78bfa":"#64748b",marginRight:2}}>{t.pair||"EUR"}</span>
                <span style={{fontSize:9,color:"#475569"}}>{t.timeframe||"M1"}</span>
                <span style={{fontSize:10,fontWeight:600,color:LC[t.niveau]||"#94a3b8",width:24}}>{t.niveau}</span>
                <span style={{fontSize:10,color:t.dir==="LONG"?"#22c55e":"#ef4444"}}>{t.dir==="LONG"?"▲":"▼"}</span>
                <span style={{fontSize:10,fontWeight:600,color:t.resultat==="WIN"?"#22c55e":t.resultat==="LOSS"?"#ef4444":"#eab308"}}>{t.resultat==="WIN"?"✓":t.resultat==="LOSS"?"✗":"◎"}</span>
                <span style={{fontSize:9,color:"#334155",flex:1}}>{t.date} {t.heure}</span>
                {t.duree_minutes&&<span style={{fontSize:9,color:t.duree_minutes<=120?"#22c55e":t.duree_minutes<=300?"#eab308":"#ef4444"}}>⏱{formatDuree(t.duree_minutes)}</span>}
                <span style={{fontSize:9,color:"#475569"}}>{t.lot}L</span>
                <span style={{fontSize:11,fontWeight:700,color:pl>=0?"#22c55e":"#ef4444"}}>{pl>=0?"+":""}{pl.toFixed(2)}€</span>
                <span onClick={function(){props.startEdit(t);props.setTab("signal");window.scrollTo(0,0);}} style={{cursor:"pointer",opacity:0.5,fontSize:12,color:"#fbbf24",marginRight:4}}>✏</span>
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
  var lossMois=mDates.reduce(function(a,d){return a+(byDay[d]||[]).filter(function(t){return t.resultat==="LOSS";}).length;},0);
  var totalWL=winMois+lossMois;
  var selDate=sel?yr+"-"+mStr+"-"+String(sel).padStart(2,"0"):null;
  var selTrades=selDate?(byDay[selDate]||[]):[];
  var selPL=selDate?dayPL(selDate):0;
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[{l:"TRADES",v:String(trMois),c:"#e2e8f0"},{l:"P&L MOIS",v:(plMois>=0?"+":"")+plMois.toFixed(2)+"€",c:plMois>=0?"#22c55e":"#ef4444"},{l:"WIN RATE",v:totalWL?Math.round(winMois/totalWL*100)+"%":"—",c:totalWL&&winMois/totalWL>=0.5?"#22c55e":"#ef4444"},{l:"WINS",v:winMois+"/"+totalWL,c:"#22c55e"}].map(function(x){
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
  var [newsData,setNewsData]=useState(null);
  var [newsLoading,setNewsLoading]=useState(false);
  var [newsErr,setNewsErr]=useState("");
  var [lastUpdate,setLastUpdate]=useState(null);

  async function fetchNews(){
    setNewsLoading(true);setNewsErr("");
    try{
      var r=await fetch("https://zqtmjxsjurdrcnwissmn.supabase.co/functions/v1/smooth-task",{
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY},
        body:JSON.stringify({pair:props.pair||"EURUSD"})
      });
      if(!r.ok)throw new Error("HTTP "+r.status);
      var d=await r.json();
      if(d.error)throw new Error(d.error);
      setNewsData(d);
      setLastUpdate(new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}));
    }catch(e){setNewsErr("Erreur: "+e.message);}
    setNewsLoading(false);
  }

  useEffect(function(){setNewsData(null);fetchNews();},[props.pair]);

  var stCol=function(s){return s==="ROUGE"?"#ef4444":s==="ORANGE"?"#eab308":"#22c55e";};
  var stBg=function(s){return s==="ROUGE"?"rgba(239,68,68,0.08)":s==="ORANGE"?"rgba(234,179,8,0.08)":"rgba(34,197,94,0.08)";};
  var stBorder=function(s){return s==="ROUGE"?"rgba(239,68,68,0.3)":s==="ORANGE"?"rgba(234,179,8,0.3)":"rgba(34,197,94,0.3)";};
  var stLabel=function(s){return s==="ROUGE"?"🔴 NE PAS TRADER":s==="ORANGE"?"🟡 PRUDENCE":"🟢 TRADER";};

  function NewsCard(data,num,label){
    if(!data)return null;
    var st=data.statut||"VERT";
    return(
      <div style={{background:stBg(st),border:"1px solid "+stBorder(st),borderRadius:12,padding:16,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:9,color:"#475569",letterSpacing:2,marginBottom:4}}>FENETRE {num} — {label}</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#fff",letterSpacing:2}}>{data.horaire||""}</div>
          </div>
          <div style={{background:stBg(st),border:"1px solid "+stBorder(st),borderRadius:8,padding:"6px 12px"}}>
            <span style={{fontSize:11,fontWeight:700,color:stCol(st)}}>{stLabel(st)}</span>
          </div>
        </div>
        {data.news&&data.news.length>0?(
          <div style={{marginBottom:10}}>
            {data.news.map(function(n,i){
              return(
                <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span style={{fontSize:10,color:"#64748b",minWidth:38}}>{n.heure}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:11,color:"#e2e8f0"}}>{n.titre}</span>
                      <span style={{fontSize:9,background:n.impact==="ROUGE"?"rgba(239,68,68,0.15)":"rgba(234,179,8,0.15)",color:n.impact==="ROUGE"?"#ef4444":"#eab308",padding:"1px 6px",borderRadius:4}}>{n.impact}</span>
                    </div>
                    <span style={{fontSize:10,color:"#475569"}}>{n.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ):(
          <div style={{fontSize:11,color:"#475569",marginBottom:10,fontStyle:"italic"}}>Aucune news impactante sur cette fenetre.</div>
        )}
        {data.conseil&&(
          <div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:8,padding:"8px 12px"}}>
            <span style={{fontSize:10,color:"#3b82f6"}}>→ </span>
            <span style={{fontSize:11,color:"#93c5fd"}}>{data.conseil}</span>
          </div>
        )}
      </div>
    );
  }

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {["EURUSD","GBPUSD"].map(function(p){
          return(
            <button key={p} onClick={function(){props.setPair(p);setNewsData(null);setLastUpdate(null);}} style={{padding:"10px 8px",background:props.pair===p?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.pair===p?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.06)"),borderRadius:10,color:props.pair===p?"#93c5fd":"#475569",fontSize:11,fontWeight:props.pair===p?700:400,cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:1}}>
              {p==="EURUSD"?"EUR/USD":"GBP/USD"}
            </button>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:9,color:"#475569",letterSpacing:2}}>ANALYSE IA — {props.pair==="EURUSD"?"EUR/USD":"GBP/USD"}</div>
          {lastUpdate&&<div style={{fontSize:9,color:"#334155",marginTop:2}}>Mis a jour a {lastUpdate}</div>}
        </div>
        <button onClick={fetchNews} disabled={newsLoading} style={{padding:"6px 14px",background:"rgba(59,130,246,0.2)",border:"1px solid rgba(59,130,246,0.4)",borderRadius:8,color:"#93c5fd",fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:1}}>
          {newsLoading?"⟳...":"↺ ACTUALISER"}
        </button>
      </div>
      {newsLoading&&(
        <div style={{textAlign:"center",padding:40}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#3b82f6",letterSpacing:2,marginBottom:8}}>ANALYSE EN COURS</div>
          <div style={{fontSize:11,color:"#475569"}}>Claude consulte le calendrier economique...</div>
        </div>
      )}
      {newsErr&&(
        <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:11,color:"#fca5a5"}}>⚠ {newsErr}</div>
      )}
      {newsData&&!newsLoading&&(
        <div>
          {newsData.resume_macro&&(
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:14,marginBottom:14}}>
              <div style={{fontSize:9,color:"#475569",letterSpacing:2,marginBottom:6}}>CONTEXTE MACRO</div>
              <p style={{fontSize:11,color:"#94a3b8",lineHeight:1.6,margin:0}}>{newsData.resume_macro}</p>
            </div>
          )}
          {NewsCard(newsData.fenetre1,"1","LONDON 09h00-12h00")}
          {NewsCard(newsData.fenetre2,"2","NEW YORK 13h30-17h00")}
          {newsData.alertes_hors_fenetres&&newsData.alertes_hors_fenetres.length>0&&(
            <div style={CARD}>
              <p style={{fontSize:10,letterSpacing:2,color:"#475569",marginBottom:10,marginTop:0}}>⚡ HORS FENETRES</p>
              {newsData.alertes_hors_fenetres.map(function(n,i){
                return(
                  <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <span style={{fontSize:10,color:"#64748b",minWidth:38}}>{n.heure}</span>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{fontSize:11,color:"#e2e8f0"}}>{n.titre}</span>
                        <span style={{fontSize:9,background:"rgba(239,68,68,0.15)",color:"#ef4444",padding:"1px 6px",borderRadius:4}}>{n.impact}</span>
                      </div>
                      <span style={{fontSize:10,color:"#475569"}}>{n.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {newsData.bce_fed&&(
            <div style={{background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:16}}>
              <p style={{fontSize:9,color:"#3b82f6",letterSpacing:2,marginBottom:10,marginTop:0}}>🏦 BANQUES CENTRALES</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:10,textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#475569",marginBottom:4}}>PROCHAINE BCE</div>
                  <div style={{fontSize:11,color:"#e2e8f0",fontWeight:600}}>{newsData.bce_fed.prochaine_bce||"—"}</div>
                </div>
                <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:10,textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#475569",marginBottom:4}}>PROCHAINE FED</div>
                  <div style={{fontSize:11,color:"#e2e8f0",fontWeight:600}}>{newsData.bce_fed.prochaine_fed||"—"}</div>
                </div>
              </div>
              {newsData.bce_fed.info&&<p style={{fontSize:11,color:"#64748b",margin:0,lineHeight:1.6}}>{newsData.bce_fed.info}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function PivotAgent(){
  var [tab,setTab]=useState("news");
  var [pair,setPair]=useState("EURUSD");
  var [activePair,setActivePair]=useState("");
  var [newsStatut,setNewsStatut]=useState("");
  var [tradePair,setTradePair]=useState("EURUSD");
  var [mode,setMode]=useState("confirmation");
  var [price,setPrice]=useState("");
  var [pp,setPp]=useState(""); var [r1,setR1]=useState(""); var [r2,setR2]=useState("");
  var [s1,setS1]=useState(""); var [s2,setS2]=useState("");
  var [heure,setHeure]=useState(gn);
  var [hauto,setHauto]=useState(true);
  var [ctx,setCtx]=useState("");
  var [biaisM30sel,setBiaisM30sel]=useState("");
  var [biaisM15sel,setBiaisM15sel]=useState("");   // ← NOUVEAU
  var [isRetournement,setIsRetournement]=useState(false);
  var [ppH4,setPpH4]=useState("");
  var [ppM30val,setPpM30val]=useState("");
  var [gapWeekend,setGapWeekend]=useState("");
  var [cassPullback,setCassPullback]=useState(false);
  var [signalType,setSignalType]=useState("");
  var [signalNote,setSignalNote]=useState("");

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
  var [checks,setChecks]=useState([false,false,false,false]);
  var [journal,setJournal]=useState([]);
  var [jNiv,setJNiv]=useState("");
  var [jDir,setJDir]=useState("");
  var [jRes,setJRes]=useState("");
  var [jNote,setJNote]=useState("");
  var [jDate,setJDate]=useState(TODAY);
  var [jHeure2,setJHeure2]=useState(gn);
  var [jGain,setJGain]=useState("");
  var [jComm,setJComm]=useState("-0.06");
  var [jDateSortie,setJDateSortie]=useState(TODAY);
  var [jHeureSortie,setJHeureSortie]=useState("");
  var [jTf,setJTf]=useState("");
  var [editTrade,setEditTrade]=useState(null);
  var [loading,setLoading]=useState(false);
  var [initializing,setInitializing]=useState(true);

  var capActuel=capDepart&&capSaved?capCourant(capDepart,journal):0;
  var lot=capDepart&&capSaved?calcLot(capActuel,parseFloat(rsk)):null;
  var plTotal=capDepart&&capSaved?capActuel-parseFloat(capDepart):0;

  useEffect(function(){
    if(!hauto)return;
    var iv=setInterval(function(){setHeure(gn());},30000);
    return function(){clearInterval(iv);};
  },[hauto]);

  useEffect(function(){
    async function init(){
      try {
        var pivots=await sbGet("pivots","date=eq."+TODAY+"_"+activePair+"&limit=1");
        if(pivots&&pivots.length>0){
          var pv=pivots[0];
          setR2(String(pv.r2||""));setR1(String(pv.r1||""));setPp(String(pv.pp||""));
          setS1(String(pv.s1||""));setS2(String(pv.s2||""));setPivotId(pv.id);setSyncOk(true);
          if(pv.mm9)setBiaisM30sel(pv.mm9);
          if(pv.pp_m30)setPpM30val(String(pv.pp_m30));
          if(pv.cass_pullback!==undefined&&pv.cass_pullback!==null)setCassPullback(pv.cass_pullback);
        }
        var caps=await sbGet("capital","limit=1");
        if(caps&&caps.length>0){
          var cap=caps[0];
          setCapDepart(String(cap.capital_depart||""));setRsk(cap.risque||"1");setCapId(cap.id);setCapSaved(true);
        }
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
    var data={
      date:TODAY+"_"+activePair,
      pair:activePair,
      r2:parseFloat(r2),r1:parseFloat(r1),pp:parseFloat(pp),s1:parseFloat(s1),s2:parseFloat(s2),
      mm9:biaisM30sel||null,
      pp_m30:ppM30val?parseFloat(ppM30val):null,
      cass_pullback:cassPullback,
      signal_type:signalType||null,
      signal_note:signalNote||null
    };
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

  async function onAnalyse(){
    if(!pp||!r1||!r2||!s1||!s2){setErr("Remplis tous les niveaux.");return;}
    if(mode==="confirmation"&&!price){setErr("Remplis le prix actuel.");return;}
    setErr("");
    var effectiveBiais=isRetournement&&biaisM30sel?(biaisM30sel==="LONG"?"RETOURNEMENT_FROM_LONG":"RETOURNEMENT_FROM_SHORT"):biaisM30sel;
    var ctxFull=(effectiveBiais?("M30 "+effectiveBiais):"")+(ppM30val?" PPM30:"+ppM30val:"")+(gapWeekend?" gap:"+gapWeekend:"")+(cassPullback?" signal:cassure-pullback":"")+(signalType?" type:"+signalType:"")+(signalNote?" note:"+signalNote:"")+(ctx?" "+ctx:"");
    setRes(doAnalyse(price||"0",pp,r1,r2,s1,s2,heure,mode,ctxFull,cassPullback,isRetournement,biaisM30sel));
  }

  async function onAdd(){
    var lotTrade=capDepart&&capSaved?calcLot(capActuel,parseFloat(rsk)):0.01;
    var sltp=getSlTp(activePair||tradePair||"EURUSD", newsStatut);
    var slPips=sltp.sl;
    var tpPips=sltp.tp;
    var rrStr="1:2";
    var dureeMin=calcDureeMinutes(jDate,jHeure2,jDateSortie,jHeureSortie);
    var data={
      date:jDate,heure:jHeure2,niveau:jNiv,dir:jDir,resultat:jRes,note:jNote,
      lot:lotTrade,gain:jGain!==""?parseFloat(jGain):null,commission:jComm!==""?parseFloat(jComm):0,
      pair:activePair||tradePair||"EURUSD",
      news_statut:newsStatut||null,
      sl_pips:slPips,tp_pips:tpPips,rr:rrStr,
      mm9:biaisM30sel||null,
      rsi7:biaisM15sel||null,
      signal_entree:signalType||null,
      timeframe:jTf||null,
      date_sortie:jHeureSortie?jDateSortie:null,
      heure_sortie:jHeureSortie||null,
      duree_minutes:dureeMin||null
    };
    setLoading(true);
    try {
      if(editTrade){
        await sbUpdate("trades",editTrade,data);
        var updated=await sbGet("trades","");
        if(updated&&updated.length>0){setJournal(updated);}
        else{setJournal(function(j){return j.map(function(t){return t.id===editTrade?Object.assign({},t,data,{id:editTrade}):t;});});}
        setEditTrade(null);
      } else {
        var n=await sbInsert("trades",data);
        if(n){setJournal(function(j){return [n].concat(j);});}
      }
      setJNote("");setJGain("");setJComm("-0.06");setJDate(TODAY);setJHeure2(gn());setJNiv("");setJDir("");setJRes("");
      setGapWeekend("");setCassPullback(false);setSignalType("");setSignalNote("");setIsRetournement(false);setBiaisM15sel("");setBiaisM30sel("");
      setJDateSortie(TODAY);setJHeureSortie("");setJTf("");
    } catch(e){setErr("Erreur lors de l'enregistrement.");}
    setLoading(false);
  }

  function startEdit(t){
    setJNiv(t.niveau);setJDir(t.dir);setJRes(t.resultat);
    setJDate(t.date);setJHeure2(t.heure||gn());
    setJGain(t.gain!=null?String(t.gain):"");
    setJComm(t.commission!=null?String(t.commission):"-0.06");
    setJNote(t.note||"");setEditTrade(t.id);
    if(t.pair)setActivePair(t.pair);
    if(t.news_statut)setNewsStatut(t.news_statut);
    if(t.mm9)setBiaisM30sel(t.mm9);
    if(t.rsi7)setBiaisM15sel(t.rsi7);
    if(t.signal_entree)setSignalType(t.signal_entree);
    setJDateSortie(t.date_sortie||t.date||TODAY);
    setJHeureSortie(t.heure_sortie||"");
    setTab("signal");
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
          <span style={{fontSize:9,color:"#334155"}}>SL 5p · TP 10p · RR 1:2 · ICMARKETS</span>
          {capDepart&&capSaved&&(
            <span style={{fontSize:10,fontWeight:600,color:plTotal>=0?"#22c55e":"#ef4444"}}>
              {capActuel.toFixed(2)}€ {plTotal>=0?"▲":"▼"} {plTotal>=0?"+":""}{plTotal.toFixed(2)}€
            </span>
          )}
        </div>
      </div>

      <div style={{maxWidth:640,margin:"0 auto 14px",display:"flex",gap:5}}>
        {[{id:"news",l:"📰"},{id:"signal",l:"📊"},{id:"lot",l:"💰"},{id:"journal",l:"📒"},{id:"cal",l:"📅"}].map(function(x){
          return <Tab key={x.id} label={x.l} active={tab===x.id} onClick={function(){setTab(x.id);}}/>;
        })}
      </div>

      <div style={{maxWidth:640,margin:"0 auto"}}>
        {tab==="signal"&&<TabSignal
          mode={mode} setMode={setMode} res={res} setRes={setRes}
          syncOk={syncOk} syncErr={syncErr} smsg={smsg} onSave={onSave}
          r2={r2} setR2={setR2} r1={r1} setR1={setR1} pp={pp} setPp={setPp}
          s1={s1} setS1={setS1} s2={s2} setS2={setS2}
          price={price} setPrice={setPrice}
          heure={heure} setHeure={setHeure} hauto={hauto} setHauto={setHauto}
          resetHeure={function(){setHauto(true);setHeure(gn());}}
          ctx={ctx} setCtx={setCtx}
          biaisM30sel={biaisM30sel} setBiaisM30sel={setBiaisM30sel}
          biaisM15sel={biaisM15sel} setBiaisM15sel={setBiaisM15sel}
          isRetournement={isRetournement} setIsRetournement={setIsRetournement}
          ppH4={ppH4} setPpH4={setPpH4}
          ppM30val={ppM30val} setPpM30val={setPpM30val}
          gapWeekend={gapWeekend} setGapWeekend={setGapWeekend}
          cassPullback={cassPullback} setCassPullback={setCassPullback}
          signalType={signalType} setSignalType={setSignalType}
          signalNote={signalNote} setSignalNote={setSignalNote}
          activePair={activePair} setActivePair={setActivePair}
          newsStatut={newsStatut} setNewsStatut={setNewsStatut}
          err={err} onAnalyse={onAnalyse} lot={lot}
          jNiv={jNiv} setJNiv={setJNiv} jDir={jDir} setJDir={setJDir}
          jRes={jRes} setJRes={setJRes} jNote={jNote} setJNote={setJNote}
          jGain={jGain} setJGain={setJGain} jComm={jComm} setJComm={setJComm}
          jDate={jDate} setJDate={setJDate} jHeure2={jHeure2} setJHeure2={setJHeure2}
          jDateSortie={jDateSortie} setJDateSortie={setJDateSortie}
          jHeureSortie={jHeureSortie} setJHeureSortie={setJHeureSortie}
          jTf={jTf} setJTf={setJTf}
          editTrade={editTrade}
          onCancelEdit={function(){setEditTrade(null);setJNote("");setJGain("");setJComm("-0.06");setJDate(TODAY);setJHeure2(gn());}}
          onAdd={onAdd} loading={loading}
        />}
        {tab==="lot"&&<TabCapital capDepart={capDepart} setCapDepart={setCapDepart} capSaved={capSaved} setCapSaved={setCapSaved} capActuel={capActuel} rsk={rsk} setRsk={setRsk} lot={lot} journal={journal} onSaveCapital={onSaveCapital}/>}
        {tab==="journal"&&<TabJournal tradePair={tradePair} setTradePair={setTradePair} setTab={setTab} journal={journal} jNiv={jNiv} setJNiv={setJNiv} jDir={jDir} setJDir={setJDir} jRes={jRes} setJRes={setJRes} jNote={jNote} setJNote={setJNote} jGain={jGain} setJGain={setJGain} jComm={jComm} setJComm={setJComm} jDate={jDate} setJDate={setJDate} jHeure2={jHeure2} setJHeure2={setJHeure2} editTrade={editTrade} startEdit={startEdit} onCancelEdit={function(){setEditTrade(null);setJNote("");setJGain("");setJComm("-0.06");setJDate(TODAY);setJHeure2(gn());}} onAdd={onAdd} onDel={onDel} lot={lot} loading={loading}/>}
        {tab==="cal"&&<TabCal journal={journal}/>}
        {tab==="news"&&<TabNews checks={checks} tc={tc} pair={pair} setPair={setPair}/>}
        <p style={{textAlign:"center",fontSize:9,color:"#1e293b",marginTop:24}}>PIVOT AGENT · EUR/USD · ICMARKETS · ☁ SUPABASE</p>
      </div>
    </div>
  );
}
