/* Página "Deputado": Estadual e Federal usam o mesmo racional (eleição proporcional),
   então compartilham leitura, cálculo e telas; só muda o arquivo do TSE e o número de vagas. */
import { ESPECTRO, FAIXA_BY_ID, faixaOf, normSigla, vagas as vagasOf } from './data/partidos.js';

export function createDeputado(ctx){
  const {N,P,esc,num,UFNAME,REGION,MAP,S}=ctx;
  const UF27=Object.keys(UFNAME).filter(u=>u!=='zz');
  const KIND={fed:{nome:'Deputado federal',plural:'Deputados federais',cc:'0006',casa:'Câmara dos Deputados'},
              est:{nome:'Deputado estadual',plural:'Deputados estaduais',cc:'0007',casa:'Assembleias Legislativas'}};
  const D={kind:'fed',view:'painel',data:{fed:null,est:null},lim:{band:14,fora:15,eleitos:60},sort:{k:'seats',d:-1},busy:false,diag:null,err:null};
  const cc=(kind,uf)=>kind==='est'&&uf==='df'?'0008':KIND[kind].cc;   // no DF o cargo estadual é Deputado Distrital

  /* ---------- leitura ---------- */
  async function fetchUf(kind,uf,cd){
    const u=`${ctx.BASE()}/${ctx.AMB}/${ctx.CICLO}/${cd}/dados/${uf}/${uf}-c${cc(kind,uf)}-e${cd.padStart(6,'0')}-u.json`;
    const r=await fetch(u,{cache:'no-cache'});
    if(r.status===404) return {missing:true};
    if(!r.ok) throw new Error('HTTP '+r.status);
    return {json:await r.json(),url:u};
  }
  const pick=(o,keys)=>{for(const k of keys){ if(o&&o[k]!=null&&o[k]!=='') return o[k]; } return null;};
  const SJ=/sub\s*judice|anulad/i;
  function parseUf(kind,uf,j){
    const car=(j.carg&&j.carg[0])||{};
    const agrs=[],cands=[];
    (car.agr||[]).forEach(a=>{
      const sgs=(a.par||[]).map(p=>p.sg||p.nm||'').filter(Boolean);
      const key=sgs.map(normSigla).sort().join('+')||String(a.n||a.nm||'?');
      const g={key,label:sgs.join(' + ')||String(a.nm||a.n||'?'),sgs,isFed:sgs.length>1,nome:a.nm||'',nom:0,leg:0,tot:0,elig:0,seats:0,qp:0,med:0,parties:{}};
      (a.par||[]).forEach(p=>{
        const sg=p.sg||p.nm||'';
        const pp=g.parties[sg]||(g.parties[sg]={nom:0,seats:0});
        (p.cand||[]).forEach(c=>{
          const st=String(pick(c,['st','dsit','sit'])||'');
          const sj=SJ.test(st)||SJ.test(String(c.dvt||''));
          const el=/^eleito/i.test(st)||c.e==='s';
          const via=!el?'':/(^|\W)qp(\W|$)|quociente/i.test(st)?'QP':/m[eé]dia|sobra/i.test(st)?'M':'?';
          const o={n:String(c.n||''),nm:c.nmu||c.nm||'',vap:num(c.vap),el:el&&!sj,via,sj,sg,uf,key,st};
          cands.push(o);
          if(sj){ return; }
          g.nom+=o.vap; pp.nom+=o.vap;
        });
      });
      const leg=pick(a,['vl','vlg','vleg','vpl','vle','vlegenda']);
      const total=pick(a,['vap','vv','vt','vtot']);
      g.leg=leg!=null?num(leg):(total!=null&&num(total)>g.nom?num(total)-g.nom:0);
      g.tot=g.nom+g.leg;
      agrs.push(g);
    });
    const hv=j.v||{}, hs=j.s||{};
    const sum=agrs.reduce((s,a)=>s+a.tot,0);
    const vv=Math.max(num(hv.vv)||0,sum);
    const vg=vagasOf(kind,uf);
    const q=vg?vv/vg:0, f=Math.floor(q), qe=Math.max(1,(q-f>0.5)?f+1:f);   // art. 106 do Código Eleitoral: fração até meio despreza
    const sjc=cands.filter(c=>c.sj);
    const u={uf,kind,vagas:vg,vv,qe,agrs,cands,ts:num(hs.ts),st:num(hs.st),dg:j.dg||'',hg:j.hg||'',and:j.and||'',sjVotes:sjc.reduce((s,c)=>s+c.vap,0),sjN:sjc.length,proj:false,events:[],mismatch:0};
    agrs.forEach(a=>{ a.pct=vv?a.tot/vv*100:0; a.qpFrac=a.tot/qe; a.elig=cands.filter(c=>c.key===a.key&&!c.sj&&c.vap>=qe*0.1).length; });
    const own=distribute(u);
    const tseEl=cands.filter(c=>c.el);
    if(vg&&tseEl.length===vg){
      agrs.forEach(a=>{ a.seats=0;a.qp=0;a.med=0; });
      const byKey={}; agrs.forEach(a=>byKey[a.key]=a);
      Object.keys(byKey).forEach(k=>{
        const els=tseEl.filter(c=>c.key===k).sort((x,y)=>y.vap-x.vap), a=byKey[k];
        let qpLeft=own.qp[k]||0;
        els.forEach(c=>{ if(c.via==='?') c.via=(qpLeft-->0)?'QP':'M'; a.seats++; if(c.via==='QP') a.qp++; else a.med++; const pp=a.parties[c.sg]; if(pp) pp.seats++; });
      });
      u.mismatch=agrs.reduce((s,a)=>s+Math.abs(a.seats-(own.seats[a.key]||0)),0)/2;
    }else{
      u.proj=true;
      agrs.forEach(a=>{ a.seats=own.seats[a.key]||0; a.qp=own.qp[a.key]||0; a.med=a.seats-a.qp; });
      cands.forEach(c=>{ c.el=false; c.via=''; });
      agrs.forEach(a=>{
        cands.filter(c=>c.key===a.key&&!c.sj).sort((x,y)=>y.vap-x.vap).slice(0,a.seats).forEach((c,i)=>{ c.el=true; c.via=i<a.qp?'QP':'M'; const pp=a.parties[c.sg]; if(pp) pp.seats++; });
      });
    }
    u.events=own.events;
    agrs.forEach(a=>a.faixa=faixaAgr(a));
    return u;
  }
  /* cálculo próprio: quociente partidário e sobras pela maior média (usado na tela "passo a passo" e como projeção) */
  function distribute(u){
    const seats={},qp={}; let used=0;
    u.agrs.forEach(a=>{ const q=Math.min(Math.floor(a.tot/u.qe),a.elig); seats[a.key]=q; qp[a.key]=q; used+=q; });
    const events=[]; let rest=u.vagas-used;
    const nc={}; u.cands.forEach(c=>{ if(!c.sj) nc[c.key]=(nc[c.key]||0)+1; });
    while(rest>0){
      let best=null,bv=-1;
      u.agrs.forEach(a=>{ if(seats[a.key]>=(nc[a.key]||0)) return; const m=a.tot/(seats[a.key]+1); if(m>bv){bv=m;best=a;} });
      if(!best) break;
      seats[best.key]++; events.push({key:best.key,label:best.label,avg:bv,seat:seats[best.key]}); rest--;
    }
    return {seats,qp,events};
  }
  function faixaAgr(a){
    const sc={};
    Object.keys(a.parties).forEach(sg=>{ const f=faixaOf(sg); sc[f]=(sc[f]||0)+a.parties[sg].seats*1e9+a.parties[sg].nom; });
    let b='N',bv=-1; Object.keys(sc).forEach(f=>{ if(sc[f]>bv){bv=sc[f];b=f;} });
    return b;
  }

  async function refresh(){
    if(D.busy) return D.last; D.busy=true;
    const kind=D.kind; let out={ok:false};
    try{
      const cd=await ctx.estCd(1);
      if(!cd) throw new Error('Não encontrei, na configuração do TSE, o código da eleição estadual deste ciclo.');
      const store=D.data[kind]||{uf:{},at:0,missing:false};
      const q=UF27.slice(); let i=0,miss=0,got=0,firstErr=null;
      const worker=async()=>{ while(i<q.length){ const uf=q[i++]; try{
        const r=await fetchUf(kind,uf,cd);
        if(r.missing){ miss++; continue; }
        if(!D.diag||D.diag.kind!==kind) D.diag=diagOf(kind,uf,r);
        store.uf[uf]=parseUf(kind,uf,r.json); got++;
      }catch(e){ firstErr=firstErr||e; } } };
      await Promise.all(Array.from({length:6},worker));
      store.at=Date.now(); store.missing=got===0&&miss>0;
      D.data[kind]=store;
      if(got===0&&firstErr) throw firstErr;
      out={ok:true,missing:store.missing,code:cd};
      D.err=null;
    }catch(e){ D.err=e; out={ok:false,err:e}; }
    D.busy=false; D.last=out; return out;
  }
  function diagOf(kind,uf,r){
    const j=r.json,car=(j.carg&&j.carg[0])||{},a=(car.agr||[])[0]||{},p=(a.par||[])[0]||{},c=(p.cand||[])[0]||{};
    return {kind,uf,url:r.url,top:Object.keys(j).join(', '),v:JSON.stringify(j.v||{}),agr:Object.keys(a).join(', '),par:Object.keys(p).join(', '),cand:Object.keys(c).join(', '),st:c.st||c.dsit||''};
  }

  /* ---------- recorte atual ---------- */
  const scopeUf=()=>(S.scope!=='br'&&S.scope!=='zz'&&UFNAME[S.scope])?S.scope:null;
  function scopeUfs(){ const u=scopeUf(); if(u) return [u]; if(S.region!=='all'&&S.region!=='Exterior') return REGION[S.region].filter(x=>x!=='zz'); return UF27; }
  function scopeLabel(){ const u=scopeUf(); if(u) return UFNAME[u]; if(S.region!=='all'&&S.region!=='Exterior') return 'Região '+S.region; return 'Brasil'; }
  function view(){
    const st=D.data[D.kind]; if(!st) return null;
    const ufs=scopeUfs().map(u=>st.uf[u]).filter(Boolean); if(!ufs.length) return null;
    const total=scopeUfs().reduce((s,u)=>s+vagasOf(D.kind,u),0);
    const m={}; let vv=0,vg=0,ts=0,stt=0,sjV=0,sjN=0,proj=0,mism=0,dg='',hg='';
    ufs.forEach(u=>{
      vv+=u.vv; vg+=u.vagas; ts+=u.ts; stt+=u.st; sjV+=u.sjVotes; sjN+=u.sjN; if(u.proj) proj++; mism+=u.mismatch;
      if(tsKey(u.dg,u.hg)>tsKey(dg,hg)){dg=u.dg;hg=u.hg;}
      u.agrs.forEach(a=>{
        const x=m[a.key]||(m[a.key]={key:a.key,label:a.label,sgs:a.sgs,isFed:a.isFed,nome:a.nome,nom:0,leg:0,tot:0,seats:0,qp:0,med:0,parties:{}});
        x.nom+=a.nom;x.leg+=a.leg;x.tot+=a.tot;x.seats+=a.seats;x.qp+=a.qp;x.med+=a.med;
        Object.keys(a.parties).forEach(sg=>{ const p=x.parties[sg]||(x.parties[sg]={nom:0,seats:0}); p.nom+=a.parties[sg].nom; p.seats+=a.parties[sg].seats; });
      });
    });
    const agrs=Object.values(m); const one=ufs.length===1?ufs[0]:null;
    agrs.forEach(a=>{ a.pct=vv?a.tot/vv*100:0; a.pctSeats=total?a.seats/total*100:0; a.faixa=faixaAgr(a); a.qpFrac=one?a.tot/one.qe:null; });
    const cands=[]; ufs.forEach(u=>u.cands.forEach(c=>{ if(!c.sj) cands.push(c); }));
    return {ufs,one,agrs,cands,vv,vagas:total,fetched:vg,ts,st:stt,sjV,sjN,proj,mism,dg,hg,missingUfs:scopeUfs().length-ufs.length};
  }
  const tsKey=(d,h)=>{const m=/(\d+)\/(\d+)\/(\d+)/.exec(d||''),t=/(\d+):(\d+):(\d+)/.exec(h||''); return m&&t?Date.UTC(+m[3],m[2]-1,+m[1],+t[1],+t[2],+t[3]):0};
  function status(){
    const st=D.data[D.kind];
    if(D.err) return {txt:'Sem conexão com o TSE',on:false};
    if(!st) return {txt:'Carregando deputados…',on:null};
    if(st.missing) return {txt:'Aguardando publicação do TSE',on:null};
    const v=view(); return {txt:v&&v.dg?`TSE: ${v.dg} ${v.hg}`:'Deputados carregados',on:true};
  }

  /* ---------- gráficos ---------- */
  const FX=ESPECTRO;
  const fcor=id=>(FAIXA_BY_ID[id]||FAIXA_BY_ID.N).cor;
  const fnome=id=>(FAIXA_BY_ID[id]||FAIXA_BY_ID.N).nome;
  function seatsByFaixa(v){
    const m={}; FX.forEach(f=>m[f.id]={id:f.id,seats:0,nom:0});
    v.cands.forEach(c=>{ const f=faixaOf(c.sg); m[f].nom+=c.vap; if(c.el) m[f].seats++; });
    return FX.map(f=>m[f.id]);
  }
  /* hemiciclo: cada ponto é uma cadeira; as cores seguem a ordem do espectro, da esquerda para a direita */
  function hemicycle(items,total){
    if(!total) return '';
    const W=700,H=372,cx=350,cy=356,Ro=330,Ri=Math.max(70,Ro*0.38);
    const rows=Math.max(2,Math.min(14,Math.round(Math.sqrt(total)/2.1)));
    const dr=(Ro-Ri)/(rows-1), radii=[...Array(rows)].map((_,i)=>Ri+i*dr), sumR=radii.reduce((a,b)=>a+b,0);
    const cnt=radii.map(r=>Math.round(total*r/sumR)); cnt[rows-1]+=total-cnt.reduce((a,b)=>a+b,0);
    const pts=[]; radii.forEach((r,i)=>{ const n=cnt[i]; for(let j=0;j<n;j++){ const a=n===1?Math.PI/2:Math.PI*(1-j/(n-1)); pts.push({a,r,x:cx+r*Math.cos(a),y:cy-r*Math.sin(a)}); } });
    pts.sort((p,q)=>q.a-p.a||p.r-q.r);
    const sp=Math.min(dr,...radii.map((r,i)=>cnt[i]>1?Math.PI*r/(cnt[i]-1):1e9)), rad=Math.max(1.5,Math.min(13,sp*0.42));
    let k=0,out='';
    items.forEach(it=>{ for(let n=0;n<it.seats&&k<pts.length;n++,k++){ const p=pts[k]; out+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${it.cor}"/>`; } });
    for(;k<pts.length;k++){ const p=pts[k]; out+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rad.toFixed(1)}" fill="var(--grid)"/>`; }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hemiciclo com as ${N(total)} cadeiras coloridas por espectro político">${out}</svg>`;
  }

  /* ---------- páginas ---------- */
  const seg=(attr,val,list)=>`<div class="seg sm" role="group">${list.map(([k,l])=>`<button type="button" ${attr}="${k}" aria-pressed="${val===k}">${l}</button>`).join('')}</div>`;
  const sw=c=>`<span class="sw" style="background:${c}"></span>`;
  const faixaTag=id=>`<span class="lead">${sw(fcor(id))}${esc(fnome(id))}</span>`;

  function headPanel(v){
    const k=KIND[D.kind], done=v.cands.filter(c=>c.el).length, secP=v.ts?v.st/v.ts*100:0;
    const one=v.one;
    const notes=[];
    if(v.proj) notes.push(`<b>Projeção do painel.</b> Em ${N(v.proj)} ${v.proj===1?'estado':'estados'} o TSE ainda não fechou todas as vagas; as cadeiras vêm do cálculo do próprio painel (quociente e maior média) e podem mudar.`);
    if(v.sjN) notes.push(`<b>Votos sub judice.</b> ${N(v.sjN)} ${v.sjN===1?'candidato tem':'candidatos têm'} registro em discussão na Justiça Eleitoral (${N(v.sjV)} votos). Esses votos ficam fora do cálculo enquanto o TSE não decide; se forem validados, o quociente sobe e as cadeiras podem mudar.`);
    if(v.missingUfs) notes.push(`${N(v.missingUfs)} ${v.missingUfs===1?'estado ainda sem arquivo':'estados ainda sem arquivo'} publicado pelo TSE.`);
    if(v.mism) notes.push(`O cálculo do painel difere do TSE em ${N(v.mism)} ${v.mism===1?'cadeira':'cadeiras'} (efeito de votos sub judice ou de arredondamento). Vale o resultado do TSE.`);
    return `<section class="panel glass tri head">
      <div class="dep-ctl">
        <div class="seg" role="group" aria-label="Cargo">${['fed','est'].map(x=>`<button type="button" data-dkind="${x}" aria-pressed="${D.kind===x}">${x==='fed'?'Federal':'Estadual'}<small>${x==='fed'?'Câmara dos Deputados':'Assembleias (DF: distrital)'}</small></button>`).join('')}</div>
        ${seg('data-dview',D.view,[['painel','Painel analítico'],['tabela','Tabela completa'],['eleitos','Eleitos']])}
      </div>
      <div class="status"><span class="chip ${v.and==='f'?'final':'parcial'}">${v.and==='f'?'Totalização final':'Totalização parcial'}</span><span>${esc(scopeLabel())} · ${esc(k.nome)} · 1º turno</span></div>
      <div class="headline">${N(done)} de ${N(v.vagas)} cadeiras ${done===v.vagas?'definidas':'projetadas'}</div>
      <div class="sub">${esc(k.plural)}: ${esc(scopeLabel())}. Eleição proporcional: as cadeiras vão primeiro aos partidos e federações, pela soma de todos os seus votos, e depois aos mais votados de cada um.</div>
      <div class="stats">
        <div class="stat"><div class="k">Seções totalizadas</div><div class="v">${v.ts?P(secP,2):'—'}</div><div class="meter" aria-hidden="true"><i style="width:${secP}%;background:var(--accent)"></i></div><div class="d">${v.ts?N(v.st)+' de '+N(v.ts)+' seções':''}</div></div>
        <div class="stat"><div class="k">Votos válidos</div><div class="v">${N(v.vv)}</div><div class="d">nominais + legenda, sem brancos e nulos</div></div>
        <div class="stat"><div class="k">${one?'Quociente eleitoral':'Votos por cadeira'}</div><div class="v">${N(one?one.qe:Math.round(v.vv/Math.max(1,v.vagas)))}</div><div class="d">${one?'votos válidos ÷ '+N(one.vagas)+' cadeiras':'média do recorte (cada estado tem o seu quociente)'}</div></div>
      </div>
      ${notes.map(n=>`<div class="notice show" style="margin-top:8px">${n}</div>`).join('')}
    </section>`;
  }

  function espectroPanel(v){
    const sb=seatsByFaixa(v), totS=sb.reduce((s,x)=>s+x.seats,0), totN=sb.reduce((s,x)=>s+x.nom,0);
    const items=sb.map(x=>({...x,cor:fcor(x.id)}));
    const tiles=sb.filter(x=>x.id!=='N'||x.seats).map(x=>{
      const ps=totS?x.seats/totS*100:0, pn=totN?x.nom/totN*100:0;
      return `<div class="stat dep-tile" data-tip="${esc(fnome(x.id)+'\n'+N(x.seats)+' cadeiras ('+P(ps,1)+')\n'+P(pn,1)+' dos votos nominais')}"><div class="k">${sw(fcor(x.id))}${esc(fnome(x.id))}</div><div class="v">${N(x.seats)}</div><div class="d">${P(ps,1)} das cadeiras · ${P(pn,1)} dos votos nominais</div></div>`;
    }).join('');
    const bar=sb.filter(x=>x.seats).map(x=>`<i style="width:${totS?x.seats/totS*100:0}%;background:${fcor(x.id)}" data-tip="${esc(fnome(x.id)+': '+N(x.seats)+' ('+P(x.seats/totS*100,1)+')')}"></i>`).join('');
    return `<section class="panel glass tri">
      <div class="phead"><h2>Cadeiras por espectro político</h2><span class="hint">${esc(scopeLabel())} · ${esc(KIND[D.kind].nome.toLowerCase())}</span></div>
      <div class="dep-hemi">${hemicycle(items,v.vagas)}<div class="dep-hemi-c"><b>${N(totS)}</b><span>de ${N(v.vagas)}</span></div></div>
      <div class="split" aria-hidden="true">${bar}</div>
      <div class="stats dep-tiles">${tiles}</div>
      <div class="legend-note">Classificação editorial dos partidos (esquerda a direita), editável em <code>src/data/partidos.js</code>. Cada cadeira conta pelo partido do eleito, mesmo dentro de uma federação. Os votos nominais por faixa somam só os votos dados a candidatos.</div>
    </section>`;
  }

  function bancadasPanel(v){
    const rows=v.agrs.filter(a=>a.seats>0||a.tot>0).sort((a,b)=>b.seats-a.seats||b.tot-a.tot);
    const shown=rows.slice(0,D.lim.band), max=Math.max(1,...rows.map(a=>a.seats));
    const body=shown.map(a=>{
      const w=x=>x/max*100;
      const tip=`${a.label}${a.isFed?' (federação)':''}\n${N(a.seats)} cadeiras: ${N(a.qp)} pelo quociente, ${N(a.med)} pelas sobras\n${N(a.tot)} votos (${P(a.pct,1)})\n${fnome(a.faixa)}`;
      return `<div class="dep-row" data-tip="${esc(tip)}"><div class="nm">${sw(fcor(a.faixa))}<b>${esc(a.label)}</b>${a.isFed?'<small>federação</small>':''}</div>
        <div class="dep-bar"><i style="width:${w(a.qp)}%;background:${fcor(a.faixa)}"></i><i style="width:${w(a.med)}%;background:${fcor(a.faixa)};opacity:.55"></i></div>
        <div class="val">${N(a.seats)}<small>${P(a.pct,1)} dos votos</small></div></div>`;
    }).join('');
    const more=rows.length>shown.length?`<div style="text-align:center;margin-top:10px"><button class="btn" type="button" data-dmore="band">Mostrar mais (${N(rows.length-shown.length)} restantes)</button></div>`:'';
    return `<section class="panel glass">
      <div class="phead"><h2>Bancadas por partido e federação</h2><span class="hint">${esc(scopeLabel())}</span></div>
      <div class="cleg"><span class="key"><span class="sw" style="background:var(--ink)"></span>pelo quociente partidário</span><span class="key"><span class="sw" style="background:var(--ink);opacity:.55"></span>pelas sobras (maior média)</span></div>
      ${body||'<div class="hint">Sem dados neste recorte.</div>'}${more}
    </section>`;
  }

  function votosCadeirasPanel(v){
    const rows=v.agrs.filter(a=>a.tot>0).sort((a,b)=>b.tot-a.tot).slice(0,14);
    const body=rows.map(a=>{
      const d=a.pctSeats-a.pct, mx=Math.max(1,...rows.map(x=>Math.max(x.pct,x.pctSeats)));
      const tip=`${a.label}\n${P(a.pct,1)} dos votos válidos\n${P(a.pctSeats,1)} das cadeiras (${N(a.seats)})\nDiferença: ${d>=0?'+':''}${N(d,1)} p.p.`;
      return `<div class="dep-vc" data-tip="${esc(tip)}"><div class="nm">${sw(fcor(a.faixa))}<b>${esc(a.label)}</b></div>
        <div class="dep-vcb"><div class="b1"><i style="width:${a.pct/mx*100}%"></i><span>${P(a.pct,1)}</span></div><div class="b2"><i style="width:${a.pctSeats/mx*100}%;background:${fcor(a.faixa)}"></i><span>${P(a.pctSeats,1)}</span></div></div>
        <div class="dl ${d>=0?'up':'dn'}">${d>=0?'▲':'▼'} ${N(Math.abs(d),1)} p.p.</div></div>`;
    }).join('');
    return `<section class="panel glass">
      <div class="phead"><h2>Votos × cadeiras</h2><span class="hint">proporcionalidade · ${esc(scopeLabel())}</span></div>
      <div class="cleg"><span class="key"><span class="sw" style="background:var(--muted)"></span>% dos votos válidos</span><span class="key"><span class="sw" style="background:var(--ink)"></span>% das cadeiras</span></div>
      ${body||'<div class="hint">Sem dados neste recorte.</div>'}
      <div class="legend-note">Seta para cima: o partido ficou com mais cadeiras do que sua fatia de votos. As diferenças vêm das sobras, de partidos abaixo do quociente e dos votos "perdidos" em cada estado. Mostra os 14 maiores em votos.</div>
    </section>`;
  }

  function mapPanel(v){
    if(scopeUf()) return '';
    const st=D.data[D.kind]; let g='',seen={};
    Object.keys(MAP.p).forEach(uf=>{
      const u=st&&st.uf[uf]; if(!u) { g+=`<g class="uf dim" data-uf="${uf}" tabindex="0" role="button" aria-label="${esc(UFNAME[uf])}"><path d="${MAP.p[uf]}" fill="var(--grid)"/></g>`; return; }
      const by={}; u.cands.forEach(c=>{ if(c.el){ const f=faixaOf(c.sg); by[f]=(by[f]||0)+1; } });
      const ord=Object.entries(by).sort((a,b)=>b[1]-a[1]), top=ord[0]; if(!top) return;
      seen[top[0]]=1;
      const dim=S.region!=='all'&&ctx.UF2REG[uf]!==S.region;
      const tip=`${UFNAME[uf]} · ${N(u.vagas)} cadeiras\n`+ord.map(([f,n])=>`${fnome(f)}: ${N(n)}`).join('\n');
      g+=`<g class="uf${dim?' dim':''}" data-uf="${uf}" data-tip="${esc(tip)}" tabindex="0" role="button" aria-label="${esc(UFNAME[uf])}: ${esc(fnome(top[0]))} tem mais cadeiras"><path d="${MAP.p[uf]}" fill="${fcor(top[0])}"/></g>`;
    });
    const keys=FX.filter(f=>seen[f.id]).map(f=>`<span class="key">${sw(f.cor)}${esc(f.nome)}</span>`).join('');
    return `<section class="panel glass">
      <div class="phead"><h2>Espectro dominante por estado</h2><span class="hint">a faixa com mais cadeiras em cada bancada</span></div>
      <div class="mapbox"><svg viewBox="${MAP.vb}" role="group" aria-label="Mapa do Brasil com a faixa do espectro que mais elegeu em cada estado">${g}</svg></div>
      <div class="keys">${keys}</div>
      <div class="legend-note">Clique num estado para filtrar a página inteira. Passe o mouse (ou toque) para ver a distribuição das cadeiras.</div>
    </section>`;
  }

  function foraPanel(v){
    const list=[];
    v.ufs.forEach(u=>{
      const el=u.cands.filter(c=>c.el&&!c.sj); if(!el.length) return;
      const minEl=Math.min(...el.map(c=>c.vap));
      u.cands.forEach(c=>{ if(c.el||c.sj||c.vap<=minEl) return; list.push({c,u,passed:el.filter(e=>e.vap<c.vap).length,minEl}); });
    });
    list.sort((a,b)=>b.passed-a.passed||b.c.vap-a.c.vap);
    const shown=list.slice(0,D.lim.fora);
    const agrLabel=(u,key)=>{const a=u.agrs.find(x=>x.key===key); return a?a.label:''};
    const rows=shown.map(x=>`<tr><td class="l"><b>${esc(ctx.title(x.c.nm))}</b></td><td class="l">${sw(fcor(faixaOf(x.c.sg)))}${esc(x.c.sg)}</td><td class="l">${x.u.uf.toUpperCase()}</td><td>${N(x.c.vap)}</td><td>${N(x.passed)}</td><td>${N(x.minEl)}</td></tr>`).join('');
    const more=list.length>shown.length?`<div style="text-align:center;margin-top:10px"><button class="btn" type="button" data-dmore="fora">Mostrar mais (${N(list.length-shown.length)} restantes)</button></div>`:'';
    return `<section class="panel glass">
      <div class="phead"><h2>Mais votados que ficaram de fora</h2><span class="hint">${esc(scopeLabel())}</span></div>
      ${rows?`<div class="tw"><table style="min-width:560px"><thead><tr><th class="l">Candidato</th><th class="l">Partido</th><th class="l">UF</th><th>Votos</th><th>Eleitos com menos votos</th><th>Menor eleito (votos)</th></tr></thead><tbody>${rows}</tbody></table></div>${more}`:'<div class="hint">Nenhum candidato ficou de fora com mais votos que um eleito no mesmo estado (ou os dados ainda estão chegando).</div>'}
      <div class="legend-note">Candidatos que tiveram mais votos que algum eleito do mesmo estado, mas não entraram porque o partido não somou votos para mais uma cadeira. Ordenado por quantos eleitos eles superaram.</div>
    </section>`;
  }

  /* tabela completa por partido/federação */
  function tablePanel(v){
    const one=v.one, k=D.sort.k, dir=D.sort.d;
    const rows=v.agrs.map(a=>({...a,faixaN:fnome(a.faixa)}));
    const strK=k==='label'||k==='faixaN';
    rows.sort((x,y)=>(strK?String(x[k]).localeCompare(String(y[k]),'pt-BR'):((x[k]||0)-(y[k]||0)))*dir||y.tot-x.tot);
    const th=(key,label,cls)=>`<th data-dk="${key}" class="${cls||''}"${k===key?` aria-sort="${dir>0?'ascending':'descending'}" data-arrow="${dir>0?'▲':'▼'}"`:''}>${label}</th>`;
    const T={nom:0,leg:0,tot:0,qp:0,med:0,seats:0}; rows.forEach(a=>{ Object.keys(T).forEach(x=>T[x]+=a[x]||0); });
    const body=rows.map(a=>`<tr data-tip="${esc(a.nome||a.label)}"><td class="l">${sw(fcor(a.faixa))}<b>${esc(a.label)}</b>${a.isFed?' <small class="hint">federação</small>':''}</td><td class="l">${esc(a.faixaN)}</td><td>${N(a.nom)}</td><td>${N(a.leg)}</td><td>${N(a.tot)}</td><td>${P(a.pct,2)}</td>${one?`<td>${N(a.qpFrac,2)}</td>`:''}<td>${N(a.qp)}</td><td>${N(a.med)}</td><td><b>${N(a.seats)}</b></td><td>${P(a.pctSeats,1)}</td></tr>`).join('');
    const foot=`<tr><td class="l"><b>Total</b></td><td></td><td>${N(T.nom)}</td><td>${N(T.leg)}</td><td>${N(T.tot)}</td><td>${P(100,0)}</td>${one?'<td></td>':''}<td>${N(T.qp)}</td><td>${N(T.med)}</td><td><b>${N(T.seats)}</b></td><td>${P(v.vagas?T.seats/v.vagas*100:0,0)}</td></tr>`;
    return `<section class="panel glass tri">
      <div class="phead"><h2>Partidos e federações · ${esc(scopeLabel())}</h2><span class="hint">${esc(KIND[D.kind].nome)}</span></div>
      <div class="tw"><table style="min-width:900px"><thead><tr>${th('label','Partido / federação','l')}${th('faixaN','Espectro','l')}${th('nom','Votos nominais')}${th('leg','Votos de legenda')}${th('tot','Total de votos')}${th('pct','% dos válidos')}${one?th('qpFrac','Quociente part.'):''}${th('qp','Vagas pelo quociente')}${th('med','Vagas pelas sobras')}${th('seats','Total de vagas')}${th('pctSeats','% das vagas')}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>
      <div class="legend-note">Votos de legenda: votos dados só ao partido ou à federação (o TSE os soma ao total do grupo). ${one?'Quociente partidário: total de votos ÷ quociente eleitoral; a parte inteira são as vagas diretas.':'Escolha um estado para ver também o quociente partidário.'} Clique no título de uma coluna para ordenar.</div>
    </section>`;
  }

  function passoPanel(v){
    const u=v.one; if(!u) return '';
    const ev=u.events.map((e,i)=>`<tr><td>${i+1}ª sobra</td><td class="l"><b>${esc(e.label)}</b></td><td>${N(e.avg,0)}</td><td>${N(e.seat)}ª cadeira do grupo</td></tr>`).join('');
    const rows=u.agrs.filter(a=>a.tot>0).sort((a,b)=>b.tot-a.tot).slice(0,12).map(a=>`<tr><td class="l"><b>${esc(a.label)}</b></td><td>${N(a.tot)}</td><td>${N(a.qpFrac,2)}</td><td>${N(a.qp)}</td></tr>`).join('');
    return `<section class="panel glass">
      <div class="phead"><h2>Passo a passo · ${esc(UFNAME[u.uf])}</h2><span class="hint">cálculo do painel</span></div>
      <ol class="dep-steps">
        <li><b>Quociente eleitoral:</b> ${N(u.vv)} votos válidos ÷ ${N(u.vagas)} cadeiras = <b>${N(u.qe)}</b> votos por cadeira.</li>
        <li><b>Quociente partidário:</b> total de cada partido ou federação ÷ ${N(u.qe)}. A parte inteira é o número de cadeiras diretas.</li>
        <li><b>Sobras:</b> as cadeiras que restam vão, uma a uma, ao grupo com a maior média (votos ÷ (cadeiras já ganhas + 1)).</li>
        <li><b>Quem ocupa a vaga:</b> os mais votados dentro de cada partido ou federação, desde que tenham ao menos 10% do quociente (${N(Math.ceil(u.qe*0.1))} votos) quando a vaga vem do quociente.</li>
      </ol>
      <div class="tw"><table style="min-width:420px"><thead><tr><th class="l">Maiores grupos</th><th>Votos</th><th>Votos ÷ quociente</th><th>Vagas diretas</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="tw" style="margin-top:12px"><table style="min-width:460px"><thead><tr><th>Sobra</th><th class="l">Grupo</th><th>Média (votos)</th><th>Resultado</th></tr></thead><tbody>${ev||'<tr><td colspan="4" class="l">Sem sobras: todas as cadeiras saíram pelo quociente.</td></tr>'}</tbody></table></div>
      <div class="legend-note">Pela regra atual (STF, 2024) todos os partidos e federações disputam as sobras, mesmo abaixo do quociente.${u.mismatch?` Neste estado o cálculo difere do TSE em ${N(u.mismatch)} cadeira(s); vale o TSE.`:''}</div>
    </section>`;
  }

  function eleitosPanel(v){
    const el=v.cands.filter(c=>c.el).sort((a,b)=>b.vap-a.vap);
    const shown=el.slice(0,D.lim.eleitos);
    const rows=shown.map((c,i)=>`<tr><td>${i+1}</td><td class="l"><b>${esc(ctx.title(c.nm))}</b></td><td class="l">${sw(fcor(faixaOf(c.sg)))}${esc(c.sg)}</td><td class="l">${esc(fnome(faixaOf(c.sg)))}</td><td class="l">${c.uf.toUpperCase()}</td><td>${N(c.vap)}</td><td>${c.via==='QP'?'Quociente':c.via==='M'?'Sobra (média)':'—'}</td></tr>`).join('');
    const more=el.length>shown.length?`<div style="text-align:center;margin-top:10px"><button class="btn" type="button" data-dmore="eleitos">Mostrar mais (${N(el.length-shown.length)} restantes)</button></div>`:'';
    return `<section class="panel glass tri">
      <div class="phead"><h2>Eleitos · ${esc(scopeLabel())}</h2><span class="hint">${N(el.length)} ${esc(KIND[D.kind].plural.toLowerCase())} · por votos</span></div>
      <div class="tw"><table style="min-width:720px"><thead><tr><th>#</th><th class="l">Candidato</th><th class="l">Partido</th><th class="l">Espectro</th><th class="l">UF</th><th>Votos</th><th>Como entrou</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="l">Sem eleitos carregados ainda.</td></tr>'}</tbody></table></div>${more}
      <div class="legend-note">"Como entrou" indica se a vaga veio do quociente partidário ou das sobras.</div>
    </section>`;
  }

  function diagPanel(){
    const g=D.diag; if(!g) return '';
    return `<details class="dep-diag"><summary>Diagnóstico dos dados (para conferência)</summary><div class="hint">Estrutura do arquivo do TSE lida pelo painel (${esc(KIND[g.kind].nome)}, ${esc(g.uf.toUpperCase())}). Se algum número parecer estranho, estes campos mostram o que o painel encontrou.<br>
      <code>${esc(g.url)}</code><br>Nível raiz: <code>${esc(g.top)}</code><br>Totais (v): <code>${esc(g.v)}</code><br>Agrupamento: <code>${esc(g.agr)}</code><br>Partido: <code>${esc(g.par)}</code><br>Candidato: <code>${esc(g.cand)}</code> · situação do 1º: <code>${esc(g.st)}</code></div></details>`;
  }

  /* ---------- montagem ---------- */
  function render(){
    const root=document.getElementById('depRoot'); if(!root) return;
    const st=D.data[D.kind];
    const ctl=`<section class="panel glass tri head"><div class="dep-ctl"><div class="seg" role="group" aria-label="Cargo">${['fed','est'].map(x=>`<button type="button" data-dkind="${x}" aria-pressed="${D.kind===x}">${x==='fed'?'Federal':'Estadual'}<small>${x==='fed'?'Câmara dos Deputados':'Assembleias (DF: distrital)'}</small></button>`).join('')}</div></div>`;
    if(D.err&&!st){
      root.innerHTML=ctl+`<div class="headline" style="margin-top:12px">Não foi possível ler os deputados</div><div class="sub">${esc(D.err.message||D.err)}. O painel tenta de novo sozinho. Se o código da eleição estadual estiver errado, informe-o abaixo.</div>${codeForm()}</section>`;
      return;
    }
    if(!st){ root.innerHTML=ctl+'<div class="skel">Carregando deputados do TSE…</div></section>'; return; }
    if(st.missing){ root.innerHTML=ctl+`<div class="pending"><div class="headline">Deputados ainda sem apuração</div><p class="sub">O TSE ainda não publicou os arquivos de ${esc(KIND[D.kind].nome.toLowerCase())}. Se a apuração já começou, o código da eleição estadual pode estar diferente do esperado.</p></div>${codeForm()}</section>`; return; }
    const v=view();
    if(!v){ root.innerHTML=ctl+'<div class="skel">Carregando este recorte…</div></section>'; return; }
    let h=headPanel(v);
    if(D.view==='painel') h+=espectroPanel(v)+bancadasPanel(v)+votosCadeirasPanel(v)+mapPanel(v)+foraPanel(v);
    else if(D.view==='tabela') h+=tablePanel(v)+passoPanel(v);
    else h+=eleitosPanel(v);
    root.innerHTML=h+diagPanel();
  }
  function codeForm(){
    return `<details class="notice show" style="margin-top:10px"><summary>Informar o código da eleição estadual manualmente</summary>
      <div class="hint">Procure em <code>resultados.tse.jus.br/oficial/comum/config/ele-c.json</code> o código da "Eleição Ordinária Estadual" (1º turno).</div>
      <input id="depCd" value="${esc(ctx.estCdSaved()||'')}" aria-label="Código da eleição estadual" inputmode="numeric"><button class="btn" id="depCdSave" type="button">Salvar e recarregar</button></details>`;
  }

  document.addEventListener('click',e=>{
    const root=document.getElementById('depRoot'); if(!root||!root.contains(e.target)) return;
    const g=s=>e.target.closest(s); let x;
    if(x=g('[data-dkind]')){ if(D.kind!==x.dataset.dkind){ D.kind=x.dataset.dkind; D.diag=null; render(); if(!D.data[D.kind]) ctx.requestRefresh(); } return; }
    if(x=g('[data-dview]')){ D.view=x.dataset.dview; render(); window.scrollTo({top:0,behavior:'smooth'}); return; }
    if(x=g('[data-dmore]')){ const k=x.dataset.dmore; D.lim[k]+=k==='band'?20:k==='fora'?25:60; render(); return; }
    if(x=g('th[data-dk]')){ const k=x.dataset.dk; D.sort=D.sort.k===k?{k,d:-D.sort.d}:{k,d:(k==='label'||k==='faixaN')?1:-1}; render(); return; }
    if(g('#depCdSave')){ ctx.estCdSave(document.getElementById('depCd').value.trim()); location.reload(); }
  });

  return {render,refresh,status,hasData:()=>!!D.data[D.kind]};
}
