# Apuração · Presidente 2026

Painel não oficial de acompanhamento da apuração das eleições presidenciais de 2026, com dados oficiais de divulgação do TSE. Roda inteiramente no navegador: não há back-end.

## Estrutura

```
index.html                 marcação da página
src/
  main.js                  lógica do painel (leitura do TSE, filtros, gráficos, mapas)
  styles/main.css          estilos (temas claro e escuro, layout responsivo)
  data/brazil-map.js       malha SVG dos estados (@svg-maps/brazil, CC BY 4.0)
  data/world-map.js        mapa-múndi e tabela país → id (Natural Earth via world-atlas)
vite.config.js             configuração do Vite
vercel.json                configuração de deploy e cache
```

## Desenvolvimento

Requer Node.js 20.19 ou superior.

```bash
npm install
npm run dev       # servidor local com recarga automática
npm run build     # gera a pasta dist/
npm run preview   # serve o build localmente
```

## Deploy (Vercel)

O projeto é detectado como Vite. Importe o repositório na Vercel e use os padrões:

- Build command: `npm run build`
- Output directory: `dist`

## Fontes de dados

- Resultados: arquivos JSON de divulgação do TSE (`resultados.tse.jus.br`), consultados direto pelo navegador a cada 15 segundos.
- Mapa das cidades: malhas do IBGE, baixadas ao usar o mapa por cidade.
