# Apuração 2026 · Presidente, Governador, Senador e Deputados

Painel não oficial de acompanhamento da apuração das eleições de 2026, com dados oficiais de divulgação do TSE. Roda inteiramente no navegador: não há back-end.

## Estrutura

```
index.html                 marcação da página
src/
  main.js                  lógica do painel (leitura do TSE, filtros, gráficos, mapas)
  deputado.js              página Deputado (Federal e Estadual): leitura, cálculo das cadeiras e gráficos
  data/partidos.js         espectro político por partido, cores de partido e número de vagas por UF
  styles/main.css          estilos (temas claro e escuro, layout responsivo)
  data/brazil-map.js       malha SVG dos estados (@svg-maps/brazil, CC BY 4.0)
  data/world-map.js        mapa-múndi e tabela país → id (Natural Earth via world-atlas)
vite.config.js             configuração do Vite
vercel.json                configuração de deploy e cache
```

## Recursos

- **Urnas apuradas no mapa:** o interruptor "Urnas apuradas" (cabeçalho do mapa) mostra a % de seções totalizadas de cada estado. Cabe dentro dos estados grandes; nos pequenos vira uma etiqueta na margem direita.
- **Filtros lembrados:** turno, região, estado, município, zona, seção, candidato, página, modo de exibição e interruptores ficam salvos no navegador (`localStorage`, chave `tse26_state_v1`). Ao atualizar a página, puxar para baixo no celular, fechar e reabrir, o painel volta como estava. O botão "Limpar" zera os filtros; um `#página` na URL tem prioridade sobre a página salva.

## Cargos

- **Presidente**: como sempre (1º e 2º turno, zona e seção).
- **Governador** e **Senador**: seletor "Cargo" no topo. Sem estado escolhido, o painel mostra o quadro nacional (um cartão por UF com quem lidera); ao escolher um estado, aparecem as mesmas telas do Presidente (resumo, ranking, curva, mapa e tabela). No Senador há 2 vagas por estado e não há 2º turno. As cores são dos partidos (dois primeiros dígitos do número do candidato). Município, zona e seção continuam só para Presidente.
- **Deputado** (página própria): alterna entre Federal e Estadual (DF: Distrital), que seguem o mesmo racional proporcional. Traz cadeiras por espectro político (hemiciclo), bancadas por partido e federação, votos × cadeiras, mapa do espectro por estado, mais votados que ficaram de fora, tabela completa por partido/federação (com quociente partidário e sobras) e lista de eleitos. Os filtros de região e estado valem para a página.

### Espectro político

A classificação (Esquerda, Centro-esquerda, Centro, Centro-direita, Direita) é editorial e vive em `src/data/partidos.js`; para mudar um partido de faixa, edite o objeto `FAIXA`. Partidos fora da lista aparecem como "Não classificado".

### Eleição estadual do TSE

Governador, Senador e Deputados ficam na eleição "estadual" do TSE, que tem código próprio (o painel o lê de `comum/config/ele-c.json`). Se o código lido estiver errado, é possível informá-lo manualmente (formulário na página Deputado ou `localStorage.tse26_cd_est`). Nos deputados, quando o TSE ainda não marcou todos os eleitos, o painel projeta as cadeiras pelo quociente eleitoral e pela maior média e avisa na tela; votos sub judice ficam fora do cálculo.

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
