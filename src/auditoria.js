/* Página "Auditoria": testes estatísticos sobre os boletins de urna (BU) e a linha do tempo da totalização.
   Tudo roda no navegador, com os arquivos públicos do TSE. O veredito sai dos números coletados: se um campo
   não existe nos arquivos lidos, o teste aparece como "não avaliado" em vez de ser preenchido por suposição. */
import { benford, BENFORD_CLS, histogram, extremeCounts, localOutliers, hourly, maxGap, binomTailGE, verdict, ST, shareOf } from './auditoria-stats.js';

export function createAuditoria(ctx){
  const {N,P,esc,UFNAME,S,BASE,AMB,CICLO,getPleito,decodeBU,colorOf,nameOf,parseTs}=ctx;
  const UFS=Object.keys(UFNAME);
  const REF_17H={votos:34393,fonte:'TSE, levantamento divulgado em 28/10/2026 (CNN Brasil, Diário do Pará)'};
  const MIN_SAMPLE=500;
  const A={sample:5000,scope:'br',lists:{1:null,2:null},tlBusy:false,tlProg:null,tlErr:null,bu:{1:[],2:[]},run:null,diag:null,benSeries:'a',benPos:2,calc:{n:300,p:50},last:0};

  /* ---------- leitura ---------- */
  const csUrl=(pl,uf)=>`${BASE()}/${AMB}/${CICLO}/arquivo-urna/${pl}/config/${uf}/${uf}-p${pl.padStart(6,'0')}-cs.json`;
  async function loadLists(turno){
    if(A.lists[turno]||A.tlBusy) return; const pl=await getPleito(turno); if(!pl){ A.tlErr='Pleito do turno ainda não publicado pelo TSE.'; return; }
    A.tlBusy=true; A.tlErr=null; const ts=[],secs=[]; A.tlProg={done:0,total:UFS.length,fail:0}; let i=0;
    const worker=async()=>{ while(i<UFS.length){ const uf=UFS[i++];
      try{ const r=await fetch(csUrl(pl,uf),{cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json();
        (j.abr||[]).forEach(a=>(a.mu||[]).forEach(m=>(m.zon||[]).forEach(z=>(z.sec||[]).forEach(s=>{ const t=parseTs(s.da,s.ha); if(t) ts.push(t); secs.push(uf+','+m.cd+','+z.cd+','+s.ns); }))));
      }catch(e){ A.tlProg.fail++; }
      A.tlProg.done++; paint(); } };
    await Promise.all([worker(),worker(),worker()]);
    const tsA=Float64Array.from(ts); let mn=Infinity,last=0; for(const t of tsA){ if(t<mn) mn=t; if(t>last) last=t; }
    const day=Date.UTC(2026,9,turno===2?25:4,19,0,0), H=36e5; let n24=0,n72=0; for(const t of tsA){ if(t<=day+24*H) n24++; if(t<=day+72*H) n72++; }
    A.lists[turno]={ts:tsA,secs,pl,gap:maxGap(tsA),hrs:hourly(tsA),mn,last,n24,n72}; A.tlBusy=false; if(!secs.length) A.tlErr='Não foi possível ler as listas de seções do TSE.'; paint(true);
  }
  /* datas e horas gravadas no BU (UTCTime, GeneralizedTime ou texto numérico) → milissegundos, no relógio gravado */
  function parseDT(s){
    let m=/^(\d{4})-?(\d{2})-?(\d{2})[T ]?(\d{2}):?(\d{2}):?(\d{2})/.exec(s)||/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z?$/.exec(s);
    if(!m) return 0; let y=+m[1]; if(y<100) y+=2000; return Date.UTC(y,+m[2]-1,+m[3],+m[4],+m[5],+m[6]);
  }
  async function fetchBU(pl,key){
    const [uf,mun,zon,ns]=key.split(','); const B=`${BASE()}/${AMB}/${CICLO}/arquivo-urna/${pl}/dados/${uf}/${mun}/${zon}/${ns}/`;
    const a=await fetch(B+`p${pl.padStart(6,'0')}-${uf}-m${mun}-z${zon}-s${ns}-aux.json`,{cache:'no-cache'}); if(!a.ok) return null; const aj=await a.json();
    const hs=(aj.hashes||[]).filter(h=>(h.arq||[]).some(x=>x.tp==='bu')); if(!hs.length) return null;
    const h=hs[hs.length-1], f=h.arq.find(x=>x.tp==='bu').nm; const r=await fetch(B+h.hash+'/'+f,{cache:'no-cache'}); if(!r.ok) return null;
    const bu=decodeBU(await r.arrayBuffer()); if(!bu) return null;
    const vv=Object.values(bu.v).reduce((t,x)=>t+x,0);
    return {uf,mun,zon,ns,v:bu.v,vv,vb:bu.vb,vn:bu.vn,times:bu.ts||[],tot:aj.st==='Totalizada'};
  }
  function rng(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  async function collect(turno){
    if(A.run&&A.run.on) return; const L=A.lists[turno]; if(!L){ await loadLists(turno); if(!A.lists[turno]) return; }
    const L2=A.lists[turno]; const pool=A.scope==='br'?L2.secs:L2.secs.filter(k=>k.startsWith(A.scope+','));
    const have=new Set(A.bu[turno].map(r=>r.uf+','+r.mun+','+r.zon+','+r.ns)); const rand=rng(20261025);
    const idx=pool.map((_,i)=>i); for(let i=idx.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [idx[i],idx[j]]=[idx[j],idx[i]]; }
    const want=idx.slice(0,A.sample).map(i=>pool[i]).filter(k=>!have.has(k));
    const run=A.run={on:true,turno,done:0,total:want.length,fail:0,bad:0}; let i=0;
    const worker=async()=>{ while(run.on&&i<want.length){ const k=want[i++]; let r=null; try{ r=await fetchBU(L2.pl,k); }catch(e){}
      run.done++; if(r){ A.bu[turno].push(r); run.bad=0; if(!A.diag) A.diag={key:k,times:r.times}; } else { run.fail++; if(++run.bad>25) run.on=false; }
      if(run.done%100===0) paint(); } };
    paint(); await Promise.all(Array.from({length:6},worker)); run.on=false; paint(true);
  }

  /* ---------- análise ---------- */
  const top2=turno=>{ const d=S.data[turno]; if(!d||!d.br) return null; const c=d.br.cands.slice().sort((a,b)=>b.vap-a.vap).slice(0,2); return c.length===2?c:null; };
  const cache={};
  function analyse(turno){
    const recs=A.bu[turno], c=top2(turno); if(!c) return null; const key=turno+'|'+recs.length+'|'+c[0].n+c[1].n; if(cache[turno]&&cache[turno].key===key) return cache[turno].r;
    const a=c[0].n,b=c[1].n; const sh=recs.filter(s=>s.vv>=50).map(s=>shareOf(s,a));
    const series={a:recs.map(s=>s.v[a]||0),b:recs.map(s=>s.v[b]||0),vv:recs.map(s=>s.vv)};
    const r={a,b,secs:recs.length,hist:histogram(sh,0.05),extA:extremeCounts(recs,a),extB:extremeCounts(recs,b),outl:localOutliers(recs,a,b),
      ben:{a:{1:benford(series.a,1),2:benford(series.a,2)},b:{1:benford(series.b,1),2:benford(series.b,2)},vv:{1:benford(series.vv,1),2:benford(series.vv,2)}},byUf:{}};
    recs.forEach(s=>{ const u=r.byUf[s.uf]||(r.byUf[s.uf]={n:0,a95:0,b95:0}); u.n++; if(s.vv>=50){ if((s.v[a]||0)/s.vv>=0.95) u.a95++; if((s.v[b]||0)/s.vv>=0.95) u.b95++; } });
    /* horário de encerramento: o maior carimbo do BU que cai na data da eleição (só vale se o campo existir) */
    const day=Date.UTC(2026,9,25), enc=[]; recs.forEach(s=>{ let m=0; s.times.forEach(t=>{ const x=parseDT(t); if(x>=day&&x<day+864e5&&x>m) m=x; }); if(m) enc.push({s,m}); });
    r.enc=enc.length>=Math.max(50,recs.length*0.5)?enc:null;
    cache[turno]={key,r}; return r;
  }
  function overall(turno){
    const d=S.data[turno], c=top2(turno), L=A.lists[turno], r=analyse(turno); const other=turno===1?2:1, ro=A.bu[other].length>=MIN_SAMPLE?analyse(other):null;
    const margin=d&&c?Math.abs(c[0].vap-c[1].vap):0;
    const worst=(x,nm)=>{ if(!x) return null; const a=x.a[2], b=x.b[2], pick=a.mad>=b.mad?{t:a,who:nm[0]}:{t:b,who:nm[1]}; return {mad:pick.t.mad,cls:pick.t.cls,n:pick.t.n,who:pick.who}; };
    const nm=c?[nameOf(c[0]),nameOf(c[1])]:['',''];
    const sampleMargin=r?Math.abs(A.bu[turno].reduce((t,s)=>t+(s.v[r.a]||0)-(s.v[r.b]||0),0)):0;
    return {r,c,L,margin,ver:verdict({margin,extVotes:turno===2?REF_17H.votos:0,gap:L?L.gap:null,secs:r?r.secs:0,minSample:MIN_SAMPLE,outl:r&&r.secs>=MIN_SAMPLE?r.outl:null,sampleMargin,
      benf:r?{cur:worst(r.ben,nm),ref:ro?worst(ro.ben,nm):null}:null,bio:null})};
  }

  /* ---------- desenho ---------- */
  const fmtDT=t=>{ const d=new Date(t),p=n=>String(n).padStart(2,'0'); return `${p(d.getUTCDate())}/${p(d.getUTCMonth()+1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };
  const pct=(x,d=2)=>P(x*100,d);
  function barsSvg(vals,{labels,color='var(--accent)',h=150,marks=[],fmt=v=>N(v)}={}){
    const n=vals.length,W=Math.max(320,n*14),max=Math.max(1,...vals),bw=W/n;
    const bars=vals.map((v,i)=>{ const bh=v/max*(h-24); return `<rect x="${(i*bw+1).toFixed(1)}" y="${(h-18-bh).toFixed(1)}" width="${Math.max(1,bw-2).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${color}"><title>${esc((labels?labels[i]:i)+': '+fmt(v))}</title></rect>`; }).join('');
    const mk=marks.map(m=>`<line x1="${(m.i*bw).toFixed(1)}" x2="${(m.i*bw).toFixed(1)}" y1="2" y2="${h-18}" stroke="var(--crit)" stroke-dasharray="4 3"/><text x="${(m.i*bw+4).toFixed(1)}" y="12" font-size="11" fill="var(--crit)">${esc(m.t)}</text>`).join('');
    const step=Math.ceil(n/12), lab=labels?labels.map((l,i)=>i%step?'':`<text x="${(i*bw+bw/2).toFixed(1)}" y="${h-4}" font-size="10" text-anchor="middle" fill="var(--muted)">${esc(l)}</text>`).join(''):'';
    return `<div class="aud-chart"><svg viewBox="0 0 ${W} ${h}" role="img" preserveAspectRatio="xMidYMid meet">${bars}${mk}${lab}</svg></div>`;
  }
  function benfordSvg(t){
    if(!t||!t.n) return '<div class="aud-empty">Sem dados suficientes.</div>';
    const W=420,H=170,n=t.digits.length,bw=W/n,max=Math.max(...t.digits.map(d=>Math.max(d.prop,d.exp)))*1.15;
    const bars=t.digits.map((d,i)=>{ const x=i*bw+bw*0.18, w=bw*0.64, y=H-22-d.prop/max*(H-34), ey=H-22-d.exp/max*(H-34);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${(H-22-y).toFixed(1)}" rx="3" fill="var(--accent)" opacity=".85"><title>${esc('Dígito '+d.d+': observado '+pct(d.prop)+' · esperado '+pct(d.exp)+' · z '+d.z.toFixed(1))}</title></rect>`
        +`<line x1="${(x-3).toFixed(1)}" x2="${(x+w+3).toFixed(1)}" y1="${ey.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="var(--ink)" stroke-width="2.5"/><text x="${(x+w/2).toFixed(1)}" y="${H-6}" font-size="11" text-anchor="middle" fill="var(--muted)">${d.d}</text>`; }).join('');
    return `<div class="aud-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Frequência observada contra a esperada por Benford">${bars}</svg></div><div class="aud-leg"><i style="background:var(--accent)"></i>Observado <i class="ln"></i>Esperado (Benford)</div>`;
  }
  const chip=st=>`<span class="aud-chip ${st}">${ST[st]}</span>`;
  const cname=(c)=>c?esc(nameOf(c)):'—';

  function head(o){
    const {r,c,L,margin}=o, d=S.data[S.turno]; if(!d||!c) return '<section class="panel glass"><div class="skel">Carregando os totais do TSE…</div></section>';
    return `<section class="panel glass aud-hero">
      <div class="phead"><h2>Auditoria · ${S.turno}º turno</h2><span class="hint">Análise estatística pública, não oficial. Resultado dos testes ≠ prova de fraude, nem de lisura.</span></div>
      <p class="aud-lead">Este painel confronta os dados públicos do TSE com testes usados em perícia eleitoral. Cada teste mostra o que mediu, o limite do método e se deu sinal de anomalia. O veredito no fim é calculado dos números coletados; onde o dado não existe, o teste aparece como <b>não avaliado</b>.</p>
      <div class="stats aud-kpis">
        <div class="stat"><div class="k">${cname(c[0])}</div><div class="v" style="color:${colorOf(c[0].n)}">${N(c[0].vap)}</div><div class="d">${P(c[0].pct,2)} dos válidos</div></div>
        <div class="stat"><div class="k">${cname(c[1])}</div><div class="v" style="color:${colorOf(c[1].n)}">${N(c[1].vap)}</div><div class="d">${P(c[1].pct,2)} dos válidos</div></div>
        <div class="stat"><div class="k">Margem</div><div class="v">${N(margin)}</div><div class="d">${P(margin/(d.br.vv||1)*100,2)} dos válidos</div></div>
        <div class="stat"><div class="k">Seções no TSE</div><div class="v">${L?N(L.secs.length):'…'}</div><div class="d">${L?'lista lida dos arquivos de configuração':'carregando a lista'}</div></div>
        <div class="stat"><div class="k">Boletins coletados</div><div class="v">${N(A.bu[S.turno].length)}</div><div class="d">${L&&A.bu[S.turno].length?pct(A.bu[S.turno].length/L.secs.length,2)+' das seções':'amostra ainda vazia'}</div></div>
      </div>
      ${collectUi()}</section>`;
  }
  function collectUi(){
    const run=A.run&&A.run.on&&A.run.turno===S.turno, tl=A.tlBusy;
    const ufs=[['br','Brasil (amostra aleatória)'],...UFS.slice().sort((a,b)=>UFNAME[a].localeCompare(UFNAME[b],'pt-BR')).map(u=>[u,UFNAME[u]])];
    return `<div class="aud-ctl">
      <label class="f">Escopo<select id="audScope">${ufs.map(u=>`<option value="${u[0]}"${A.scope===u[0]?' selected':''}>${esc(u[1])}</option>`).join('')}</select></label>
      <label class="f">Tamanho da amostra<select id="audN">${[2000,5000,10000,25000,50000].map(n=>`<option value="${n}"${A.sample===n?' selected':''}>${N(n)} seções</option>`).join('')}</select></label>
      ${run?'<button class="btn" id="audStop" type="button">Parar coleta</button>':`<button class="btn primary" id="audGo" type="button"${tl?' disabled':''}>${A.bu[S.turno].length?'Coletar mais':'Coletar boletins'}</button>`}
      ${A.bu[S.turno].length&&!run?'<button class="btn ghost" id="audClear" type="button">Limpar coleta</button>':''}
    </div>
    <div class="aud-prog">${tl&&A.tlProg?`Lendo a lista de seções: ${A.tlProg.done}/${A.tlProg.total} estados${A.tlProg.fail?` · ${A.tlProg.fail} falha(s)`:''}`:''}${run?`Coletando boletins: ${N(A.run.done)}/${N(A.run.total)}${A.run.fail?` · ${N(A.run.fail)} sem boletim`:''}`:''}${A.tlErr?esc(A.tlErr):''}</div>
    <p class="aud-note">A amostra é sorteada com semente fixa, então a mesma coleta se repete. Estados inteiros não têm correção de peso: use "Brasil" para uma visão nacional. Cada boletim são 2 requisições ao TSE.</p>`;
  }

  function prorrog(o){
    const {r,c,margin}=o, t2=S.turno===2; const v=REF_17H.votos;
    let body;
    if(!t2) body='<p class="aud-note">A prorrogação ocorreu só no 2º turno (25/10/2026). Troque o turno no topo.</p>';
    else{
      const ratio=margin?v/margin:0;
      body=`<div class="stats aud-kpis">
        <div class="stat"><div class="k">Votos após as 17h</div><div class="v">${N(v)}</div><div class="d">${esc(REF_17H.fonte)}</div></div>
        <div class="stat"><div class="k">Margem do resultado</div><div class="v">${N(margin)}</div><div class="d">${c?cname(c[0])+' à frente':''}</div></div>
        <div class="stat"><div class="k">Influência máxima</div><div class="v">${pct(ratio,2)}</div><div class="d">da margem, se todos fossem de um só candidato</div></div>
        <div class="stat"><div class="k">Para virar, seriam necessários</div><div class="v">${N(Math.ceil(margin/2))}</div><div class="d">votos trocados de lado (metade da margem)</div></div></div>
      ${barsSvg([v,margin],{labels:['Votos após as 17h','Margem'],h:120,color:'var(--warn)',fmt:N})}
      <p class="aud-note">É um teste de aritmética, não de conduta: mostra o teto do efeito possível, não se houve irregularidade.</p>`;
      if(r&&r.enc){
        const cut=Date.UTC(2026,9,25,17,0,0), within=r.enc.filter(x=>x.m<=cut).map(x=>x.s), after=r.enc.filter(x=>x.m>cut).map(x=>x.s);
        const row=(nome,l)=>{ const vv=l.reduce((t,s)=>t+s.vv,0), va=l.reduce((t,s)=>t+(s.v[r.a]||0),0), vb=l.reduce((t,s)=>t+(s.v[r.b]||0),0);
          return `<tr><td>${nome}</td><td>${N(l.length)}</td><td>${N(vv)}</td><td>${vv?pct(va/vv,2):'—'}</td><td>${vv?pct(vb/vv,2):'—'}</td></tr>`; };
        body+=`<div class="aud-tablewrap"><table class="aud-table"><thead><tr><th>Intervalo (encerramento da seção)</th><th>Seções</th><th>Votos válidos</th><th>${cname(c[0])}</th><th>${cname(c[1])}</th></tr></thead><tbody>${row('Até as 17h',within)}${row('Depois das 17h',after)}</tbody></table></div>
        <p class="aud-note">Divisão por seção, na amostra coletada. Usa o carimbo de data e hora mais tardio do BU na data da eleição, como aproximação do encerramento, no relógio gravado no arquivo (confira no diagnóstico); o BU não traz o horário de cada voto. Votos sem biometria (liberados pelo mesário) não foram identificados nos campos lidos.</p>`;
      }else body+=`<p class="aud-note"><b>Divisão por intervalo não disponível:</b> ${A.bu[S.turno].length?'os boletins coletados não trouxeram um horário de encerramento reconhecível':'colete boletins primeiro'}. A biometria por seção também não foi localizada nos campos lidos do BU. Para separar de verdade os dois intervalos, use o arquivo de log da urna (por voto) ou a base "detalhe da votação por seção" do Portal de Dados Abertos do TSE.</p>`;
    }
    return `<section class="panel glass"><div class="phead"><h2>1 · Horário estendido (17h–19h)</h2></div>${body}${diag()}</section>`;
  }
  function diag(){
    if(!A.diag) return '';
    return `<details class="aud-diag"><summary>Diagnóstico do boletim (para conferir os campos de horário)</summary><p class="aud-note">Primeira urna lida: <code>${esc(A.diag.key)}</code>. Carimbos de data e hora encontrados dentro do arquivo:</p>${A.diag.times.length?`<ul>${A.diag.times.map(t=>`<li><code>${esc(t)}</code></li>`).join('')}</ul>`:'<p class="aud-note">Nenhum carimbo reconhecido.</p>'}</details>`;
  }

  function apagao(o){
    const L=o.L; if(!L) return `<section class="panel glass"><div class="phead"><h2>2 · Lacuna após a apuração</h2></div><div class="skel">${A.tlErr?esc(A.tlErr):'Lendo as listas de seções do TSE…'}</div></section>`;
    const g=L.gap, hrs=L.hrs, mn=L.mn, last=L.last, H=36e5, n24=L.n24, n72=L.n72, tot=L.ts.length;
    const marks=[]; const i17=hrs.findIndex(x=>x.t>=Date.UTC(2026,9,25,17,0,0)), i19=hrs.findIndex(x=>x.t>=Date.UTC(2026,9,25,19,0,0));
    if(S.turno===2){ if(i17>=0) marks.push({i:i17,t:'17h'}); if(i19>=0&&i19!==i17) marks.push({i:i19,t:'19h'}); }
    return `<section class="panel glass"><div class="phead"><h2>2 · Lacuna após a apuração</h2><span class="hint">horário de totalização de cada boletim (${N(tot)} seções)</span></div>
      <div class="stats aud-kpis">
        <div class="stat"><div class="k">Primeiro boletim</div><div class="v">${fmtDT(mn===Infinity?0:mn)}</div></div>
        <div class="stat"><div class="k">Último boletim</div><div class="v">${fmtDT(last)}</div></div>
        <div class="stat"><div class="k">Maior intervalo sem boletim</div><div class="v">${(g.gap/H).toLocaleString('pt-BR',{maximumFractionDigits:1})} h</div><div class="d">${g.gap?fmtDT(g.from)+' → '+fmtDT(g.to):''}</div></div>
        <div class="stat"><div class="k">Totalizadas em até 24 h</div><div class="v">${pct(n24/tot,2)}</div><div class="d">contadas a partir das 19h da votação</div></div>
        <div class="stat"><div class="k">Totalizadas em até 72 h</div><div class="v">${pct(n72/tot,2)}</div><div class="d">${N(tot-n72)} depois disso</div></div>
      </div>
      ${barsSvg(hrs.map(x=>x.n),{labels:hrs.map(x=>fmtDT(x.t)),marks,h:170,fmt:N})}
      <p class="aud-note">O que este teste mede: se havia boletins sendo totalizados em cada hora. O que ele não mede: se o site do TSE ficou fora do ar ou sem atualizar para o público. Um "apagão de 72 h" aparece aqui só se o maior intervalo sem boletim chegar perto disso; a disponibilidade do site precisa de registro externo (por exemplo, o histórico de acessos ou de capturas arquivadas). Nos veículos consultados, a única pausa registrada na divulgação foi de cerca de 2 h, das 17h06 às 19h de 25/10.</p></section>`;
  }

  function unanim(o){
    const r=o.r, c=o.c; if(!r||r.secs<1) return `<section class="panel glass"><div class="phead"><h2>3 · Unanimidade e seções atípicas</h2></div><div class="skel">Colete boletins para ver esta análise.</div></section>`;
    const tbl=(e,cand)=>`<tr><td>${cname(cand)}</td>${e.rows.map(x=>`<td>${N(x.n)}<small> ${e.base?pct(x.n/e.base,2):''}</small></td>`).join('')}</tr>`;
    const hist=barsSvg(r.hist,{labels:r.hist.map((_,i)=>Math.round(i*5)+'%'),h:150,color:colorOf(c[0].n),fmt:N});
    const o2=r.outl, top=o2.out.slice().sort((a,b)=>Math.abs(b.z)-Math.abs(a.z)).slice(0,12);
    const byuf=Object.entries(r.byUf).filter(([,u])=>u.a95+u.b95>0).sort((a,b)=>(b[1].a95+b[1].b95)-(a[1].a95+a[1].b95)).slice(0,8);
    const calc=A.calc, pc=calc.p/100, k95=Math.ceil(calc.n*0.95), k90=Math.ceil(calc.n*0.90);
    return `<section class="panel glass"><div class="phead"><h2>3 · Unanimidade e seções atípicas</h2><span class="hint">${N(r.secs)} boletins na amostra</span></div>
      <p class="aud-lead">Uma urna com quase todos os votos para um lado não é fraude por si: bairros, quartéis, presídios e zonas rurais são homogêneos. O que se testa é se ela destoa do <b>próprio município</b> e se os desvios pendem para um só candidato.</p>
      <h3 class="aud-h3">Distribuição da participação de ${cname(c[0])} por seção</h3>${hist}
      <div class="aud-tablewrap"><table class="aud-table"><thead><tr><th>Seções com participação de, no mínimo</th>${r.extA.rows.map(x=>`<th>${Math.round(x.t*100)}%</th>`).join('')}</tr></thead><tbody>${tbl(r.extA,c[0])}${tbl(r.extB,c[1])}</tbody></table></div>
      <p class="aud-note">Conta só seções com 50 votos válidos ou mais (${N(r.extA.base)} na amostra). Os dois lados são mostrados para se ver se o fenômeno é simétrico.</p>
      <h3 class="aud-h3">Desvios locais (z robusto ≥ 5 dentro do município)</h3>
      <div class="stats aud-kpis"><div class="stat"><div class="k">Seções atípicas</div><div class="v">${N(o2.out.length)}</div><div class="d">de ${N(o2.usable)} em ${N(o2.groupsUsed)} municípios com 15+ seções</div></div>
        <div class="stat"><div class="k">A favor de ${cname(c[0])}</div><div class="v">${N(o2.nA)}</div><div class="d">excesso estimado: ${N(Math.round(o2.excessA))} votos</div></div>
        <div class="stat"><div class="k">A favor de ${cname(c[1])}</div><div class="v">${N(o2.nB)}</div><div class="d">excesso estimado: ${N(Math.round(o2.excessB))} votos</div></div>
        <div class="stat"><div class="k">Assimetria (teste do sinal)</div><div class="v">${o2.out.length?(o2.pSign<0.001?'p<0,001':'p='+o2.pSign.toFixed(3).replace('.',',')):'—'}</div><div class="d">p baixo = desvios pendem para um lado</div></div></div>
      ${top.length?`<div class="aud-tablewrap"><table class="aud-table"><thead><tr><th>UF</th><th>Município</th><th>Zona</th><th>Seção</th><th>Válidos</th><th>Favorece</th><th>Participação</th><th>Mediana do município</th><th>z</th></tr></thead><tbody>${top.map(x=>`<tr><td>${esc(x.s.uf.toUpperCase())}</td><td>${esc(x.s.mun)}</td><td>${esc(x.s.zon)}</td><td>${esc(x.s.ns)}</td><td>${N(x.s.vv)}</td><td>${esc(nameOf(x.fav===r.a?c[0]:c[1]).split(' ')[0])}</td><td>${pct(x.share,1)}</td><td>${pct(x.med,1)}</td><td>${x.z.toFixed(1).replace('.',',')}</td></tr>`).join('')}</tbody></table></div><p class="aud-note">Códigos de município, zona e seção são os do TSE: dá para abrir o boletim dessas urnas no Portal de Resultados e comparar com a via impressa.</p>`:'<p class="aud-note">Nenhuma seção ultrapassou o limite na amostra.</p>'}
      ${byuf.length?`<h3 class="aud-h3">Estados com mais seções ≥ 95% (na amostra)</h3><div class="aud-tablewrap"><table class="aud-table"><thead><tr><th>UF</th><th>Seções</th><th>≥ 95% ${cname(c[0])}</th><th>≥ 95% ${cname(c[1])}</th></tr></thead><tbody>${byuf.map(([u,x])=>`<tr><td>${esc(u.toUpperCase())}</td><td>${N(x.n)}</td><td>${N(x.a95)}</td><td>${N(x.b95)}</td></tr>`).join('')}</tbody></table></div>`:''}
      <h3 class="aud-h3">Calculadora de possibilidades</h3>
      <div class="aud-ctl"><label class="f">Votos válidos na urna<input id="audCn" type="number" min="10" max="600" value="${calc.n}"></label><label class="f">Participação esperada (%)<input id="audCp" type="number" min="1" max="99" value="${calc.p}"></label></div>
      <div class="aud-calc" id="audCalc">${calcHtml(calc.n,pc,k90,k95)}</div></section>`;
  }
  function calcHtml(n,p,k90,k95){
    const f=x=>x<1e-300?'≈ 0':x<1e-4?x.toExponential(1).replace('.',',').replace('e','×10^'):(x*100).toFixed(x<0.01?3:1).replace('.',',')+'%';
    return `<p class="aud-note">Se cada eleitor votasse de forma independente com probabilidade ${(p*100).toFixed(0)}% de escolher o candidato, a chance numa urna de ${n} votos de ter: ≥ 90% = <b>${f(binomTailGE(n,p,k90))}</b> · ≥ 95% = <b>${f(binomTailGE(n,p,k95))}</b> · 100% = <b>${f(Math.pow(p,n))}</b>. Como o voto não é independente (vizinhança, local de votação), a chance real é maior; por isso o teste principal compara com o município, não com o acaso puro.</p>`;
  }

  function benfordPanel(o){
    const r=o.r, c=o.c; if(!r||r.secs<1) return `<section class="panel glass"><div class="phead"><h2>4 · Lei de Benford</h2></div>${benfordExplain()}<div class="skel">Colete boletins para aplicar o teste.</div></section>`;
    const ser=A.benSeries, pos=A.benPos, t=r.ben[ser][pos]; const other=S.turno===1?2:1, ro=A.bu[other].length>=MIN_SAMPLE?analyse(other):null;
    const nm={a:cname(c[0]),b:cname(c[1]),vv:'Votos válidos da urna'};
    const row=(k,lab)=>{ const x1=r.ben[k][1], x2=r.ben[k][2], y=ro&&ro.ben[k]; return `<tr><td>${lab}</td><td>${N(x1.n)}</td><td>${x1.mad.toFixed(4).replace('.',',')}<small> ${esc(BENFORD_CLS[x1.cls])}</small></td><td>${x2.mad.toFixed(4).replace('.',',')}<small> ${esc(BENFORD_CLS[x2.cls])}</small></td><td>${y?y[2].mad.toFixed(4).replace('.',',')+'<small> '+esc(BENFORD_CLS[y[2].cls])+'</small>':'<small>outro turno não coletado</small>'}</td></tr>`; };
    return `<section class="panel glass"><div class="phead"><h2>4 · Lei de Benford</h2><span class="hint">${N(t.n)} contagens</span></div>${benfordExplain()}
      <div class="aud-ctl"><div class="seg sm" role="group" aria-label="Série">${['a','b','vv'].map(k=>`<button type="button" data-bs="${k}" aria-pressed="${ser===k}">${k==='vv'?'Válidos':nm[k]}</button>`).join('')}</div>
        <div class="seg sm" role="group" aria-label="Dígito"><button type="button" data-bp="1" aria-pressed="${pos===1}">1º dígito</button><button type="button" data-bp="2" aria-pressed="${pos===2}">2º dígito</button></div></div>
      ${benfordSvg(t)}
      <div class="stats aud-kpis"><div class="stat"><div class="k">MAD (desvio médio)</div><div class="v">${t.mad.toFixed(4).replace('.',',')}</div><div class="d">${esc(BENFORD_CLS[t.cls])}</div></div>
        <div class="stat"><div class="k">Qui-quadrado (gl ${t.df})</div><div class="v">${t.chi2.toFixed(1).replace('.',',')}</div><div class="d">p ${t.p<1e-4?'< 0,0001':'= '+t.p.toFixed(4).replace('.',',')}</div></div></div>
      <div class="aud-tablewrap"><table class="aud-table"><thead><tr><th>Série (${S.turno}º turno)</th><th>n</th><th>MAD 1º dígito</th><th>MAD 2º dígito</th><th>MAD 2º dígito, outro turno</th></tr></thead><tbody>${row('a',nm.a)}${row('b',nm.b)}${row('vv','Válidos')}</tbody></table></div>
      <p class="aud-note">Limites de conformidade de Nigrini (2º dígito): MAD até 0,008 próxima · 0,010 aceitável · 0,012 marginal · acima disso, não conforme. Com muitos boletins o qui-quadrado rejeita até desvios minúsculos; por isso o MAD é a medida principal.</p></section>`;
  }
  const benfordExplain=()=>`<div class="aud-explain"><p><b>O que é.</b> Em muitos conjuntos de números que crescem por multiplicação, o dígito 1 aparece como primeiro em cerca de 30% dos casos, o 2 em 17,6%, e assim até o 9 (4,6%). Se alguém inventa números, tende a espalhar os dígitos de forma mais uniforme, e a curva se desfaz.</p>
    <p><b>Como se aplica.</b> Pega-se a contagem de votos de cada urna, isola-se o primeiro (ou o segundo) dígito, compara-se a frequência observada com a esperada e mede-se a distância (MAD e qui-quadrado).</p>
    <p><b>Limite importante.</b> Urnas têm de 100 a 500 eleitores, ou seja, os números são limitados por um teto, e nesse caso o 1º dígito não precisa seguir Benford mesmo sem fraude (estudos como Deckert, Myagkov e Ordeshook, 2011, mostram isso). O 2º dígito é bem menos afetado, por isso é o principal aqui. E o teste nunca prova fraude: só indica onde olhar. A comparação entre os dois turnos ajuda: se ambos desviam igual, o desvio é da estrutura dos dados, não de um turno.</p></div>`;

  function veredito(o){
    const v=o.ver; const cnt=v.counts;
    return `<section class="panel glass aud-verdict"><div class="phead"><h2>5 · Veredito em dados</h2><span class="hint">${S.turno}º turno</span></div>
      <p class="aud-head">${esc(v.head)}</p>
      <div class="aud-count">${chip('ok')} ${cnt.ok} ${chip('warn')} ${cnt.warn} ${chip('bad')} ${cnt.bad} ${chip('na')} ${cnt.na}</div>
      <ul class="aud-items">${v.items.map(i=>`<li>${chip(i.st)}<div><b>${esc(i.nome)}</b><span>${esc(i.txt)}</span></div></li>`).join('')}</ul>
      <h3 class="aud-h3">Considerações</h3>
      <ul class="aud-cons">
        <li>O teste de maior peso é a aritmética da prorrogação: ela independe de amostra e de suposições sobre comportamento do eleitor.</li>
        <li>Os testes estatísticos só enxergam o que está na amostra coletada. Uma amostra de ${N(A.bu[S.turno].length)} boletins${o.L?` (${pct(A.bu[S.turno].length/o.L.secs.length,1)} das seções)`:''} detecta padrões amplos, não uma fraude pontual em poucas urnas.</li>
        <li>Anomalia estatística é motivo para conferir o boletim impresso, o log e a via do fiscal de partido; ela não decide nada sozinha. Contestações seguem pela Justiça Eleitoral.</li>
        <li>Para fechar os dois itens não avaliados (biometria e horário por voto), é preciso o log da urna e a base de "detalhe da votação por seção" do TSE.</li></ul></section>`;
  }

  /* ---------- montagem ---------- */
  let paintT=0;
  function paint(force){ const now=Date.now(); if(!force&&now-paintT<400) return; paintT=now; if(S.page==='auditoria') render(true); }
  let sigLast='';
  const sig=()=>{ const d=S.data[S.turno]; return [S.turno,A.bu[S.turno].length,A.run&&A.run.on,A.run&&A.run.done,!!A.lists[S.turno],A.tlBusy,A.tlProg&&A.tlProg.done,A.tlErr,A.benSeries,A.benPos,d&&d.br&&d.br.vv,!!document.getElementById('audCalc')].join('|'); };
  function render(force){
    const root=document.getElementById('audRoot'); if(!root) return; const sg=sig(); if(!force&&sg===sigLast&&root.firstChild) return; sigLast=sg; const y=window.scrollY;
    const o=overall(S.turno); if(!A.lists[S.turno]&&!A.tlBusy&&!A.tlErr&&S.data[S.turno]) setTimeout(()=>loadLists(S.turno),0);
    const ae=document.activeElement, keep=ae&&root.contains(ae)&&ae.id&&ae.tagName==='INPUT'?{id:ae.id,s:ae.selectionStart}:null;
    root.innerHTML=head(o)+prorrog(o)+apagao(o)+unanim(o)+benfordPanel(o)+veredito(o);
    if(keep){ const n=document.getElementById(keep.id); if(n){ n.focus(); try{ n.setSelectionRange(keep.s,keep.s); }catch(e){} } }
    window.scrollTo(0,y);
  }
  function onClick(e){
    const b=e.target.closest('button'); if(!b) return;
    if(b.id==='audGo') collect(S.turno); else if(b.id==='audStop'){ if(A.run) A.run.on=false; paint(true); }
    else if(b.id==='audClear'){ A.bu[S.turno]=[]; A.diag=null; paint(true); }
    else if(b.dataset.bs){ A.benSeries=b.dataset.bs; paint(true); } else if(b.dataset.bp){ A.benPos=+b.dataset.bp; paint(true); }
  }
  function onChange(e){
    const t=e.target; if(t.id==='audScope'){ A.scope=t.value; } else if(t.id==='audN'){ A.sample=+t.value; }
  }
  function onInput(e){
    const t=e.target; if(t.id!=='audCn'&&t.id!=='audCp') return; const n=Math.max(10,Math.min(600,Math.round(+document.getElementById('audCn').value)||300)), p=Math.max(1,Math.min(99,+document.getElementById('audCp').value||50));
    A.calc={n,p}; const el=document.getElementById('audCalc'); if(el) el.innerHTML=calcHtml(n,p/100,Math.ceil(n*0.9),Math.ceil(n*0.95));
  }
  function mount(){ const root=document.getElementById('audRoot'); if(!root||root.dataset.bound) return; root.dataset.bound='1'; root.addEventListener('click',onClick); root.addEventListener('change',onChange); root.addEventListener('input',onInput); }
  const status=()=>({txt:A.run&&A.run.on?`Coletando boletins ${N(A.run.done)}/${N(A.run.total)}`:A.bu[S.turno].length?`${N(A.bu[S.turno].length)} boletins coletados`:'Auditoria · coleta pendente',on:A.run&&A.run.on?null:true});
  return {render:()=>{ mount(); render(); },status,_state:A,_analyse:analyse};
}
