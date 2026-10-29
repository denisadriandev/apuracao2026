import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/auditoria-stats.js';

const rng=(seed=1)=>()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} ≈ ${b} (±${t})`);

test('qui-quadrado: valores críticos conhecidos',()=>{
  near(S.chi2sf(15.507,8),0.05,0.002); near(S.chi2sf(20.090,8),0.01,0.001); near(S.chi2sf(16.919,9),0.05,0.002); assert.equal(S.chi2sf(0,8),1);
});
test('binomial e teste do sinal',()=>{
  near(S.binomTailGE(10,0.5,8),56/1024,1e-9); near(S.binomTailGE(10,0.5,10),1/1024,1e-9);
  near(S.signTest(10,10),2/1024,1e-9); near(S.signTest(50,100),1,1e-9); assert.ok(S.signTest(700,1000)<1e-10);
});
test('Benford: massa 1º e 2º dígitos somam 1',()=>{
  near(S.BENFORD1.reduce((a,b)=>a+b),1,1e-12); near(S.BENFORD2.reduce((a,b)=>a+b),1,1e-12); near(S.BENFORD1[0],0.30103,1e-4); near(S.BENFORD2[0],0.11968,1e-4);
});
test('Benford: amostra log-uniforme conforma; uniforme não',()=>{
  const r=rng(7), good=Array.from({length:50000},()=>Math.floor(10**(r()*4+1)));
  const g1=S.benford(good,1), g2=S.benford(good,2);
  assert.equal(g1.cls,'close'); assert.equal(g2.cls,'close');
  const u=Array.from({length:50000},()=>100+Math.floor(r()*900)), b1=S.benford(u,1);
  assert.equal(b1.cls,'nonconform'); assert.ok(b1.p<1e-6);
});
test('histograma e extremos',()=>{
  const h=S.histogram([0,0.04,0.05,0.5,0.99,1],0.05); assert.equal(h.length,20); assert.equal(h[0],2); assert.equal(h[1],1); assert.equal(h[19],2);
  const secs=[{vv:100,v:{a:100}},{vv:100,v:{a:96}},{vv:100,v:{a:50}},{vv:10,v:{a:10}}];
  const e=S.extremeCounts(secs,'a',50); assert.equal(e.base,3); assert.equal(e.rows.find(x=>x.t===1).n,1); assert.equal(e.rows.find(x=>x.t===0.95).n,2);
});
test('outliers locais: acha a urna 99% num município de ~50%',()=>{
  const r=rng(3), secs=[];
  for(let i=0;i<120;i++){ const vv=200, a=Math.round(vv*(0.5+(r()-0.5)*0.1)); secs.push({uf:'sp',mun:'1',zon:'1',ns:String(i),vv,v:{a,b:vv-a}}); }
  secs.push({uf:'sp',mun:'1',zon:'1',ns:'999',vv:200,v:{a:198,b:2}});
  const o=S.localOutliers(secs,'a','b'); assert.equal(o.out.length,1); assert.equal(o.nA,1); assert.equal(o.out[0].s.ns,'999'); assert.ok(o.excessA>80);
  const calm=S.localOutliers(secs.slice(0,120),'a','b'); assert.equal(calm.out.length,0);
});
test('lacuna e histograma horário',()=>{
  const H=3600000; const g=S.maxGap([0,H,2*H,30*H,31*H]); assert.equal(g.gap,28*H); assert.equal(g.from,2*H);
  const h=S.hourly([0,10,H+5,H+6,H+7]); assert.deepEqual(h.map(x=>x.n),[2,3]);
});
test('veredito: influência máxima dos votos após as 17h',()=>{
  const v=S.verdict({margin:4430191,extVotes:34393,gap:{gap:3600000},secs:0,minSample:500});
  assert.equal(v.items.find(i=>i.id==='ext').st,'ok'); assert.equal(v.items.find(i=>i.id==='out').st,'na'); assert.equal(v.items.find(i=>i.id==='bio').st,'na');
  const w=S.verdict({margin:1000,extVotes:5000,gap:null,secs:0,minSample:500}); assert.equal(w.items.find(i=>i.id==='ext').st,'bad');
});

test('veredito: Benford só vira anomalia contra referência; sem referência é inconclusivo',()=>{
  const base={margin:1000,extVotes:0,gap:null,secs:0,minSample:500,sampleMargin:100};
  const cur={mad:0.03,cls:'nonconform',n:9000,who:'X'};
  const sem=S.verdict({...base,benf:{cur,ref:null}}).items.find(i=>i.id==='ben'); assert.equal(sem.st,'warn');
  const igual=S.verdict({...base,benf:{cur,ref:{mad:0.029,cls:'nonconform'}}}).items.find(i=>i.id==='ben'); assert.equal(igual.st,'ok');
  const contra=S.verdict({...base,benf:{cur,ref:{mad:0.004,cls:'close'}}}).items.find(i=>i.id==='ben'); assert.equal(contra.st,'bad');
  const bom=S.verdict({...base,benf:{cur:{mad:0.004,cls:'close',n:9000,who:'X'},ref:null}}).items.find(i=>i.id==='ben'); assert.equal(bom.st,'ok');
});
test('veredito: outliers assimétricos só pesam se o excesso for relevante na margem',()=>{
  const mk=(nA,nB,exA,exB)=>({out:new Array(nA+nB).fill(0),nA,nB,usable:10000,pSign:S.signTest(nA,nA+nB),excessA:exA,excessB:exB});
  const base={margin:1000,extVotes:0,gap:null,secs:2000,minSample:500};
  const leve=S.verdict({...base,sampleMargin:100000,outl:mk(60,5,3000,200)}).items.find(i=>i.id==='out'); assert.equal(leve.st,'warn');
  const forte=S.verdict({...base,sampleMargin:10000,outl:mk(60,5,3000,200)}).items.find(i=>i.id==='out'); assert.equal(forte.st,'bad');
  const nada=S.verdict({...base,sampleMargin:10000,outl:mk(0,0,0,0)}).items.find(i=>i.id==='out'); assert.equal(nada.st,'ok');
});
