import { MAP } from './data/brazil-map.js';
import { EXT } from './data/world-map.js';

(function(){
'use strict';

/* ---------- configuração ---------- */
const DEFAULT_BASE='https://resultados.tse.jus.br';
const CICLO='ele2026', AMB='oficial';
const CD={1:'6257',2:'6258'};              // eleição federal: 1º e 2º turno (ver ele-c.json)
const DATA_2T='25/10/2026';
const INTERVAL=15;                          // segundos
const UFNAME={ac:'Acre',al:'Alagoas',ap:'Amapá',am:'Amazonas',ba:'Bahia',ce:'Ceará',df:'Distrito Federal',es:'Espírito Santo',go:'Goiás',ma:'Maranhão',mt:'Mato Grosso',ms:'Mato Grosso do Sul',mg:'Minas Gerais',pa:'Pará',pb:'Paraíba',pr:'Paraná',pe:'Pernambuco',pi:'Piauí',rj:'Rio de Janeiro',rn:'Rio Grande do Norte',ro:'Rondônia',rr:'Roraima',rs:'Rio Grande do Sul',sc:'Santa Catarina',sp:'São Paulo',se:'Sergipe',to:'Tocantins',zz:'Exterior'};
const UFS=Object.keys(UFNAME);
const REGION={Norte:['ac','ap','am','pa','ro','rr','to'],Nordeste:['al','ba','ce','ma','pb','pe','pi','rn','se'],'Centro-Oeste':['df','go','mt','ms'],Sudeste:['es','mg','rj','sp'],Sul:['pr','rs','sc'],Exterior:['zz']};
const UF2REG={}; Object.keys(REGION).forEach(r=>REGION[r].forEach(u=>UF2REG[u]=r));
/* cores fixas por número do candidato (a cor segue a pessoa, nunca a posição) */
const COL={'13':'#D62839','22':'#2563C9','55':'#E69F00','70':'#17A2B8','14':'#7B61C9','30':'#CC79A7','27':'#56B4E9','16':'#8C6D31','21':'#6B7280','29':'#9CA3AF','35':'#5D4037','80':'#B45309'};
const NAMEFIX={'22':'Flávio Bolsonaro','13':'Lula'};

/* ---------- utilidades ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=(x,d=0)=>(x==null||isNaN(x))?'—':Number(x).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const P=(x,d=2)=>(x==null||isNaN(x))?'—':N(x,d)+'%';
const num=s=>{const v=Number(String(s==null?'':s).replace(/\./g,'').replace(',','.'));return isNaN(v)?0:v};
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const colorOf=n=>COL[String(n)]||'#8A93A1';
const inkOn=hex=>{const h=hex.replace('#','');const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return (0.299*r+0.587*g+0.114*b)>150?'#11151B':'#FFFFFF'};
const small={de:1,da:1,do:1,dos:1,das:1,e:1};
const title=s=>String(s||'').toLowerCase().split(' ').map((w,i)=>(i&&small[w])?w:w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const nameOf=c=>NAMEFIX[c.n]||title(c.nmu||c.nm);
const first=c=>nameOf(c).split(' ')[0];
const BASE=()=>(ls.get('tse26_base')||DEFAULT_BASE).replace(/\/+$/,'');
const url=(turno,uf)=>{const cd=CD[turno];return `${BASE()}/${AMB}/${CICLO}/${cd}/dados/${uf}/${uf}-c0001-e${cd.padStart(6,'0')}-u.json`};
const photo=(turno,c)=>`${BASE()}/${AMB}/${CICLO}/${CD[turno]}/fotos/br/${c.sq}.jpeg`;

/* ---------- estado ---------- */
const S={turno:1,scope:'br',region:'all',page:'home',mapMode:'uf',autoCity:{},timeProg:null,mun:null,zon:null,sec:null,zoneProg:null,cand:null,view:'nom',cx:'tempo',rk:{lvl:'uf',cand:null,metric:'pct',dir:-1,lim:25},cityProg:null,auto:true,data:{1:null,2:null},missing:{1:false,2:false},err:null,busy:false,next:0,sort:{k:'name',d:1},gen:0};

/* ---------- leitura dos arquivos ---------- */
async function getJSON(u){
  const r=await fetch(u,{cache:'no-cache'});
  if(r.status===404) return {missing:true};
  if(!r.ok) throw new Error('HTTP '+r.status);
  return {json:await r.json()};
}
function summarize(j){
  const car=(j.carg&&j.carg[0])||{};
  const cands=[];
  (car.agr||[]).forEach(a=>(a.par||[]).forEach(p=>(p.cand||[]).forEach(c=>{
    cands.push({n:String(c.n),sq:c.sqcand,nm:c.nm,nmu:c.nmu,vap:num(c.vap),seq:num(c.seq),eleito:/^eleito/i.test(c.st||''),seg:/2[ºo°]\s*turno/i.test(c.st||''),st:c.st||'',
      vice:(c.vs&&c.vs[0]&&(c.vs[0].nmu||c.vs[0].nm))||'',sg:p.sg||'',coal:a.tp==='c'?a.nm:''});
  })));
  cands.sort((a,b)=>b.vap-a.vap||a.seq-b.seq);
  const s=j.s||{},e=j.e||{},v=j.v||{};
  const vv=num(v.vv)||num(v.vvc);
  const o={cands,vv,tv:num(v.tv),vb:num(v.vb),nulos:num(v.tvn)||(num(v.vn)+num(v.vnt)),
    ts:num(s.ts),st:num(s.st),te:num(e.te),est:num(e.est),comp:num(e.c),abst:num(e.a),pc:num(e.pc),pa:num(e.pa),
    and:j.and||'',tf:j.tf||'',dg:j.dg||'',hg:j.hg||''};
  o.pSec=o.ts?o.st/o.ts*100:0;
  cands.forEach(c=>c.pct=vv?c.vap/vv*100:0);
  return o;
}

/* ---------- urnas (boletim de urna, ASN.1/BER) ---------- */
const PLT={1:'3220'};
async function getPleito(turno){
  if(PLT[turno]) return PLT[turno];
  try{
    const r=await fetch(`${BASE()}/${AMB}/comum/config/ele-c.json`,{cache:'no-cache'}); if(!r.ok) return null;
    const j=await r.json(); const p=(j.pl||[]).find(x=>x.c===CICLO&&(x.e||[]).some(e=>e.cd===CD[turno]));
    if(p) PLT[turno]=p.cd; return p?p.cd:null;
  }catch(e){ return null; }
}
function berParse(b,o,e){
  const out=[];
  while(o<e){
    const t0=b[o++], cls=t0>>6, cons=(t0>>5)&1; let tag=t0&31;
    if(tag===31){ tag=0; let x; do{ x=b[o++]; tag=tag*128+(x&127); }while(x&128); }
    let l=b[o++]; if(l===undefined||l===128) throw new Error('BER');
    if(l&128){ const n=l&127; l=0; for(let i=0;i<n;i++) l=l*256+b[o++]; }
    if(o+l>e) throw new Error('BER');
    const n={cls,tag,cons:!!cons};
    if(cons) n.c=berParse(b,o,o+l); else n.v=b.subarray(o,o+l);
    out.push(n); o+=l;
  }
  return out;
}
const be=v=>{let a=0;for(let i=0;i<v.length;i++)a=a*256+v[i];return a};
/* devolve os votos de Presidente (cargo 1) de um boletim de urna: {v:{numero:votos}, vb, vn} */
function decodeBU(ab){
  const b=new Uint8Array(ab);
  const root=berParse(b,0,b.length)[0];
  const inner=root.c.find(n=>!n.cons&&n.cls===0&&n.tag===4&&n.v.length>100);
  if(!inner) return null;
  const R=berParse(inner.v,0,inner.v.length);
  let list=null;
  const walk=n=>{ if(list||!n.cons) return; const c=n.c;
    if(c.length>=3&&c[0].cls===2&&c[0].tag===1&&!c[0].cons&&c[0].v.length===1&&c[0].v[0]===1&&c[2].cons&&c[2].cls===0&&c[2].tag===16){ list=c[2]; return; }
    c.forEach(walk); };
  R.forEach(walk);
  if(!list) return null;
  const o={v:{},vb:0,vn:0};
  list.c.forEach(e=>{
    if(!e.cons) return;
    const tp=e.c.find(x=>x.cls===2&&x.tag===1&&!x.cons), q=e.c.find(x=>x.cls===2&&x.tag===2&&!x.cons), id=e.c.find(x=>x.cls===2&&x.tag===3&&x.cons);
    if(!tp||!q) return; const n=be(q.v), k=tp.v[0];
    if(k===1&&id&&id.c.length){ const num=String(be(id.c[id.c.length-1].v)); o.v[num]=(o.v[num]||0)+n; }
    else if(k===2) o.vb+=n; else if(k===3) o.vn+=n;
  });
  return o;
}
function buSummary(d,bu,aj){
  const cands=d.br.cands.map(c=>Object.assign({},c,{vap:bu.v[c.n]||0,eleito:false,seg:false}));
  cands.sort((a,b)=>b.vap-a.vap||a.seq-b.seq);
  const vv=cands.reduce((s,c)=>s+c.vap,0); cands.forEach(c=>c.pct=vv?c.vap/vv*100:0);
  const tv=vv+bu.vb+bu.vn, ok=aj.st==='Totalizada';
  return {cands,vv,tv,vb:bu.vb,nulos:bu.vn,ts:1,st:ok?1:0,te:0,est:0,comp:tv,abst:0,pc:0,pa:0,and:'f',tf:'',dg:aj.dg||'',hg:aj.hg||'',pSec:ok?100:0,urna:true};
}
const secKey=(m,z,n)=>m+'-'+z+'-'+n;
async function loadSec(turno,uf,mun,zon,ns){
  const d=S.data[turno]; if(!d) return null;
  try{
    const pl=await getPleito(turno); if(!pl) return null;
    const B=`${BASE()}/${AMB}/${CICLO}/arquivo-urna/${pl}/dados/${uf}/${mun}/${zon}/${ns}/`;
    const a=await fetch(B+`p${pl.padStart(6,'0')}-${uf}-m${mun}-z${zon}-s${ns}-aux.json`,{cache:'no-cache'}); if(!a.ok) return null;
    const aj=await a.json();
    const hs=(aj.hashes||[]).filter(h=>(h.arq||[]).some(x=>x.tp==='bu')); if(!hs.length) return null;
    const h=hs[hs.length-1], f=h.arq.find(x=>x.tp==='bu').nm;
    const r=await fetch(B+h.hash+'/'+f,{cache:'no-cache'}); if(!r.ok) return null;
    const bu=decodeBU(await r.arrayBuffer()); if(!bu) return null;
    const s=buSummary(d,bu,aj); (d.sec=d.sec||{})[secKey(mun,zon,ns)]=s; return s;
  }catch(e){ return null; }
}
let CS={uf:null,mun:{}}, csBusy=false;
const TIMES={mun:{},done:{}};
function parseTs(da,ha){const m=/(\d+)\/(\d+)\/(\d+)/.exec(da||''),h=/(\d+):(\d+):(\d+)/.exec(ha||'');return m&&h?Date.UTC(+m[3],m[2]-1,+m[1],+h[1],+h[2],+h[3]):0}
async function fetchCs(uf){
  const pl=(await getPleito(S.turno))||PLT[1];
  const r=await fetch(`${BASE()}/${AMB}/${CICLO}/arquivo-urna/${pl}/config/${uf}/${uf}-p${pl.padStart(6,'0')}-cs.json`,{cache:'no-cache'});
  if(!r.ok) throw new Error('cs');
  return r.json();
}
/* zonas, seções e horário de totalização de cada seção (da/ha do arquivo de configuração) */
function ingestCs(j,keepSec){
  const mm={},secT={};
  (j.abr||[]).forEach(a=>(a.mu||[]).forEach(m=>{
    let f=0,l=0;
    mm[m.cd]=(m.zon||[]).map(z=>({cd:z.cd,sec:(z.sec||[]).map(s=>{ const t=parseTs(s.da,s.ha); if(t){ if(!f||t<f)f=t; if(t>l)l=t; if(keepSec) secT[secKey(m.cd,z.cd,s.ns)]=t; } return s.ns; })}));
    if(l) TIMES.mun[m.cd]={f,l};
  }));
  return {mm,secT};
}
async function loadCs(uf){
  if(!uf||uf==='br'||uf==='zz'||CS.uf===uf||csBusy) return; csBusy=true;
  try{ const r=ingestCs(await fetchCs(uf),true); CS={uf,mun:r.mm,secT:r.secT}; TIMES.done[uf]=1; }
  catch(e){ CS={uf,mun:{},secT:{},err:1}; }
  csBusy=false; syncFilters(); render();
}
async function loadTimes(ufs){
  const q=ufs.filter(u=>!TIMES.done[u]); if(!q.length) return;
  const pr=S.timeProg={done:0,total:q.length,run:true}; let i=0;
  const w=async()=>{ while(i<q.length){ const u=q[i++]; try{ if(!TIMES.done[u]){ ingestCs(await fetchCs(u),false); TIMES.done[u]=1; } }catch(e){} pr.done++; paintProg(); } };
  await Promise.all([w(),w(),w()]); pr.run=false; paintProg();
}
const zonesOf=()=>(S.mun&&CS.uf===S.scope&&CS.mun[S.mun])||[];
const zoneObj=()=>zonesOf().find(z=>z.cd===S.zon);
function zoneSecs(d){ const z=zoneObj(); if(!z) return []; return z.sec.map(n=>d.sec&&d.sec[secKey(S.mun,S.zon,n)]).filter(Boolean); }
async function loadSecList(list){
  const turno=S.turno,d=S.data[turno]; if(!d||!list.length) return;
  if(S.zoneProg&&S.zoneProg.run) return;
  const uf=S.scope,mun=S.mun;
  const q=list.filter(([z,n])=>!(d.sec&&d.sec[secKey(mun,z,n)]));
  const pr={done:0,total:q.length,fail:0,run:true}; S.zoneProg=pr; let i=0,bad=0;
  const worker=async()=>{ while(i<q.length&&pr.run&&turno===S.turno&&mun===S.mun){
    const [z,n]=q[i++]; const s=await loadSec(turno,uf,mun,z,n); pr.done++;
    if(!s){pr.fail++; if(++bad>20) pr.run=false} else bad=0;
    if(pr.done%10===0){ renderUrnaNote(d); paintProg(); } } };
  renderUrnaNote(d);
  await Promise.all(Array.from({length:6},worker));
  pr.run=false; render();
}
async function loadZone(){ const z=zoneObj(); if(z) await loadSecList(z.sec.map(n=>[z.cd,n])); }
const urnaList=()=>{ const zs=S.zon?[zoneObj()].filter(Boolean):zonesOf(); const l=[]; zs.forEach(z=>z.sec.forEach(n=>l.push([z.cd,n]))); return l; };
function paintProg(){
  paintRank();
  const d=S.data[S.turno]; if(!d||!d.br) return;
  if(S.page==='home'&&S.view==='curve'){ renderCurve(viewSum(d)||d.br,d); }
  if(S.page==='map'&&S.mapMode==='mun') renderMap(d);
  if(S.page==='abroad') renderAbroad(d);
}

/* ---------- municípios ---------- */
let MUNCFG=null, munCfgBusy=false; const MUNNAME={}, I2T={};
async function loadMunCfg(){
  if(MUNCFG||munCfgBusy) return; munCfgBusy=true;
  try{
    const cd=CD[1];
    const r=await fetch(`${BASE()}/${AMB}/${CICLO}/${cd}/config/mun-e${cd.padStart(6,'0')}-cm.json`,{cache:'no-cache'});
    if(r.ok){ const j=await r.json(); const m={};
      (j.abr||[]).forEach(a=>{ m[a.cd]=(a.mu||[]).map(x=>{ MUNNAME[x.cd]=title(x.nm); if(x.cdi) I2T[x.cdi]={cd:x.cd,uf:a.cd}; return {cd:x.cd,nm:title(x.nm),cdi:x.cdi}; }).sort((p,q)=>p.nm.localeCompare(q.nm,'pt-BR')); });
      MUNCFG=m; }
  }catch(e){}
  munCfgBusy=false; syncFilters(); render();
}
const ensureMunCfg=()=>{ if(!MUNCFG&&!munCfgBusy) loadMunCfg(); };
const munUrl=(turno,uf,m)=>{const cd=CD[turno];return `${BASE()}/${AMB}/${CICLO}/${cd}/dados/${uf}/${uf}${m}-c0001-e${cd.padStart(6,'0')}-u.json`};
async function loadMun(turno,uf,m){
  const d=S.data[turno]; if(!d) return null;
  try{ const r=await getJSON(munUrl(turno,uf,m));
    if(r.json){ const s=summarize(r.json); s.uf=uf; s.cd=m; (d.mun=d.mun||{})[m]=s; return s; } }catch(e){}
  return null;
}
/* carrega vários municípios, poucas requisições por vez (o TSE limita 100 por segundo por IP) */
async function loadCities(ufs,force){
  const turno=S.turno, d=S.data[turno]; if(!d||!MUNCFG) return;
  if(S.cityProg&&S.cityProg.run) return;
  const q=[]; ufs.forEach(u=>(MUNCFG[u]||[]).forEach(m=>{ if(force||!(d.mun&&d.mun[m.cd])) q.push([u,m.cd]) }));
  const pr={done:0,total:q.length,fail:0,run:true}; S.cityProg=pr;
  let i=0,bad=0;
  const worker=async()=>{ while(i<q.length&&pr.run&&turno===S.turno){
    const [u,m]=q[i++]; const s=await loadMun(turno,u,m); pr.done++;
    if(!s){pr.fail++; if(++bad>40) pr.run=false} else bad=0;
    if(pr.done%20===0) paintProg();
  }};
  await Promise.all(Array.from({length:6},worker));
  pr.run=false; paintProg();
}
function aggregate(d,ufs){ return aggList(d,ufs.map(u=>d.uf[u])); }
function aggList(d,L0){
  const L=L0.filter(s=>s&&s.vv); if(!L.length) return null;
  const o={cands:[],vv:0,tv:0,vb:0,nulos:0,ts:0,st:0,te:0,est:0,comp:0,abst:0,and:d.br.and,tf:d.br.tf,dg:d.br.dg,hg:d.br.hg};
  const m={};
  L.forEach(s=>{['vv','tv','vb','nulos','ts','st','te','comp','abst'].forEach(k=>o[k]+=s[k]);
    s.cands.forEach(c=>{const x=m[c.n]||(m[c.n]=Object.assign({},c,{vap:0,eleito:false,seg:false}));x.vap+=c.vap})});
  o.cands=Object.values(m).sort((a,b)=>b.vap-a.vap||a.seq-b.seq);
  o.cands.forEach(c=>c.pct=o.vv?c.vap/o.vv*100:0);
  o.pSec=o.ts?o.st/o.ts*100:0; o.pc=o.te?o.comp/o.te*100:0; o.pa=o.te?o.abst/o.te*100:0;
  return o;
}

async function refresh(){
  if(S.busy) return; S.busy=true; const gen=++S.gen; const turno=S.turno;
  setLive('Atualizando…',null);
  try{
    const br=await getJSON(url(turno,'br'));
    if(gen!==S.gen||turno!==S.turno){S.busy=false;return}
    if(br.missing){
      S.missing[turno]=true; S.err=null; S.data[turno]=null;
    }else{
      S.missing[turno]=false; S.err=null;
      const cur=S.data[turno]||{uf:{},mun:{}};
      cur.br=summarize(br.json); cur.at=Date.now(); S.data[turno]=cur;
      render();
      const mj=S.sec?loadSec(turno,S.scope,S.mun,S.zon,S.sec):(S.mun?loadMun(turno,S.scope,S.mun):Promise.resolve());
      const res=await Promise.allSettled(UFS.map(u=>getJSON(url(turno,u))));
      await mj;
      if(gen===S.gen&&turno===S.turno){
        res.forEach((r,i)=>{if(r.status==='fulfilled'&&r.value.json) cur.uf[UFS[i]]=summarize(r.value.json)});
      }
    }
  }catch(e){
    S.err=e;
  }
  S.busy=false;
  S.next=Date.now()+(S.missing[S.turno]?60:INTERVAL)*1000;
  render();
}

/* ---------- histórico das atualizações (guardado neste navegador) ---------- */
function histKey(t){return 'tse26_h2_'+t}
function loadHist(t){try{return JSON.parse(ls.get(histKey(t))||'[]')}catch(e){return []}}
function parseK(k){const m=/(\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+)/.exec(k);return m?Date.UTC(+m[3],m[2]-1,+m[1],+m[4],+m[5],+m[6]):0}
function pushHist(t,d){
  const b=d.br; if(!b||!b.vv) return;
  const k=b.dg+' '+b.hg; const h=loadHist(t);
  if(h.length&&h[h.length-1].k===k) return;
  const sc={}; const add=(u,s)=>{if(!s||!s.vv) return; const v={}; s.cands.forEach(c=>{if(c.vap>0) v[c.n]=+c.pct.toFixed(2)}); sc[u]={a:+s.pSec.toFixed(2),v}};
  add('br',b); UFS.forEach(u=>add(u,d.uf[u])); Object.keys(REGION).forEach(r=>add('r:'+r,aggregate(d,REGION[r]))); if(S.mun&&d.mun&&d.mun[S.mun]) add('m:'+S.mun,d.mun[S.mun]);
  h.push({k,t:parseK(k),sc});
  let s=h.slice(-300);
  for(let i=0;i<4;i++){ try{ localStorage.setItem(histKey(t),JSON.stringify(s)); break }catch(e){ s=s.slice(Math.ceil(s.length/2)) } }
}

/* ---------- renderização ---------- */
const isBR=()=>S.scope==='br'&&S.region==='all'&&!S.mun;
const curKey=()=>S.sec?'s:'+S.mun+S.zon+S.sec:S.zon?'z:'+S.mun+S.zon:S.mun?'m:'+S.mun:S.scope!=='br'?S.scope:S.region!=='all'?'r:'+S.region:'br';
function selUFs(){ if(S.scope!=='br') return [S.scope]; if(S.region!=='all') return REGION[S.region]; return UFS.filter(u=>u!=='zz'); }
function viewSum(d){
  if(!d) return null;
  if(S.sec) return (d.sec||{})[secKey(S.mun,S.zon,S.sec)]||null;
  if(S.zon){ const L=zoneSecs(d); return L.length?aggList(d,L):null; }
  if(S.mun) return (d.mun||{})[S.mun]||null;
  if(S.scope!=='br') return d.uf[S.scope]||null;
  if(S.region!=='all') return aggregate(d,REGION[S.region]);
  return d.br;
}
function munName(){ if(!S.mun||!MUNCFG) return null; const m=(MUNCFG[S.scope]||[]).find(x=>x.cd===S.mun); return m?m.nm:null; }
const zn=z=>String(parseInt(z,10));
function scopeLabel(){
  if(S.sec) return `Seção ${zn(S.sec)} · Zona ${zn(S.zon)} · ${munName()||'Município'}`;
  if(S.zon) return `Zona ${zn(S.zon)} · ${munName()||'Município'}`;
  if(S.mun) return (munName()||'Município')+' · '+S.scope.toUpperCase();
  if(S.scope!=='br') return UFNAME[S.scope];
  if(S.region!=='all') return S.region==='Exterior'?'Exterior':'Região '+S.region;
  return 'Brasil';
}
function setLive(txt,on){
  $('#liveTxt').textContent=txt; $('#liveTxt2').textContent=txt;
  const c='dot'+(on===true?' on':on===false?' off':'');
  $('#dot').className=c; $('#dot2').className=c;
}

const PAGES=['home','map','states','abroad'];
function applyPage(){
  document.querySelectorAll('[data-page]').forEach(el=>{ el.hidden=el.dataset.page!==S.page; });
  $('#sumPanel').hidden=!(S.page==='home'||(S.missing[S.turno]&&!S.data[S.turno]));
  document.querySelectorAll('#nav [data-go]').forEach(b=>b.setAttribute('aria-current',b.dataset.go===S.page?'page':'false'));
}
function go(p){
  if(!PAGES.includes(p)) p='home'; S.page=p;
  try{ history.replaceState(null,'','#'+p); }catch(e){}
  $('#top').classList.remove('open'); applyPage(); render(); window.scrollTo(0,0);
}
function render(){
  $('#t1').setAttribute('aria-pressed',S.turno===1); $('#t2').setAttribute('aria-pressed',S.turno===2);
  const n=$('#notice'),d=S.data[S.turno];
  if(S.err){
    n.className='notice show err';
    n.innerHTML=`<b>Não foi possível ler os dados do TSE agora.</b>${esc(S.err.message||S.err)}. Se o erro persistir, o navegador pode estar bloqueando o acesso a ${esc(BASE())} (CORS) ou a conexão caiu. O painel tenta de novo sozinho.
    <details><summary>Usar outra origem dos dados (proxy próprio)</summary>
    <div>Informe a URL base que replica <code>/oficial/ele2026/…</code> do TSE.</div>
    <input id="baseIn" value="${esc(BASE())}" aria-label="URL base"><button class="btn" id="baseSave" type="button">Salvar e recarregar</button> <button class="btn" id="baseReset" type="button">Restaurar padrão</button></details>`;
    const sv=$('#baseSave'); if(sv) sv.onclick=()=>{ls.set('tse26_base',$('#baseIn').value.trim());location.reload()};
    const rs=$('#baseReset'); if(rs) rs.onclick=()=>{ls.set('tse26_base','');location.reload()};
    setLive('Sem conexão com o TSE',false);
  }else{ n.className='notice'; n.innerHTML=''; }

  if(S.missing[S.turno]&&!d){
    $('#body').hidden=true; applyPage();
    $('#sumPanel').innerHTML=S.turno===2
      ?`<div class="pending"><div class="headline">2º turno ainda sem apuração</div><p class="sub">O TSE publica os arquivos do 2º turno quando a totalização começa, depois do fim da votação em ${DATA_2T}. Este painel continua consultando sozinho e preenche tudo assim que os dados aparecerem.</p></div>`
      :`<div class="pending"><div class="headline">Dados ainda não publicados</div><p class="sub">O TSE ainda não disponibilizou os arquivos deste turno.</p></div>`;
    if(!S.err) setLive('Aguardando publicação do TSE',null);
    return;
  }
  if(!d||!d.br){ applyPage(); return; }

  const sm=viewSum(d);
  const b=d.br;
  if(!S.err) setLive(`TSE: ${b.dg} ${b.hg}`,true);
  $('#body').hidden=false; applyPage();
  syncFilters();
  document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.view===S.view));
  if(!sm){ $('#sumPanel').innerHTML=S.zon&&!S.sec?'<div class="skel">Escolha uma seção ou carregue todas as urnas da zona (aviso acima).</div>':S.sec&&S.secFail?'<div class="skel">Esta urna ainda não tem boletim publicado pelo TSE.</div>':'<div class="skel">Carregando este recorte…</div>'; $('#duel').innerHTML=''; $('#rank').innerHTML=''; $('#curve').innerHTML=''; $('#rkv').innerHTML=''; }
  else if(S.page==='home'){ renderSummary(sm); renderDuel(sm); renderCands(sm,d); }
  if(S.page==='home'){ renderUrnaNote(d); renderRank(sm||d.br,d); }
  if(S.page==='map'){ renderMap(d); renderLead(d); renderRegions(d); }
  if(S.page==='states') renderTable(d);
  if(S.page==='abroad') renderAbroad(d);
  tickLabel();
}

function renderUrnaNote(d){
  const n=$('#urnaNote'); if(!S.mun){ n.className='notice'; n.innerHTML=''; return; }
  let h='';
  const zs=zonesOf();
  if(S.zon&&!S.sec){
    const z=zoneObj(); if(z){
      const have=zoneSecs(d).length, need=z.sec.length-have, pr=S.zoneProg;
      if(pr&&pr.run) h=`Carregando urnas da zona ${zn(S.zon)}: ${N(pr.done)} de ${N(pr.total)}…<div class="prog"><i style="width:${pr.total?pr.done/pr.total*100:0}%"></i></div>`;
      else if(need>0) h=`<b>Zona ${zn(S.zon)} · ${N(have)} de ${N(z.sec.length)} urnas carregadas</b>O TSE publica um boletim por seção. Para somar a zona, o painel baixa ${N(need)} boletins (${N(need*2)} requisições, poucas por vez). <button class="btn" type="button" data-act="loadzone">Carregar ${N(need)} urnas</button>${pr&&pr.fail?` <span class="hint">(${N(pr.fail)} sem boletim ainda)</span>`:''}`;
      else h=`<b>Zona ${zn(S.zon)}</b>Todas as ${N(z.sec.length)} urnas carregadas. Escolha uma seção para ver uma urna só.`;
    }
  }else if(S.sec){
    const s=(d.sec||{})[secKey(S.mun,S.zon,S.sec)];
    h=s?`<b>Urna da seção ${zn(S.sec)}, zona ${zn(S.zon)}</b>${s.st?'Seção totalizada':'Seção ainda não totalizada'} · dados lidos do boletim de urna (BU) publicado pelo TSE.`:(S.secFail?'<b>Sem boletim de urna</b>O TSE ainda não publicou o boletim desta seção (ou o 2º turno ainda não começou a ser apurado).':'Lendo o boletim de urna…');
  }else{
    h=CS.uf===S.scope?(zs.length?`Este município tem ${zs.length} ${zs.length===1?'zona':'zonas'}. Escolha zona e seção (urna) no topo para ver os votos por urna.`:''):'Carregando a lista de zonas e seções…';
  }
  n.className=h?'notice show':'notice'; n.innerHTML=h;
}
function statusChip(s){
  if(s.and==='f') return '<span class="chip final">Totalização final</span>';
  return '<span class="chip parcial">Totalização parcial</span>';
}

function headlineFor(sm){
  const [a,b2]=sm.cands; if(!a||!sm.vv) return {h:'Aguardando os primeiros votos',s:'Nenhuma seção totalizada ainda neste recorte.'};
  const nm=nameOf(a);
  const where=isBR()?'':` em ${scopeLabel()}`;
  if(sm.cands.some(c=>c.eleito)&&isBR()){
    const e=sm.cands.find(c=>c.eleito); return {h:`${nameOf(e)} eleito(a) presidente`,s:`Resultado confirmado pelo TSE com ${P(e.pct)} dos votos válidos.`};
  }
  if(isBR()&&sm.and==='f'&&a.seg&&b2&&b2.seg&&S.turno===1) return {h:`${nm} e ${nameOf(b2)} vão ao 2º turno`,s:`Nenhum candidato passou de 50% dos votos válidos. O 2º turno será em ${DATA_2T}.`};
  if(S.turno===1){
    if(a.pct>50) return {h:`${nm} lidera${where} com mais de 50% dos votos válidos`,s:`${P(a.pct)} dos válidos${where}. Passar de 50% dos votos válidos encerra a disputa no 1º turno.`};
    const sec=isBR()&&sm.and==='f'?`Nenhum candidato passou de 50% dos votos válidos: 2º turno em ${DATA_2T}.`:`Nenhum candidato passou de 50% dos votos válidos até aqui.`;
    return {h:`${nm} e ${nameOf(b2)} lideram${where}`,s:sec};
  }
  return {h:`${nm} lidera${where} com ${P(a.pct)}`,s:`Vence quem tiver mais da metade dos votos válidos. Diferença para ${nameOf(b2)}: ${N(a.vap-b2.vap)} votos.`};
}

function renderSummary(sm){
  const hl=headlineFor(sm);
  const compPct=sm.te? sm.comp/sm.te*100:sm.pc, abPct=sm.te? sm.abst/sm.te*100:sm.pa;
  const tvTot=sm.tv||(sm.vv+sm.vb+sm.nulos);
  const pv=tvTot?sm.vv/tvTot*100:0, pb=tvTot?sm.vb/tvTot*100:0, pn=tvTot?sm.nulos/tvTot*100:0;
  $('#sumPanel').innerHTML=`
  <div class="status">${statusChip(sm)}<span>${esc(scopeLabel())} · Presidente · ${S.turno}º turno</span></div>
  <div class="headline">${esc(hl.h)}</div>
  <div class="sub">${esc(hl.s)}</div>
  <div class="stats">
    <div class="stat"><div class="k">Seções totalizadas</div><div class="v">${P(sm.pSec,2)}</div>
      <div class="meter" aria-hidden="true"><i style="width:${sm.pSec}%;background:var(--accent)"></i></div>
      <div class="d">${N(sm.st)} de ${N(sm.ts)} seções</div></div>
    ${sm.te?`<div class="stat"><div class="k">Comparecimento</div><div class="v">${P(compPct)}</div>
      <div class="meter" aria-hidden="true"><i style="width:${compPct}%;background:var(--accent)"></i></div>
      <div class="d">${N(sm.comp)} de ${N(sm.te)} eleitores · abstenção ${P(abPct)} (${N(sm.abst)})</div></div>`
    :`<div class="stat"><div class="k">Eleitores que votaram</div><div class="v">${N(sm.comp)}</div><div class="d">Total de votos registrados na urna. O boletim de urna não informa o eleitorado.</div></div>`}
    <div class="stat"><div class="k">Votos computados</div><div class="v">${N(tvTot)}</div>
      <div class="meter" aria-hidden="true"><i style="width:${pv}%;background:var(--good)"></i><i style="width:${pb}%;background:var(--muted)"></i><i style="width:${pn}%;background:var(--crit)"></i></div>
      <div class="d"><span class="key"><span class="sw" style="background:var(--good)"></span>válidos ${P(pv)}</span> · <span class="key"><span class="sw" style="background:var(--muted)"></span>brancos ${P(pb)}</span> · <span class="key"><span class="sw" style="background:var(--crit)"></span>nulos ${P(pn)}</span></div></div>
  </div>`;
}

function avatar(c,cls){
  const col=colorOf(c.n);
  return `<div class="${cls}" style="background:${col}"><img alt="" loading="lazy" src="${esc(photo(S.turno,c))}" onerror="this.remove()"><span style="color:${inkOn(col)}">${esc(nameOf(c).charAt(0))}</span></div>`;
}

function renderDuel(sm){
  $('#duelScope').textContent=`${scopeLabel()} · votos válidos`;
  const [a,c]=sm.cands;
  if(!a||!c||!sm.vv){ $('#duel').innerHTML='<div class="hint">Aguardando votos neste recorte.</div>'; return; }
  const diff=a.vap-c.vap, pp=a.pct-c.pct, tot=a.pct+c.pct;
  const side=(x,r)=>`<div class="dside${r?' r':''}">${avatar(x,'ava')}<div><div class="nm">${esc(nameOf(x))}</div><div class="mt">nº ${esc(x.n)} · ${esc(x.sg)}</div><div class="pc" style="color:${colorOf(x.n)}">${P(x.pct)}</div><div class="vt">${N(x.vap)} votos</div></div></div>`;
  $('#duel').innerHTML=`
  <div class="duelx">${side(a,false)}<div class="dmid"><b>${N(pp,2)} p.p.</b>${N(diff)} votos<br>de diferença</div>${side(c,true)}</div>
  <div class="splitwrap"><div class="split" aria-hidden="true"><i style="width:${a.pct/tot*100}%;background:${colorOf(a.n)}"></i><i style="width:${c.pct/tot*100}%;background:${colorOf(c.n)}"></i></div>
  <div class="cap">Barra proporcional ao total dos dois primeiros colocados.</div></div>`;
}

function renderCands(sm,d){
  $('#rankTitle').textContent=S.view==='curve'?`Curva dos 3 primeiros · ${scopeLabel()}`:`Candidatos · ${scopeLabel()} · votos válidos`;
  $('#rank').hidden=S.view!=='nom'; $('#curve').hidden=S.view!=='curve';
  if(S.view==='curve'){ renderCurve(sm,d); $('#rankNote').textContent=''; return; }
  $('#rank').innerHTML=sm.cands.map(c=>{
    const col=colorOf(c.n);
    const tip=`${nameOf(c)} (${c.n})\n${N(c.vap)} votos · ${P(c.pct)} dos válidos${c.vice?'\nVice: '+title(c.vice):''}`;
    return `<div class="cand" data-tip="${esc(tip)}">
      ${avatar(c,'ph')}
      <div class="who"><b>${esc(nameOf(c))}</b><span>nº ${esc(c.n)} · ${esc(c.sg)}${c.vice?' · vice '+esc(title(c.vice)):''}</span>${isBR()?(c.eleito?'<span class="badge">Eleito</span>':c.seg?'<span class="badge b2">2º turno</span>':''):''}</div>
      <div class="num"><b>${P(c.pct)}</b><span>${N(c.vap)}</span></div>
      <div class="bar"><i style="width:${Math.min(100,c.pct)}%;background:${col}"></i><u title="50%"></u></div>
    </div>`;
  }).join('')||'<div class="hint">Sem votos apurados neste recorte.</div>';
  $('#rankNote').textContent='A linha vertical marca 50% dos votos válidos. Votos em branco e nulos não entram na porcentagem.';
}

/* ---------- gráfico de linhas genérico ---------- */
function lineChart(el,o){
  const W=760,H=300,L=46,R=18,T=14,B=34;
  const xs=[...new Set(o.series.flatMap(s=>s.pts.map(p=>p[0])))].sort((a,b)=>a-b);
  const ys=o.series.flatMap(s=>s.pts.map(p=>p[1]));
  let lo=Math.floor(Math.min.apply(null,ys)-1.5), hi=Math.ceil(Math.max.apply(null,ys)+1.5);
  if(hi<50&&50-hi<=6) hi=51; if(lo>50&&lo-50<=6) lo=49;
  lo=Math.max(0,lo); hi=Math.min(100,hi); if(hi-lo<4) hi=lo+4;
  if(o.ylo!=null){ lo=o.ylo; hi=o.yhi; }
  const xmin=xs[0],xmax=xs[xs.length-1];
  const X=v=>L+(W-L-R)*(v-xmin)/((xmax-xmin)||1), Y=v=>T+(H-T-B)*(1-(Math.min(hi,Math.max(lo,v))-lo)/(hi-lo));
  const step=[1,2,5,10,20].find(s=>(hi-lo)/s<=5)||20;
  let g='';
  for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step) g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${L-8}" y="${Y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}%</text>`;
  g+=o.xticks(xmin,xmax,xs).map(t=>`<text x="${X(t[0])}" y="${H-10}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${esc(t[1])}</text>`).join('');
  if(lo<50&&50<hi) g+=`<line x1="${L}" x2="${W-R}" y1="${Y(50)}" y2="${Y(50)}" stroke="var(--ink)" stroke-dasharray="4 4" opacity=".45"/><text x="${W-R}" y="${Y(50)-4}" text-anchor="end" font-size="10.5" fill="var(--muted)">50%</text>`;
  o.series.forEach(s=>{
    const d=s.pts.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join(' ');
    g+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
    if(s.pts.length<=40) s.pts.forEach(p=>g+=`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3" fill="${s.color}"/>`);
    const e=s.pts[s.pts.length-1]; g+=`<circle cx="${X(e[0]).toFixed(1)}" cy="${Y(e[1]).toFixed(1)}" r="5" fill="${s.color}" stroke="var(--glass-solid)" stroke-width="2"/>`;
  });
  el.insertAdjacentHTML('beforeend',`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria)}">${g}<line class="vl" y1="${T}" y2="${H-B}" stroke="var(--ink)" opacity="0"/><rect class="hit" x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent"/></svg>`);
  const svg=el.querySelector('svg'),hit=svg.querySelector('.hit'),vl=svg.querySelector('.vl');
  hit.addEventListener('mousemove',ev=>{
    const r=svg.getBoundingClientRect(); const px=(ev.clientX-r.left)/r.width*W;
    const xv=xmin+(px-L)/(W-L-R)*(xmax-xmin);
    let best=xs[0]; xs.forEach(x=>{if(Math.abs(x-xv)<Math.abs(best-xv)) best=x});
    vl.setAttribute('x1',X(best)); vl.setAttribute('x2',X(best)); vl.setAttribute('opacity','.35');
    showTip(o.tipFn(best),ev.clientX,ev.clientY);
  });
  hit.addEventListener('mouseleave',()=>{vl.setAttribute('opacity','0');tip.classList.remove('on')});
}

function timeData(d){
  if(S.mun){
    if(CS.uf!==S.scope){ loadCs(S.scope); return {wait:'Carregando a lista de seções e horários do município…'}; }
    const list=urnaList(), units=[];
    list.forEach(([z,n])=>{ const k=secKey(S.mun,z,n), s=d.sec&&d.sec[k], tm=CS.secT&&CS.secT[k]; if(s&&s.vv&&tm) units.push({t:tm,s}); });
    return {kind:'urna',units,total:list.length,need:list.length-units.length};
  }
  if(!MUNCFG){ ensureMunCfg(); return {wait:'Carregando a lista de municípios do TSE…'}; }
  const ufs=selUFs().filter(u=>u!=='zz'); const units=[]; let total=0,needC=0;
  ufs.forEach(u=>(MUNCFG[u]||[]).forEach(m=>{ total++; const s=d.mun&&d.mun[m.cd]; if(!s) needC++; const tm=TIMES.mun[m.cd]; if(s&&s.vv&&tm) units.push({t:tm.l,s}); }));
  const needT=ufs.filter(u=>!TIMES.done[u]).length;
  return {kind:'mun',units,total,need:needC||needT,needLabel:needC?`${N(needC)} municípios`:`${N(needT)} arquivos de horário`,ufs};
}
function renderTimeCurve(el,sm,d,top){
  if(S.sec){ el.insertAdjacentHTML('beforeend','<div class="hint">Uma urna só não tem curva. Escolha um município ou uma zona (ou tire o filtro de seção).</div>'); return; }
  const T=timeData(d);
  if(T.wait){ el.insertAdjacentHTML('beforeend',`<div class="hint">${T.wait}</div>`); return; }
  const unit=T.kind==='urna'?'urnas':'municípios';
  const prog=[S.zoneProg,S.cityProg,S.timeProg].filter(p=>p&&p.run);
  if(prog.length){ const dn=prog.reduce((s,p)=>s+p.done,0), tt=prog.reduce((s,p)=>s+p.total,0); el.insertAdjacentHTML('beforeend',`<div class="hint">Carregando dados do TSE: ${N(dn)} de ${N(tt)}…</div><div class="prog"><i style="width:${tt?dn/tt*100:0}%"></i></div>`); }
  else if(T.need>0){
    const lbl=T.kind==='urna'?`${N(T.need)} urnas (${N(T.need*2)} requisições)`:T.needLabel;
    el.insertAdjacentHTML('beforeend',`<div class="hint">${T.units.length?N(T.units.length)+' de '+N(T.total)+' '+unit+' já carregados. ':''}${T.kind==='urna'?'Cada urna é um boletim de urna lido do TSE.':'Cada município vem de um arquivo do TSE; o horário vem da configuração de cada estado.'} <button class="btn" type="button" data-act="loadtime">Carregar ${lbl}</button>${T.need>2000?' <span class="hint">Volume grande: pode levar alguns minutos.</span>':''}</div>`);
  }
  if(T.units.length<2){ el.insertAdjacentHTML('beforeend',`<div class="hint">A curva aparece quando ao menos duas ${unit} estiverem carregadas.</div>`); return; }
  const U=T.units.slice().sort((a,b)=>a.t-b.t);
  const sums={}; top.forEach(c=>sums[c.n]=0);
  const pts={}; top.forEach(c=>pts[c.n]=[]); const rec={}; let vv=0;
  const totVV=U.reduce((s,u)=>s+u.s.vv,0), thr=totVV*0.01, keep=[];
  U.forEach((u,i)=>{
    vv+=u.s.vv; u.s.cands.forEach(c=>{ if(c.n in sums) sums[c.n]+=c.vap; });
    if(!vv) return; const p={};
    top.forEach(c=>{ const v=sums[c.n]/vv*100; p[c.n]=v; pts[c.n].push([u.t,v]); if(vv>=thr) keep.push(v); });
    rec[u.t]={p,n:i+1,vv};
  });
  let lo=Math.floor(Math.min.apply(null,keep)-1.5), hi=Math.ceil(Math.max.apply(null,keep)+1.5);
  if(hi<50&&50-hi<=6) hi=51; if(lo>50&&lo-50<=6) lo=49; lo=Math.max(0,lo); hi=Math.min(100,hi); if(hi-lo<4) hi=lo+4;
  const series=top.map(c=>({name:nameOf(c),color:colorOf(c.n),pts:pts[c.n]}));
  const fmtT=(t,span)=>{const x=new Date(t).toISOString();return span>864e5?x.slice(8,10)+'/'+x.slice(5,7)+' '+x.slice(11,16):x.slice(11,16)};
  const t0=U[0].t,t1=U[U.length-1].t;
  el.insertAdjacentHTML('beforeend',`<div class="cvhead">Votos acumulados em ${esc(scopeLabel())}, na ordem em que ${T.kind==='urna'?'cada urna foi apurada':'cada município terminou de ser apurado (horário da última urna dele)'}. Cada ponto soma mais ${T.kind==='urna'?'uma urna':'um município'}; a linha mostra como o resultado se aproxima do final. ${N(U.length)} de ${N(T.total)} ${unit} (horário de Brasília).</div>`);
  lineChart(el,{series,ylo:lo,yhi:hi,aria:'Evolução acumulada dos três primeiros colocados pela ordem de apuração',
    xticks:(a,b)=>{const out=[];for(let i=0;i<=4;i++){const x=a+(b-a)*i/4;out.push([x,fmtT(x,b-a)])}return out},
    tipFn:x=>{const r=rec[x]; if(!r) return fmtT(x,0); return `${fmtT(x,0)} · ${N(r.n)} ${unit} apurad${T.kind==='urna'?'as':'os'}\n`+top.map(c=>`${nameOf(c)}: ${P(r.p[c.n])}`).join('\n')}});
  el.insertAdjacentHTML('beforeend',`<div class="legend-note">Primeira: ${esc(fmtT(t0,t1-t0))} · última: ${esc(fmtT(t1,t1-t0))}. Antes de 1% dos votos acumulados, a linha pode sair da escala.</div>`);
}
function renderCurve(sm,d){
  const el=$('#curve'); const top=sm.cands.slice(0,3);
  const axes=[['tempo','Tempo · urnas por horário'],['regiao','Região'],['estado','Estado']];
  const bar=ax=>`<div class="axes">Eixo horizontal: <div class="seg sm" role="group" aria-label="Eixo da curva">${axes.map(([k,l])=>`<button type="button" data-cx="${k}" aria-pressed="${ax===k}">${l}</button>`).join('')}</div></div>`;
  if(!top.length||!sm.vv){ el.innerHTML=bar(S.cx)+'<div class="hint">Aguardando votos neste recorte.</div>'; return; }
  const ax=S.cx;
  const leg=`<div class="cleg">${top.map(c=>`<span class="key"><span class="sw" style="background:${colorOf(c.n)}"></span><b>${esc(nameOf(c))}</b> ${P(c.pct)}</span>`).join('')}</div>`;
  el.innerHTML=bar(ax)+leg;
  if(ax==='tempo'){ renderTimeCurve(el,sm,d,top); return; }
  let cats=[];
  if(ax==='regiao'){
    cats=Object.keys(REGION).filter(r=>r!=='Exterior').map(r=>({l:r,n:r,s:aggregate(d,REGION[r])})).filter(x=>x.s);
  }else{
    const ufs=UFS.filter(u=>u!=='zz'&&d.uf[u]&&d.uf[u].vv&&(S.region==='all'||UF2REG[u]===S.region));
    const f=u=>{const c=d.uf[u].cands.find(x=>x.n===top[0].n);return c?c.pct:0};
    ufs.sort((a,b)=>f(a)-f(b));
    cats=ufs.map(u=>({l:u.toUpperCase(),n:UFNAME[u],s:d.uf[u]}));
  }
  if(cats.length<2){ el.insertAdjacentHTML('beforeend','<div class="hint">Poucos dados para este eixo neste filtro.</div>'); return; }
  const ser=top.map(c=>({name:nameOf(c),color:colorOf(c.n),pts:cats.map((x,i)=>{const q=x.s.cands.find(z=>z.n===c.n);return [i,q?q.pct:0]})}));
  el.insertAdjacentHTML('beforeend',`<div class="cvhead">${ax==='regiao'?'Os 3 primeiros do recorte atual em cada região.':'Os 3 primeiros do recorte atual em cada estado, em ordem crescente de votos de '+esc(first(top[0]))+'.'}</div>`);
  lineChart(el,{series:ser,aria:'Perfil dos três primeiros colocados por '+(ax==='regiao'?'região':'estado'),
    xticks:()=>cats.map((x,i)=>[i,x.l]),
    tipFn:x=>`${cats[x].n}\n`+ser.map(s=>`${s.name}: ${P(s.pts[x][1],1)}`).join('\n')});
}

/* ---------- ranking por candidato ---------- */
function rkEntities(d,lvl){
  if(lvl==='reg') return Object.keys(REGION).map(r=>({t:'r',id:r,label:r,sub:'',s:aggregate(d,REGION[r])})).filter(x=>x.s&&x.s.vv);
  if(lvl==='uf') return UFS.filter(u=>S.region==='all'||UF2REG[u]===S.region).map(u=>({t:'u',id:u,label:UFNAME[u],sub:u.toUpperCase(),s:d.uf[u]})).filter(x=>x.s&&x.s.vv);
  const out=[]; (rkCityUFs(lvl)).forEach(u=>((MUNCFG&&MUNCFG[u])||[]).forEach(m=>{const s=d.mun&&d.mun[m.cd]; if(s&&s.vv) out.push({t:'m',id:m.cd,uf:u,label:m.nm,sub:u.toUpperCase(),s})}));
  return out;
}
function rkCityUFs(lvl){
  if(lvl==='mun-uf') return (S.scope!=='br'&&S.scope!=='zz')?[S.scope]:[];
  return (S.region==='all'?UFS:REGION[S.region]).filter(u=>u!=='zz');
}
function renderRank(sm,d){ const el=$('#rkv'); if(!el.dataset.init||el.dataset.t!==String(S.turno)){ el.dataset.init=1; el.dataset.t=S.turno; } paintRank(); }
function paintRank(){
  const d=S.data[S.turno]; const el=$('#rkv'); if(!d||!d.br||S.page!=='home') return;
  const R=S.rk, lvl=R.lvl, sm=viewSum(d)||d.br;
  const cn=(R.cand&&d.br.cands.some(c=>c.n===R.cand))?R.cand:(sm.cands[0]?sm.cands[0].n:d.br.cands[0].n);
  const cm=d.br.cands.find(c=>c.n===cn);
  const lv=[['reg','Região (Brasil)'],['uf','Estado (Brasil)'],['mun','Cidade (Brasil)'],['mun-uf','Cidade (no estado)']];
  if(el.querySelector('#rkBody')&&document.activeElement&&document.activeElement.id==='rkCand'){ /* mantém o seletor aberto durante o carregamento */ }
  const head=`<div class="rkbar">
    <label class="f" for="rkCand">Candidato<select id="rkCand">${d.br.cands.map(c=>`<option value="${c.n}"${c.n===cn?' selected':''}>${esc(nameOf(c))} (${c.n})</option>`).join('')}</select></label>
    <div class="seg sm" role="group" aria-label="Nível do ranking">${lv.map(([k,l])=>`<button type="button" data-rl="${k}" aria-pressed="${lvl===k}">${l}</button>`).join('')}</div>
    <div class="seg sm" role="group" aria-label="Medida"><button type="button" data-rm="pct" aria-pressed="${R.metric==='pct'}">% dos válidos</button><button type="button" data-rm="vap" aria-pressed="${R.metric==='vap'}">Votos</button></div>
    <div class="seg sm" role="group" aria-label="Ordem"><button type="button" data-rd="-1" aria-pressed="${R.dir===-1}">Maiores</button><button type="button" data-rd="1" aria-pressed="${R.dir===1}">Menores</button></div>
  </div>`;
  let body='';
  const isCity=lvl==='mun'||lvl==='mun-uf';
  let info='';
  if(isCity){
    const ufs=rkCityUFs(lvl);
    if(lvl==='mun-uf'&&!ufs.length){ el.innerHTML=head+'<div class="hint">Escolha um estado no filtro (ou clique nele no mapa) para ver o ranking das cidades dele.</div>'; return; }
    if(!MUNCFG){ ensureMunCfg(); el.innerHTML=head+'<div class="hint">Carregando a lista de municípios do TSE…</div>'; return; }
    const need=[]; ufs.forEach(u=>(MUNCFG[u]||[]).forEach(m=>{ if(!(d.mun&&d.mun[m.cd])) need.push(m.cd) }));
    const total=ufs.reduce((s,u)=>s+(MUNCFG[u]||[]).length,0), have=total-need.length, pr=S.cityProg;
    if(pr&&pr.run){ info=`<div class="hint">Carregando cidades do TSE: ${N(pr.done)} de ${N(pr.total)}…</div><div class="prog"><i style="width:${pr.total?pr.done/pr.total*100:0}%"></i></div>`; }
    else if(need.length){ info=`<div class="hint">${have?N(have)+' de '+N(total)+' cidades carregadas. ':''}O TSE publica um arquivo por município; este painel baixa ${N(need.length)} deles, poucos por vez, só quando você pedir. <button class="btn" type="button" data-act="loadcities">Carregar ${N(need.length)} cidades</button>${pr&&pr.fail?` <span class="hint">(${N(pr.fail)} sem dados ainda)</span>`:''}</div>`; }
    else info=`<div class="hint">${N(total)} cidades carregadas. Os números só mudam quando você recarregar: <button class="linkbtn" type="button" data-act="loadcities-force">atualizar cidades</button></div>`;
  }
  let ents=rkEntities(d,lvl).map(x=>{const c=x.s.cands.find(q=>q.n===cn); return Object.assign(x,{pct:c?c.pct:0,vap:c?c.vap:0,lead:x.s.cands[0]})});
  const mk=R.metric==='vap'?'vap':'pct';
  ents.sort((a,b)=>(a[mk]-b[mk])*R.dir||b.vap-a.vap);
  const shown=ents.slice(0,R.lim);
  const col=colorOf(cn);
  body=shown.map((x,i)=>{
    const big=R.metric==='vap'?N(x.vap):P(x.pct,2), small=R.metric==='vap'?P(x.pct,1):N(x.vap)+' votos';
    const tip=`${x.label}${x.sub?' · '+x.sub:''}\n${nameOf(cm)}: ${P(x.pct,2)} (${N(x.vap)} votos)\n1º lugar: ${x.lead?nameOf(x.lead)+' '+P(x.lead.pct,1):'—'}\nVotos válidos: ${N(x.s.vv)}`;
    return `<button type="button" class="rkrow" data-rk="${x.t}:${x.id}:${x.uf||''}" data-tip="${esc(tip)}"><span class="pos">${i+1}</span><span class="nm">${esc(x.label)}${x.sub?`<small>${esc(x.sub)}</small>`:''}</span><span class="val">${big}<small>${small}</small></span><span class="bar"><i style="width:${Math.min(100,x.pct)}%;background:${col}"></i></span></button>`;
  }).join('');
  const more=ents.length>shown.length?`<div style="text-align:center;margin-top:10px"><button class="btn" type="button" data-act="more">Mostrar mais (${N(ents.length-shown.length)} restantes)</button></div>`:'';
  const rkTxt=`<div class="hint" style="margin-bottom:6px">${esc(nameOf(cm))} · ${ents.length?N(ents.length)+' '+(lvl==='reg'?'regiões':lvl==='uf'?'estados':'cidades'):'sem dados ainda'}${(lvl==='uf'||isCity)&&S.region!=='all'&&lvl!=='mun-uf'?' · dentro de '+esc(S.region):''}. Clique numa linha para filtrar o painel por ela.</div>`;
  el.innerHTML=head+info+rkTxt+(body||'<div class="hint">Sem resultados carregados para este nível.</div>')+more;
}

/* ---------- exterior: país a país ---------- */
function renderAbroad(d){
  ensureMunCfg();
  const list=(MUNCFG&&MUNCFG.zz)||[];
  const have=list.filter(m=>d.mun&&d.mun[m.cd]).length, key='zz'+S.turno;
  if(MUNCFG&&have<list.length&&!(S.cityProg&&S.cityProg.run)&&!S.autoCity[key]){ S.autoCity[key]=1; loadCities(['zz']); }
  const by={}, posts={};
  list.forEach(m=>{ const s=d.mun&&d.mun[m.cd], id=EXT.c[m.cd]; if(s&&s.vv&&id){ (by[id]=by[id]||[]).push(s); posts[id]=(posts[id]||0)+1; } });
  const ag={}; Object.keys(by).forEach(id=>ag[id]=aggList(d,by[id]));
  const z=d.uf.zz, lz=leaders(z), pr=S.cityProg&&S.cityProg.run?S.cityProg:null;
  $('#extHint').textContent=list.length?`${N(have)} de ${N(list.length)} postos consulares com resultado`:'Carregando lista de postos…';
  $('#extSum').innerHTML=(lz?`<div class="hint" style="margin-bottom:8px">Total no Exterior: <b>${esc(nameOf(lz.a))}</b> lidera com ${P(lz.a.pct,1)} de ${N(z.vv)} votos válidos${lz.b?` · 2º ${esc(nameOf(lz.b))} ${P(lz.b.pct,1)}`:''}.</div>`:'')+(pr?`<div class="prog"><i style="width:${pr.total?pr.done/pr.total*100:0}%"></i></div>`:'');
  const seen={}; let g='';
  Object.keys(EXT.p).forEach(id=>{
    const a=ag[id], ld=leaders(a), dim=S.cand&&(!ld||ld.a.n!==S.cand);
    if(ld) seen[ld.a.n]=ld.a;
    const tip=a?`${EXT.n[id]} (${posts[id]} ${posts[id]===1?'posto':'postos'})\n1º ${nameOf(ld.a)} ${P(ld.a.pct,1)}\n2º ${ld.b?nameOf(ld.b)+' '+P(ld.b.pct,1):'—'}\n${N(a.vv)} votos válidos`:'';
    g+=`<g class="cty${dim?' dim':''}"${tip?` data-tip="${esc(tip)}"`:''}><path d="${EXT.p[id]}" fill="${ld?colorOf(ld.a.n):'var(--grid)'}"/></g>`;
  });
  $('#extMap').innerHTML=`<svg viewBox="${EXT.vb}" role="img" aria-label="Mapa-múndi com o primeiro colocado em cada país">${g}</svg>`;
  $('#extKeys').innerHTML=Object.values(seen).sort((x,y)=>y.vap-x.vap).map(c=>`<button type="button" class="keyb" data-cand="${c.n}" aria-pressed="${S.cand===c.n}"><span class="sw" style="background:${colorOf(c.n)}"></span>${esc(nameOf(c))}</button>`).join('')+(S.cand?'<button type="button" class="linkbtn" data-cand="">limpar filtro de candidato</button>':'');
  const rows=Object.keys(ag).map(id=>({id,a:ag[id],l:leaders(ag[id])})).filter(r=>r.l).sort((x,y)=>y.a.vv-x.a.vv);
  const unm=list.filter(m=>!EXT.c[m.cd]).map(m=>m.nm);
  $('#extTbl').innerHTML=rows.length?`<table style="min-width:620px"><thead><tr><th class="l">País</th><th class="l">1º colocado</th><th>%</th><th class="l">2º colocado</th><th>%</th><th>Votos válidos</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="l"><b>${esc(EXT.n[r.id])}</b> <small class="hint">${posts[r.id]} ${posts[r.id]===1?'posto':'postos'}</small></td><td class="l"><span class="lead"><span class="sw" style="background:${colorOf(r.l.a.n)}"></span>${esc(nameOf(r.l.a))}</span></td><td>${P(r.l.a.pct,1)}</td><td class="l">${r.l.b?`<span class="lead"><span class="sw" style="background:${colorOf(r.l.b.n)}"></span>${esc(nameOf(r.l.b))}</span>`:'—'}</td><td>${r.l.b?P(r.l.b.pct,1):'—'}</td><td>${N(r.a.vv)}</td></tr>`).join('')}</tbody></table>`:'<div class="hint">Os países aparecem conforme os resultados dos postos forem carregados.</div>';
  if(unm.length) $('#extTbl').insertAdjacentHTML('beforeend',`<div class="extnote">Postos sem país associado (não desenhados): ${esc(unm.join(', '))}. Países muito pequenos podem ficar quase invisíveis no mapa; use a tabela.</div>`); else $('#extTbl').insertAdjacentHTML('beforeend','<div class="extnote">Cada posto consular foi associado ao seu país; países muito pequenos podem ficar quase invisíveis no mapa, use a tabela. Guiana Francesa aparece junto com a França.</div>');
}

/* ---------- quem lidera nos estados selecionados ---------- */
function renderLead(d){
  const el=$('#lead'); const ufs=selUFs().filter(u=>d.uf[u]&&d.uf[u].vv);
  if(!ufs.length){ el.innerHTML=''; return; }
  const where=S.scope!=='br'?UFNAME[S.scope]:S.region!=='all'?(S.region==='Exterior'?'Exterior':'Região '+S.region):'todos os estados';
  if(ufs.length===1){
    const s=d.uf[ufs[0]];
    el.innerHTML=`<h3>Candidatos com votos · ${esc(where)}</h3>`+s.cands.filter(c=>c.vap>0).slice(0,4).map(c=>`<div class="lrow"><div class="lh"><span class="sw" style="background:${colorOf(c.n)}"></span><b>${esc(nameOf(c))}</b><span>${P(c.pct,1)} · ${N(c.vap)} votos</span></div></div>`).join('');
    return;
  }
  const by={};
  ufs.forEach(u=>{const l=leaders(d.uf[u]); if(l){(by[l.a.n]=by[l.a.n]||{c:l.a,st:[]}).st.push({u,p:l.a.pct})}});
  const ag=aggregate(d,ufs);
  const rows=Object.values(by).sort((x,y)=>y.st.length-x.st.length||y.c.vap-x.c.vap).map(r=>{
    const tot=ag&&ag.cands.find(c=>c.n===r.c.n);
    return `<div class="lrow"><div class="lh"><span class="sw" style="background:${colorOf(r.c.n)}"></span><b>${esc(nameOf(r.c))}</b><span>lidera ${r.st.length} de ${ufs.length} ${ufs.length===1?'estado':'estados'}${tot?' · '+P(tot.pct,1)+' dos válidos no conjunto':''}</span></div>
      <div class="pills">${r.st.sort((a,b)=>b.p-a.p).map(x=>`<button type="button" class="pill" data-uf="${x.u}" data-tip="${esc(UFNAME[x.u]+'\n1º '+nameOf(r.c)+' '+P(x.p,1))}">${x.u.toUpperCase()} ${N(x.p,1)}%</button>`).join('')}</div></div>`;
  }).join('');
  el.innerHTML=`<h3>Quem lidera · ${esc(where)}</h3>`+rows;
}

/* ---------- mapa, regiões, tabela ---------- */
function leaders(sm){const a=sm&&sm.cands[0],b=sm&&sm.cands[1];return (a&&sm.vv)?{a,b}:null}

const UFCODE={ac:12,al:27,ap:16,am:13,ba:29,ce:23,df:53,es:32,go:52,ma:21,mt:51,ms:50,mg:31,pa:15,pb:25,pr:41,pe:26,pi:22,rj:33,rn:24,rs:43,ro:11,rr:14,sc:42,sp:35,se:28,to:17};
const GEO={};
function geoProject(g){
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  const each=(geom,fn)=>{ if(geom.type==='Polygon') geom.coordinates.forEach(fn); else if(geom.type==='MultiPolygon') geom.coordinates.forEach(p=>p.forEach(fn)); };
  g.features.forEach(f=>each(f.geometry,r=>r.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)})));
  const k=Math.cos((y0+y1)/2*Math.PI/180), W=600, sc=W/((x1-x0)*k), H=(y1-y0)*sc;
  const px=x=>((x-x0)*k*sc).toFixed(1), py=y=>((y1-y)*sc).toFixed(1);
  const items=g.features.map(f=>{let dd='';each(f.geometry,r=>{dd+='M'+r.map(p=>px(p[0])+' '+py(p[1])).join('L')+'Z'});return {id:f.properties.codarea,d:dd}});
  return {vb:`0 0 ${W} ${Math.round(H)}`,items};
}
async function loadGeo(uf){
  if(GEO[uf]||GEO['_'+uf]) return; GEO['_'+uf]=1;
  try{
    const r=await fetch(`https://servicodados.ibge.gov.br/api/v3/malhas/estados/${UFCODE[uf]}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=minima`);
    if(!r.ok) throw new Error('ibge'); GEO[uf]=geoProject(await r.json());
  }catch(e){ GEO[uf]={err:1}; }
  render();
}
function renderMap(d){
  document.querySelectorAll('[data-mm]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mm===S.mapMode));
  if(S.mapMode==='mun'&&S.scope!=='br'&&UFCODE[S.scope]) return renderCityMap(d);
  renderStatesMap(d);
  if(S.mapMode==='mun') $('#msel').innerHTML='<span class="hint">Escolha um estado (clique no mapa ou use o filtro) para ver as cidades dele.</span>';
}
function renderCityMap(d){
  const uf=S.scope; ensureMunCfg(); loadGeo(uf);
  const g=GEO[uf];
  if(!g||g.err){ $('#map').innerHTML=`<div class="hint p">${g&&g.err?'Não foi possível baixar o desenho dos municípios (IBGE).':'Baixando o desenho dos municípios…'}</div>`; $('#keys').innerHTML=''; $('#msel').innerHTML=''; return; }
  const list=MUNCFG?(MUNCFG[uf]||[]):[]; const have=list.filter(m=>d.mun&&d.mun[m.cd]).length;
  const key=S.turno+uf;
  if(MUNCFG&&have<list.length&&!(S.cityProg&&S.cityProg.run)&&!S.autoCity[key]){ S.autoCity[key]=1; loadCities([uf]); }
  const seen={}; let h='';
  g.items.forEach(it=>{
    const tt=I2T[it.id], s=tt&&d.mun&&d.mun[tt.cd], ld=leaders(s);
    const dim=S.cand&&(!ld||ld.a.n!==S.cand);
    const fill=ld?colorOf(ld.a.n):'var(--grid)'; if(ld) seen[ld.a.n]=ld.a;
    const nm=tt?(MUNNAME[tt.cd]||tt.cd):'';
    const tip=ld?`${nm}
1º ${nameOf(ld.a)} ${P(ld.a.pct,1)}
2º ${ld.b?nameOf(ld.b)+' '+P(ld.b.pct,1):'—'}`:`${nm}
${s?'Sem votos':'Resultado não carregado'}`;
    h+=`<g class="uf mn${dim?' dim':''}${tt&&S.mun===tt.cd?' sel':''}"${tt?` data-mn="${tt.cd}"`:''} data-tip="${esc(tip)}" tabindex="0" role="button" aria-label="${esc(nm)}"><path d="${it.d}" fill="${fill}"/></g>`;
  });
  $('#map').innerHTML=`<svg viewBox="${g.vb}" role="group" aria-label="Mapa dos municípios de ${esc(UFNAME[uf])}">${h}</svg>`;
  const pr=S.cityProg&&S.cityProg.run?S.cityProg:null;
  $('#msel').innerHTML=`<span><b>${esc(UFNAME[uf])}</b> · ${N(have)} de ${N(list.length)} cidades com resultado</span>${pr?`<div class="prog" style="flex:1;min-width:120px;margin:0"><i style="width:${pr.total?pr.done/pr.total*100:0}%"></i></div>`:''} <button class="btn" type="button" data-act="clear" style="min-height:32px;padding:3px 12px">Limpar filtros</button>`;
  $('#keys').innerHTML=Object.values(seen).sort((x,y)=>y.vap-x.vap).map(c=>`<button type="button" class="keyb" data-cand="${c.n}" aria-pressed="${S.cand===c.n}"><span class="sw" style="background:${colorOf(c.n)}"></span>${esc(nameOf(c))}</button>`).join('')+(S.cand?'<button type="button" class="linkbtn" data-cand="">limpar filtro de candidato</button>':'');
}
function renderStatesMap(d){
  const order=Object.keys(MAP.p).sort((a,b)=>(a===S.scope)-(b===S.scope));
  const seen={}; let g='';
  order.forEach(uf=>{
    const sm=d.uf[uf],ld=leaders(sm);
    const dim=(S.region!=='all'&&UF2REG[uf]!==S.region)||(S.cand&&(!ld||ld.a.n!==S.cand));
    const fill=ld?colorOf(ld.a.n):'var(--grid)';
    if(ld) seen[ld.a.n]=ld.a;
    const tip=ld?`${UFNAME[uf]}\n1º ${nameOf(ld.a)} ${P(ld.a.pct,1)}\n2º ${ld.b?nameOf(ld.b)+' '+P(ld.b.pct,1):'—'}\nSeções ${P(sm.pSec,1)}`:`${UFNAME[uf]}\nSem votos apurados`;
    g+=`<g class="uf${dim?' dim':''}${S.scope===uf?' sel':''}" data-uf="${uf}" data-tip="${esc(tip)}" data-fill="${ld?fill:''}" data-pct="${ld?N(ld.a.pct,0)+'%':''}" tabindex="0" role="button" aria-label="${esc(UFNAME[uf])}${ld?': '+esc(nameOf(ld.a))+' lidera':''}"><path d="${MAP.p[uf]}" fill="${fill}"/></g>`;
  });
  $('#map').innerHTML=`<svg viewBox="${MAP.vb}" role="group" aria-label="Mapa do Brasil por estado">${g}</svg>`;
  /* rótulos: só nos estados grandes o bastante */
  document.querySelectorAll('#map .uf').forEach(el=>{
    let bb; try{bb=el.querySelector('path').getBBox()}catch(e){return}
    if(bb.width<24||bb.height<16) return;
    const f=el.dataset.fill, col=f?inkOn(f):'var(--ink)';
    const cx=bb.x+bb.width/2, cy=bb.y+bb.height/2;
    const mk=(txt,y,cls)=>{const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x',cx);t.setAttribute('y',y);t.setAttribute('fill',col);t.setAttribute('stroke','none');if(cls)t.setAttribute('class',cls);t.textContent=txt;el.appendChild(t)};
    const showPct=bb.width>=40&&el.dataset.pct;
    mk(el.dataset.uf.toUpperCase(),cy+(showPct?-1:4));
    if(showPct) mk(el.dataset.pct,cy+10,'p');
  });
  $('#msel').innerHTML=(!isBR()?`<span>Recorte atual: <b>${esc(scopeLabel())}</b></span> <button class="btn" type="button" data-act="clear" style="min-height:32px;padding:3px 12px">Limpar filtros</button>`:'<span class="hint">Clique num estado para filtrar todo o painel. Região, estado e município também podem ser escolhidos no topo.</span>');
  const ex=d.uf.zz,le=leaders(ex);
  const keys=Object.values(seen).sort((x,y)=>y.vap-x.vap).map(c=>`<button type="button" class="keyb" data-cand="${c.n}" aria-pressed="${S.cand===c.n}"><span class="sw" style="background:${colorOf(c.n)}"></span>${esc(nameOf(c))}</button>`);
  $('#keys').innerHTML=keys.join('')+(le?`<button type="button" class="keyb" data-uf="zz" aria-pressed="${S.scope==='zz'}" data-tip="${esc('Exterior\n1º '+nameOf(le.a)+' '+P(le.a.pct,1))}"><span class="sw" style="background:${colorOf(le.a.n)}"></span>Exterior ${N(le.a.pct,0)}%</button>`:'')+(S.cand?`<button type="button" class="linkbtn" data-cand="">limpar filtro de candidato</button>`:'');
}

function renderRegions(d){
  const nat=d.br.cands.slice(0,4).map(c=>c.n);
  const rows=Object.keys(REGION).map(r=>{
    const tot={}; let vv=0;
    REGION[r].forEach(u=>{const s=d.uf[u]; if(!s) return; vv+=s.vv; s.cands.forEach(c=>tot[c.n]=(tot[c.n]||0)+c.vap)});
    if(!vv) return `<div class="reg"><div class="nm">${r}</div><div class="hint">Sem votos apurados</div></div>`;
    const segs=nat.map(n=>({n,v:tot[n]||0}));
    const other=vv-segs.reduce((s,x)=>s+x.v,0);
    const bar=segs.concat(other>0?[{n:'out',v:other}]:[]).map(x=>`<i style="width:${x.v/vv*100}%;background:${x.n==='out'?'var(--muted)':colorOf(x.n)}" data-tip="${esc(r+'\n'+(x.n==='out'?'Outros':nameOf(d.br.cands.find(c=>c.n===x.n)))+' '+P(x.v/vv*100,1)+'\n'+N(x.v)+' votos')}"></i>`).join('');
    const top=segs.slice().sort((a,b)=>b.v-a.v).slice(0,2).map(x=>`${esc(first(d.br.cands.find(c=>c.n===x.n)))} ${P(x.v/vv*100,1)}`).join(' · ');
    return `<div class="reg"><div class="nm">${r}</div><div class="split">${bar}</div><div class="tx">${top} · ${N(vv)} votos válidos</div></div>`;
  });
  $('#regs').innerHTML=rows.join('')+`<div class="keys">${d.br.cands.slice(0,4).map(c=>`<span class="key"><span class="sw" style="background:${colorOf(c.n)}"></span>${esc(nameOf(c))}</span>`).join('')}<span class="key"><span class="sw" style="background:var(--muted)"></span>Outros</span></div>`;
}

function renderTable(d){
  const all=UFS.filter(u=>d.uf[u]).filter(u=>S.region==='all'||UF2REG[u]===S.region).map(u=>{
    const s=d.uf[u],l=leaders(s);
    return {u,name:UFNAME[u],a:l&&l.a,b:l&&l.b,ln:l?nameOf(l.a):'',sn:l&&l.b?nameOf(l.b):'',pa:l?l.a.pct:-1,pb:l&&l.b?l.b.pct:-1,m:l&&l.b?l.a.pct-l.b.pct:-1,sec:s.pSec,comp:s.te?s.comp/s.te*100:s.pc};
  });
  /* resumo: estados (27 UFs, Exterior à parte) e quantos cada candidato lidera */
  const sts=all.filter(r=>r.u!=='zz'), tot=sts.length, led={};
  sts.forEach(r=>{if(r.a) led[r.a.n]=(led[r.a.n]||0)+1});
  const natTop=d.br.cands[0];
  const ids=Object.keys(led); if(natTop&&!led[natTop.n]) ids.push(natTop.n);
  const byNat=n=>d.br.cands.findIndex(c=>c.n===n);
  ids.sort((x,y)=>(led[y]||0)-(led[x]||0)||byNat(x)-byNat(y));
  const nm=n=>{const c=d.br.cands.find(q=>q.n===n);return c?nameOf(c):n};
  let h=`<div class="stbox"><div class="k">Estados no recorte</div><div class="big">${N(tot)}<small>UFs · Exterior à parte</small></div></div>`;
  h+=ids.map(n=>{const q=led[n]||0,pc=tot?q/tot*100:0;
    return `<button type="button" class="stbox" data-cand="${n}" aria-pressed="${S.cand===n}"><div class="k"><span class="sw" style="background:${colorOf(n)}"></span>${esc(nm(n))}${natTop&&natTop.n===n?'<span class="tag1">1º colocado</span>':''}</div><div class="big">${N(q)}<small>${q===1?'estado':'estados'} · ${P(pc,1)}</small></div><div class="mn"><i style="width:${pc}%;background:${colorOf(n)}"></i></div></button>`}).join('');
  $('#stsum').innerHTML=tot?h:'<div class="hint">Carregando estados…</div>';
  $('#tblFilter').innerHTML=S.cand?`Filtrando: estados liderados por ${esc(nm(S.cand))}`:'';

  let rows=all; if(S.cand) rows=rows.filter(r=>r.a&&r.a.n===S.cand);
  const k=S.sort.k,dir=S.sort.d;
  const strK=k==='name'?'name':k==='lead'?'ln':k==='second'?'sn':null;
  rows=rows.slice().sort((x,y)=>(strK?String(x[strK]).localeCompare(String(y[strK]),'pt-BR'):(x[k]-y[k]))*dir);
  const th=(key,label,cls)=>`<th data-k="${key}" class="${cls||''}"${S.sort.k===key?` aria-sort="${dir>0?'ascending':'descending'}" data-arrow="${dir>0?'▲':'▼'}"`:''}>${label}</th>`;
  const lead=c=>c?`<span class="lead"><span class="sw" style="background:${colorOf(c.n)}"></span>${esc(nameOf(c))}</span>`:'—';
  $('#tbl').innerHTML=`<thead><tr>${th('name','Estado','l')}${th('lead','1º colocado','l')}${th('pa','%')}${th('second','2º colocado','l')}${th('pb','%')}${th('m','Diferença (p.p.)')}${th('sec','Seções totalizadas')}${th('comp','Comparecimento')}</tr></thead>
  <tbody>${rows.map(r=>`<tr data-uf="${r.u}" class="${S.scope===r.u?'sel':''}"><td class="l"><b>${r.u.toUpperCase()}</b> ${esc(r.name)}</td><td class="l">${lead(r.a)}</td><td>${r.a?P(r.pa,1):'—'}</td><td class="l">${lead(r.b)}</td><td>${r.b?P(r.pb,1):'—'}</td><td>${r.b?N(r.m,1):'—'}</td><td>${P(r.sec,1)}</td><td>${P(r.comp,1)}</td></tr>`).join('')}</tbody>`;
}

/* ---------- filtros hierárquicos: região > estado > município ---------- */
const sig={};
function fill(sel,opts,val){
  const s=JSON.stringify(opts);
  if(sig[sel.id]!==s){ sel.innerHTML=opts.map(o=>`<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(''); sig[sel.id]=s; }
  sel.value=val;
}
function syncFilters(){
  fill($('#fReg'),[['all','Todas as regiões'],...Object.keys(REGION).map(r=>[r,r])],S.region);
  const ufs=UFS.filter(u=>S.region==='all'||UF2REG[u]===S.region).sort((a,b)=>UFNAME[a].localeCompare(UFNAME[b],'pt-BR'));
  fill($('#fUf'),[['br',S.region==='all'?'Todos (Brasil)':'Todos da região'],...ufs.map(u=>[u,UFNAME[u]])],S.scope);
  const mu=$('#fMun'), noMun=S.scope==='br'||S.scope==='zz';
  const list=(!noMun&&MUNCFG&&MUNCFG[S.scope])||[];
  mu.disabled=noMun;
  fill(mu,[['',noMun?(S.scope==='zz'?'—':'Escolha um estado'):(MUNCFG?'Todos os municípios':'Carregando…')],...list.map(m=>[m.cd,m.nm])],S.mun||'');
  const zs=zonesOf(), zl=document.getElementById('fZon'), sl=document.getElementById('fSec');
  zl.disabled=!S.mun||!zs.length;
  fill(zl,[['',!S.mun?'Escolha um município':(CS.uf===S.scope?(zs.length?'Todas as zonas':'Sem dados de zona'):'Carregando…')],...zs.map(z=>[z.cd,'Zona '+zn(z.cd)+' ('+z.sec.length+')'])],S.zon||'');
  const zo=zoneObj(); sl.disabled=!zo;
  fill(sl,[['',!S.zon?'Escolha uma zona':'Todas as seções'],...(zo?zo.sec:[]).map(n=>[n,'Seção '+zn(n)])],S.sec||'');
  const tg=(k,v)=>`<span class="tg"><i>${k}</i>${esc(v)}</span>`;
  let h=tg('Turno',S.turno+'º');
  if(S.region!=='all') h+=tg('Região',S.region);
  if(S.scope!=='br') h+=tg('Estado',UFNAME[S.scope]);
  if(S.mun) h+=tg('Município',munName()||S.mun);
  if(S.zon) h+=tg('Zona',zn(S.zon));
  if(S.sec) h+=tg('Seção',zn(S.sec));
  if(isBR()) h+=tg('Recorte','Brasil');
  $('#csumTags').innerHTML=h;
}
function afterFilter(){ syncFilters(); render(); }
function setRegion(r){ S.region=r||'all'; S.scope='br'; S.mun=S.zon=S.sec=null; afterFilter(); }          /* trocar a região desmarca estado e município */
function setUf(u){ S.scope=u||'br'; S.mun=S.zon=S.sec=null; if(S.scope!=='br') S.region=UF2REG[S.scope]||'all'; if(S.scope!=='br'&&S.scope!=='zz') ensureMunCfg(); afterFilter(); }   /* trocar o estado desmarca o município */
function setMun(m){
  S.mun=m||null; S.zon=S.sec=null; afterFilter();
  if(S.mun){ loadCs(S.scope); const t=S.turno; loadMun(t,S.scope,S.mun).then(()=>{ if(t===S.turno) render() }); }
}
function setZon(z){ S.zon=z||null; S.sec=null; afterFilter(); }
function setSec(n){
  S.sec=n||null; afterFilter();
  if(S.sec){ const t=S.turno,m=S.mun,z=S.zon,s=S.sec; S.secBusy=true; loadSec(t,S.scope,m,z,s).then(r=>{ S.secBusy=false; S.secFail=!r; if(t===S.turno) render() }); }
}
function clearAll(){ S.region='all'; S.scope='br'; S.mun=S.zon=S.sec=null; S.cand=null; afterFilter(); }

/* ---------- atualização automática ---------- */
function tickLabel(){
  if(S.err) return;
  if(S.missing[S.turno]&&!S.data[S.turno]){ setLive('Aguardando o TSE'+nextTxt(),null); return; }
  const d=S.data[S.turno]; if(!d||!d.br) return;
  setLive(`TSE: ${d.br.dg} ${d.br.hg}${nextTxt()}`,true);
}
function nextTxt(){
  if(!S.auto) return ' · atualização pausada';
  if(S.busy) return ' · atualizando…';
  return ` · próxima em ${Math.max(0,Math.round((S.next-Date.now())/1000))}s`;
}
setInterval(()=>{
  if(document.hidden) return;
  if(S.auto&&!S.busy&&S.next&&Date.now()>=S.next) refresh(); else tickLabel();
},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.auto&&Date.now()>=S.next) refresh()});

/* ---------- interação ---------- */
function setTurno(t){ if(S.turno===t) return; if(S.cityProg) S.cityProg.run=false; S.cityProg=null; S.turno=t; S.gen++; S.busy=false; S.err=null; S.next=0; S.cand=null; $('#sumPanel').innerHTML='<div class="skel">Carregando dados do TSE…</div>'; syncFilters(); render(); refresh(); }
$('#t1').onclick=()=>setTurno(1); $('#t2').onclick=()=>setTurno(2);
$('#fReg').onchange=e=>setRegion(e.target.value);
$('#fUf').onchange=e=>setUf(e.target.value);
$('#fMun').onchange=e=>setMun(e.target.value);
$('#fZon').onchange=e=>setZon(e.target.value);
$('#fSec').onchange=e=>setSec(e.target.value);
$('#fClear').onclick=clearAll;
$('#fOpen').onclick=()=>{ openY=scrollY; $('#top').classList.toggle('open'); };
$('#fClose').onclick=()=>$('#top').classList.remove('open');
$('#auto').onchange=e=>{S.auto=e.target.checked; ls.set('tse26_auto',S.auto?'1':'0'); if(S.auto){S.next=Math.min(S.next||0,Date.now()+INTERVAL*1000)} tickLabel()};
let lastNow=0;
$('#now').onclick=()=>{ if(Date.now()-lastNow<5000) return; lastNow=Date.now(); refresh() };
/* cabeçalho compacto ao rolar; volta ao tamanho cheio ao retornar ao topo */
let openY=0;
function onScroll(){
  const tp=$('#top'), y=window.scrollY||0, c=tp.classList.contains('compact');
  if(!c&&y>150) tp.classList.add('compact');
  else if(c&&y<60) tp.classList.remove('compact','open');
  else if(c&&tp.classList.contains('open')&&Math.abs(y-openY)>220) tp.classList.remove('open');
}
window.addEventListener('scroll',onScroll,{passive:true});
document.addEventListener('change',e=>{ if(e.target&&e.target.id==='rkCand'){ S.rk.cand=e.target.value; paintRank(); } });
document.addEventListener('click',e=>{
  const g=s=>e.target.closest(s);
  let x;
  if(x=g('[data-view]')){S.view=x.dataset.view;ls.set('tse26_view',S.view); render();return}
  if(x=g('[data-go]')){go(x.dataset.go);return}
  if(x=g('[data-mm]')){S.mapMode=x.dataset.mm;render();return}
  if(x=g('[data-cx]')){S.cx=x.dataset.cx;render();return}
  if(x=g('[data-rl]')){S.rk.lvl=x.dataset.rl;S.rk.lim=25; if(S.rk.lvl==='mun'||S.rk.lvl==='mun-uf') ensureMunCfg(); paintRank();return}
  if(x=g('[data-rm]')){S.rk.metric=x.dataset.rm;paintRank();return}
  if(x=g('[data-rd]')){S.rk.dir=+x.dataset.rd;paintRank();return}
  if(x=g('[data-act]')){
    const a=x.dataset.act;
    if(a==='clearhist'){ls.set(histKey(S.turno),'[]');render();return}
    if(a==='clear'){clearAll();return}
    if(a==='loadzone'){loadZone();return}
    if(a==='loadtime'){ const dd=S.data[S.turno]; if(S.mun) loadSecList(urnaList()); else { const ufs=selUFs().filter(u=>u!=='zz'); loadTimes(ufs); loadCities(ufs); } if(dd) renderCurve(viewSum(dd)||dd.br,dd); return }
    if(a==='more'){S.rk.lim+=50;paintRank();return}
    if(a==='loadcities'||a==='loadcities-force'){ loadCities(rkCityUFs(S.rk.lvl),a==='loadcities-force'); paintRank(); return }
  }
  if(x=g('[data-rk]')){ const [t,id,uf]=x.dataset.rk.split(':'); if(t==='r') setRegion(id); else if(t==='u') setUf(id); else { setUf(uf); setMun(id); } window.scrollTo({top:0,behavior:'smooth'}); return }
  if(x=g('[data-cand]')){const n=x.dataset.cand; S.cand=(!n||S.cand===n)?null:n; render();return}
  if(x=g('[data-mn]')){ setMun(x.dataset.mn); return }
  if(x=g('[data-uf]')){ const u=x.dataset.uf; if(u==='br') clearAll(); else setUf(u); if(x.closest('table')) window.scrollTo({top:0,behavior:'smooth'}); return }
  if(x=g('th[data-k]')){const k=x.dataset.k;S.sort=S.sort.k===k?{k,d:-S.sort.d}:{k,d:(k==='name'||k==='lead'||k==='second')?1:-1};render()}
});
document.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('uf')){e.preventDefault(); if(e.target.dataset.mn) setMun(e.target.dataset.mn); else setUf(e.target.dataset.uf)}
});
/* tema: botão discreto de sol e lua */
const ICO_SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICO_MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>';
const isDark=()=>{const a=document.documentElement.getAttribute('data-theme'); return a?a==='dark':(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)};
function applyTheme(m){
  const r=document.documentElement; if(m==='auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme',m);
  document.querySelectorAll('.themeBtn').forEach(b=>{ b.innerHTML=isDark()?ICO_SUN:ICO_MOON; b.title=isDark()?'Mudar para o tema claro':'Mudar para o tema escuro'; });
}
applyTheme(ls.get('tse26_theme')||'auto');
document.querySelectorAll('.themeBtn').forEach(b=>b.onclick=()=>{ const m=isDark()?'light':'dark'; ls.set('tse26_theme',m); applyTheme(m); });
/* dica flutuante */
const tip=$('#tip');
function showTip(t,x,y){tip.textContent=t;tip.classList.add('on');const w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(8,Math.min(innerWidth-w-8,x+14))+'px';tip.style.top=Math.max(8,Math.min(innerHeight-h-8,y+14))+'px'}
document.addEventListener('mousemove',e=>{
  if(e.target.closest&&e.target.closest('.hit')) return;
  const t=e.target.closest&&e.target.closest('[data-tip]'); if(t) showTip(t.dataset.tip,e.clientX,e.clientY); else tip.classList.remove('on')});
document.addEventListener('focusin',e=>{const t=e.target.closest&&e.target.closest('[data-tip]'); if(t){const r=t.getBoundingClientRect(); showTip(t.dataset.tip,r.left,r.bottom)}});
document.addEventListener('focusout',()=>tip.classList.remove('on'));
window.addEventListener('scroll',()=>tip.classList.remove('on'),{passive:true});

/* início */
if(ls.get('tse26_auto')==='0'){S.auto=false;$('#auto').checked=false}
if(ls.get('tse26_view')==='curve') S.view='curve';
{ const h=(location.hash||'').slice(1); if(PAGES.includes(h)) S.page=h; }
window.addEventListener('hashchange',()=>{ const h=(location.hash||'').slice(1); if(PAGES.includes(h)&&h!==S.page) go(h); });
applyPage();
syncFilters();
$('#cfg').textContent=BASE()!==DEFAULT_BASE?'Origem dos dados personalizada: '+BASE():'';
refresh();
})();
