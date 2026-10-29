/* Estatística da página Auditoria. Funções puras (sem DOM, sem rede), para poderem ser testadas à parte. */

/* ---------- distribuições ---------- */
const LG=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
export function lgamma(x){
  let y=x,t=x+5.5; t-=(x+0.5)*Math.log(t); let s=1.000000000190015;
  for(let j=0;j<6;j++) s+=LG[j]/++y;
  return -t+Math.log(2.5066282746310005*s/x);
}
/* cauda superior da qui-quadrado: P(X >= x) com df graus de liberdade (gamma incompleta regularizada) */
export function chi2sf(x,df){
  if(x<=0) return 1; const a=df/2, xx=x/2;
  if(xx<a+1){ let ap=a,sum=1/a,del=sum; for(let n=0;n<500;n++){ ap++; del*=xx/ap; sum+=del; if(Math.abs(del)<Math.abs(sum)*1e-14) break; }
    return Math.max(0,1-sum*Math.exp(-xx+a*Math.log(xx)-lgamma(a))); }
  let b=xx+1-a,c=1e300,d=1/b,h=d;
  for(let i=1;i<500;i++){ const an=-i*(i-a); b+=2; d=an*d+b; if(Math.abs(d)<1e-300)d=1e-300; c=b+an/c; if(Math.abs(c)<1e-300)c=1e-300; d=1/d; const del=d*c; h*=del; if(Math.abs(del-1)<1e-14) break; }
  return Math.min(1,Math.exp(-xx+a*Math.log(xx)-lgamma(a))*h);
}
/* P(X >= k) de uma binomial(n,p), somando as probabilidades em log (estável para n grande) */
export function binomTailGE(n,p,k){
  if(k<=0) return 1; if(k>n) return 0; if(p<=0) return 0; if(p>=1) return 1;
  const lp=Math.log(p), lq=Math.log(1-p), base=lgamma(n+1);
  const lpmf=i=>base-lgamma(i+1)-lgamma(n-i+1)+i*lp+(n-i)*lq;
  let m=-Infinity; const terms=[]; for(let i=k;i<=n;i++){ const t=lpmf(i); terms.push(t); if(t>m) m=t; if(i>k+400&&t<m-40) break; }
  let s=0; for(const t of terms) s+=Math.exp(t-m); return Math.min(1,Math.exp(m)*s);
}
/* teste do sinal bilateral: k de n, sob p=0,5 */
export function signTest(k,n){
  if(n<=0) return 1;
  if(n>200){ const z=(Math.abs(k-n/2)-0.5)/Math.sqrt(n/4); return Math.min(1,2*0.5*erfc(z/Math.SQRT2)); }
  const hi=Math.max(k,n-k); return Math.min(1,2*binomTailGE(n,0.5,hi));
}
export function erfc(x){ const z=Math.abs(x),t=1/(1+0.5*z); const r=t*Math.exp(-z*z-1.26551223+t*(1.00002368+t*(0.37409196+t*(0.09678418+t*(-0.18628806+t*(0.27886807+t*(-1.13520398+t*(1.48851587+t*(-0.82215223+t*0.17087277))))))))); return x>=0?r:2-r; }

/* ---------- Benford ---------- */
export const BENFORD1=[1,2,3,4,5,6,7,8,9].map(d=>Math.log10(1+1/d));
export const BENFORD2=[0,1,2,3,4,5,6,7,8,9].map(d=>{ let s=0; for(let k=1;k<=9;k++) s+=Math.log10(1+1/(10*k+d)); return s; });
const firstDigit=v=>{ const s=String(Math.trunc(Math.abs(v))); return +s[0]; };
const secondDigit=v=>{ const s=String(Math.trunc(Math.abs(v))); return s.length>1?+s[1]:null; };
/* limites de conformidade de Nigrini (MAD) */
const LIM={1:[0.006,0.012,0.015],2:[0.008,0.010,0.012]};
export function benford(values,pos){
  const exp=pos===1?BENFORD1:BENFORD2, off=pos===1?1:0, cnt=new Array(exp.length).fill(0); let n=0;
  for(const v of values){ if(!(v>=(pos===1?1:10))) continue; const d=pos===1?firstDigit(v):secondDigit(v); if(d==null||d-off<0||d-off>=cnt.length) continue; cnt[d-off]++; n++; }
  if(!n) return {pos,n:0,digits:[],chi2:0,df:exp.length-1,p:1,mad:0,cls:'na'};
  let chi2=0,mad=0;
  const digits=exp.map((e,i)=>{ const prop=cnt[i]/n, diff=prop-e; chi2+=n*diff*diff/e; mad+=Math.abs(diff);
    const z=(Math.abs(diff)-1/(2*n))/Math.sqrt(e*(1-e)/n); return {d:i+off,count:cnt[i],prop,exp:e,z:Math.max(0,z)}; });
  mad/=exp.length; const [a,b,c]=LIM[pos];
  const cls=mad<a?'close':mad<b?'acceptable':mad<c?'marginal':'nonconform';
  return {pos,n,digits,chi2,df:exp.length-1,p:chi2sf(chi2,exp.length-1),mad,cls};
}
export const BENFORD_CLS={close:'Conformidade próxima',acceptable:'Conformidade aceitável',marginal:'Conformidade marginal',nonconform:'Não conforme',na:'Sem dados'};

/* ---------- participação do candidato por seção ---------- */
export const shareOf=(s,n)=>{ const vv=s.vv; return vv>0?(s.v[n]||0)/vv:null; };
export function histogram(vals,binW=0.05){
  const nb=Math.round(1/binW), h=new Array(nb).fill(0);
  for(const v of vals){ if(v==null) continue; h[Math.min(nb-1,Math.max(0,Math.floor(v/binW+1e-9)))]++; }
  return h;
}
export const EXTREME=[0.90,0.95,0.98,0.99,1.0];
/* quantas seções têm ao menos t de participação (com piso de votos válidos para não contar urnas minúsculas) */
export function extremeCounts(secs,cand,minValid=50){
  const base=secs.filter(s=>s.vv>=minValid);
  const out=EXTREME.map(t=>({t,n:base.filter(s=>(s.v[cand]||0)/s.vv>=t-1e-12).length}));
  return {base:base.length,rows:out};
}
export const median=a=>{ if(!a.length) return NaN; const b=a.slice().sort((x,y)=>x-y),m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; };
/* seções muito fora do padrão do próprio município (z robusto: mediana e MAD dentro do município).
   Devolve os outliers, o sinal (a favor de qual candidato) e os votos "em excesso" frente à mediana municipal. */
export function localOutliers(secs,candA,candB,{zmin=5,minGroup=15,minValid=50}={}){
  const groups=new Map();
  for(const s of secs){ if(s.vv<minValid) continue; const k=s.uf+'/'+s.mun; (groups.get(k)||groups.set(k,[]).get(k)).push(s); }
  const out=[]; let usable=0, groupsUsed=0;
  for(const g of groups.values()){
    if(g.length<minGroup) continue; groupsUsed++;
    const shares=g.map(s=>(s.v[candA]||0)/s.vv), med=median(shares);
    const mad=Math.max(0.02,1.4826*median(shares.map(x=>Math.abs(x-med))));
    usable+=g.length;
    g.forEach((s,i)=>{ const z=(shares[i]-med)/mad; if(Math.abs(z)>=zmin){
      const fav=z>0?candA:candB, shareFav=z>0?shares[i]:1-shares[i], medFav=z>0?med:1-med;
      out.push({s,z,fav,share:shares[i],med,excess:Math.max(0,(shareFav-medFav)*s.vv)}); } });
  }
  const nA=out.filter(o=>o.fav===candA).length, nB=out.length-nA;
  return {out,nA,nB,usable,groupsUsed,pSign:out.length?signTest(nA,out.length):1,
          excessA:out.filter(o=>o.fav===candA).reduce((t,o)=>t+o.excess,0),excessB:out.filter(o=>o.fav===candB).reduce((t,o)=>t+o.excess,0)};
}

/* ---------- linha do tempo da totalização ---------- */
export function hourly(ts){ const m=new Map(); for(const t of ts){ const h=Math.floor(t/3600000); m.set(h,(m.get(h)||0)+1); } return [...m.entries()].sort((a,b)=>a[0]-b[0]).map(([h,n])=>({t:h*3600000,n})); }
/* maior intervalo entre horários consecutivos de totalização */
export function maxGap(ts){
  if(ts.length<2) return {gap:0,from:0,to:0};
  const a=Float64Array.from(ts).sort(); let g=0,f=0,to=0;
  for(let i=1;i<a.length;i++){ const d=a[i]-a[i-1]; if(d>g){ g=d; f=a[i-1]; to=a[i]; } }
  return {gap:g,from:f,to:to};
}

/* ---------- veredito ---------- */
export const ST={ok:'Sem anomalia',warn:'Atenção',bad:'Anomalia relevante',na:'Não avaliado'};
/* r: {margin,extVotes,gap,secs,benf:{cur,ref},outl,sampleMargin,minSample} — cada teste vira um item com status e texto em números */
export function verdict(r){
  const items=[]; const fmt=x=>Number(x).toLocaleString('pt-BR');
  /* 1. prorrogação: aritmética de influência máxima */
  if(r.extVotes===0) items.push({id:'ext',nome:'Votos após as 17h × margem',st:'na',txt:'A prorrogação de horário ocorreu só no 2º turno; neste turno não há o que testar.'});
  else if(r.margin>0&&r.extVotes>0){
    const ratio=r.extVotes/r.margin;
    items.push({id:'ext',nome:'Votos após as 17h × margem',st:ratio<1?'ok':'bad',
      txt:`${fmt(r.extVotes)} votos depositados após as 17h (dado do TSE) equivalem a ${(ratio*100).toFixed(2).replace('.',',')}% da margem de ${fmt(r.margin)}. Mesmo que todos fossem de um só candidato, ${ratio<1?'a ordem do resultado não mudaria':'o resultado poderia mudar'}.`});
  }else items.push({id:'ext',nome:'Votos após as 17h × margem',st:'na',txt:'Faltam a margem final ou o total de votos após as 17h.'});
  /* 2. lacuna de totalização */
  if(r.gap&&r.gap.gap>0){ const h=r.gap.gap/3600000;
    items.push({id:'gap',nome:'Lacuna na totalização',st:h<6?'ok':h<24?'warn':'bad',
      txt:`O maior intervalo entre dois boletins totalizados foi de ${h.toLocaleString('pt-BR',{maximumFractionDigits:1})} h. Uma pausa de 72 h só apareceria aqui se não houvesse boletins no intervalo; a indisponibilidade do site, em si, não é medida por estes arquivos.`});
  }else items.push({id:'gap',nome:'Lacuna na totalização',st:'na',txt:'A linha do tempo ainda não foi carregada.'});
  /* 3. unanimidade / outliers locais. Há desvios naturais (zonas rurais, indígenas, bairros homogêneos), então só vira "relevante"
        quando pendem para um lado E o excesso estimado pesa na margem da própria amostra. */
  if(r.outl&&r.secs>=r.minSample){
    const o=r.outl, n=o.out.length, frac=o.usable?n/o.usable:0, asym=n>=20&&o.pSign<0.001;
    const net=Math.abs(o.excessA-o.excessB), imp=r.sampleMargin>0?net/r.sampleMargin:0;
    const st=n===0?'ok':asym&&imp>=0.25?'bad':asym||frac>0.005?'warn':'ok';
    const ps=o.pSign<0.001?'<0,001':o.pSign.toFixed(3).replace('.',',');
    items.push({id:'out',nome:'Seções fora do padrão do município',st,
      txt:`${fmt(n)} de ${fmt(o.usable)} seções analisadas (${(frac*100).toFixed(2).replace('.',',')}%) ficam a 5 desvios robustos ou mais da mediana do próprio município${n?`; ${fmt(o.nA)} a favor de um candidato e ${fmt(o.nB)} do outro (teste do sinal p=${ps}). O excesso líquido estimado equivale a ${(imp*100).toFixed(1).replace('.',',')}% da margem da amostra.`:'.'}${asym&&imp<0.25?' Há assimetria, mas o peso dela na margem é pequeno; assimetria também nasce da geografia do voto.':''}`});
  }else items.push({id:'out',nome:'Seções fora do padrão do município',st:'na',txt:`Colete ao menos ${fmt(r.minSample)} boletins para esta análise.`});
  /* 4. Benford (2º dígito, pior dos dois candidatos), sempre contra o outro turno quando houver */
  if(r.benf&&r.benf.cur&&r.benf.cur.n>=500){
    const c=r.benf.cur, f=x=>x.toFixed(4).replace('.',','), ref=r.benf.ref, good=k=>k==='close'||k==='acceptable';
    let st,txt=`${c.who}: MAD ${f(c.mad)} em ${fmt(c.n)} contagens (${BENFORD_CLS[c.cls].toLowerCase()}).`;
    if(good(c.cls)) st='ok';
    else if(!ref){ st='warn'; txt+=' Sem o outro turno como referência, o resultado é inconclusivo: contagens limitadas pelo tamanho da urna podem fugir de Benford sem fraude.'; }
    else if(good(ref.cls)){ st=c.cls==='nonconform'?'bad':'warn'; txt+=` O outro turno ficou ${BENFORD_CLS[ref.cls].toLowerCase()} (MAD ${f(ref.mad)}), então o desvio é específico deste turno.`; }
    else if(c.mad>ref.mad*1.5){ st='warn'; txt+=` O outro turno também desvia (MAD ${f(ref.mad)}), mas bem menos.`; }
    else{ st='ok'; txt+=` O outro turno desvia na mesma ordem (MAD ${f(ref.mad)}): é efeito da estrutura dos dados, não de um turno.`; }
    items.push({id:'ben',nome:'Benford (2º dígito)',st,txt});
  }else items.push({id:'ben',nome:'Benford (2º dígito)',st:'na',txt:'Amostra pequena demais para o teste.'});
  /* 5. biometria / horário de encerramento: só se os arquivos trouxerem o campo */
  items.push({id:'bio',nome:'Biometria × horário estendido',st:r.bio?'ok':'na',txt:r.bio?r.bio:'Os campos de biometria e de horário de encerramento não foram identificados nos boletins lidos; sem eles não dá para separar os dois intervalos. Veja o diagnóstico do boletim na página.'});
  const bad=items.filter(i=>i.st==='bad').length, warn=items.filter(i=>i.st==='warn').length, na=items.filter(i=>i.st==='na').length, ok=items.filter(i=>i.st==='ok').length;
  let head;
  if(bad) head=`${bad} teste(s) com anomalia relevante: merecem verificação direta nos boletins de urna.`;
  else if(warn) head=`${warn} teste(s) em atenção, nenhum com anomalia relevante. Os indícios são compatíveis com heterogeneidade natural do voto e pedem checagem pontual.`;
  else if(ok) head='Nenhum dos testes avaliados encontrou anomalia.';
  else head='Ainda não há testes avaliados.';
  return {items,head,counts:{ok,warn,bad,na}};
}
