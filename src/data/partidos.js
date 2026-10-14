// Classificação de partidos, cores e número de vagas por estado.
//
// A classificação por espectro político é EDITORIAL (não é dado do TSE): ela segue a
// leitura mais comum da ciência política e da imprensa, mas é discutível em vários casos.
// Para mudar um partido de faixa, edite o objeto FAIXA abaixo (a chave é a sigla sem
// acento, espaço ou pontuação, em maiúsculas).

/* Cores validadas com scripts/validate_palette.js (modo claro): separação para daltonismo
   e contraste. Em fundo escuro o contraste de algumas faixas fica abaixo de 3:1, por isso os
   gráficos sempre trazem rótulos de texto e há uma tabela com os mesmos números. */
export const ESPECTRO=[
  {id:'E',  nome:'Esquerda',         cor:'#D6342B'},
  {id:'CE', nome:'Centro-esquerda',  cor:'#E8A317'},
  {id:'C',  nome:'Centro',           cor:'#2E9E6B'},
  {id:'CD', nome:'Centro-direita',   cor:'#4DA3E0'},
  {id:'D',  nome:'Direita',          cor:'#4B3FBF'},
  {id:'N',  nome:'Não classificado', cor:'#8A93A1'},
];
export const FAIXA_BY_ID=Object.fromEntries(ESPECTRO.map(f=>[f.id,f]));

export const FAIXA={
  /* esquerda */
  PT:'E',PCDOB:'E',PV:'E',PSOL:'E',REDE:'E',PCB:'E',PSTU:'E',PCO:'E',UP:'E',
  /* centro-esquerda */
  PSB:'CE',PDT:'CE',
  /* centro */
  MDB:'C',PSD:'C',PSDB:'C',CIDADANIA:'C',PODE:'C',PODEMOS:'C',SOLIDARIEDADE:'C',AVANTE:'C',AGIR:'C',MOBILIZA:'C',PMN:'C',
  /* centro-direita */
  PP:'CD',PROGRESSISTAS:'CD',UNIAO:'CD',UNIAOBRASIL:'CD',REPUBLICANOS:'CD',PRD:'CD',
  /* direita */
  PL:'D',NOVO:'D',PRTB:'D',DC:'D',PMB:'D',
};

export const normSigla=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export const faixaOf=sg=>FAIXA[normSigla(sg)]||'N';

/* Cores de partido (Governador e Senador): o número do candidato começa com o número do partido. */
const PARTY_COLORS={'13':'#D62839','22':'#2563C9','55':'#E69F00','11':'#8C6D31','44':'#56B4E9','15':'#17A2B8','45':'#7B61C9','10':'#0F766E','40':'#E4572E','12':'#B45309','50':'#A21CAF','65':'#9F1239','43':'#4D7C0F','18':'#0E9F6E','30':'#F97316','70':'#F59E0B','77':'#EA580C','25':'#6D28D9','20':'#0369A1','23':'#BE185D','36':'#65A30D','28':'#4338CA','27':'#475569','33':'#0D9488'};
export function partyColor(num){
  const k=String(num).slice(0,2);
  if(PARTY_COLORS[k]) return PARTY_COLORS[k];
  const h=(parseInt(k,10)||0)*47%360;
  return `hsl(${h} 55% 45%)`;
}

/* Cadeiras na Câmara dos Deputados por UF (Lei Complementar 78/1993 e atualizações).
   Assembleias: 3 vezes a bancada federal até 12; acima disso, 36 mais o que passar de 12 (CF, art. 27). */
export const VAGAS_FED={ac:8,al:9,ap:8,am:8,ba:39,ce:22,df:8,es:10,go:17,ma:18,mt:8,ms:8,mg:53,pa:17,pb:12,pr:30,pe:25,pi:10,rj:46,rn:8,rs:31,sc:16,sp:70,se:8,to:8,ro:8,rr:8};
export const vagasEst=uf=>{const f=VAGAS_FED[uf]; return f<=12?f*3:36+(f-12)};
export const vagas=(kind,uf)=>kind==='fed'?VAGAS_FED[uf]:vagasEst(uf);
