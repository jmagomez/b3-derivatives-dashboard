# CLAUDE.md — guia operacional do repositório

Dashboard diário de derivativos B3 + mercados globais (GitHub Pages). Contexto, fontes e
justificativas de projeto: **README.md** (não repetir aqui). Este arquivo só traz o que um
agente/dev precisa para mexer sem quebrar nada.

## Fluxo (uma linha por etapa)
`daily.yml` → `scripts/update.py`: `fetch_b3` → `fetch_bcb` → `fetch_eia` → `fetch_markets`
(grava `data/`) → **gate** `publicacao.decidir()` → `build_site` (grava `docs/data/*.json`,
inclui `analytics.json` via `analytics.py`) → `build_email` → workflow commita `data/` + `docs/`
e envia o e-mail só se `novo=true`. Front: `docs/index.html` (Chart.js) só lê os JSONs.
`backfill.yml` é manual (histórico).

## Invariantes (não negociáveis)
1. **Só fechamentos consolidados.** Nunca gravar/publicar barra intradiária. A publicação espera
   a barra do BTC do último pregão da B3 (`scripts/publicacao.py`); sem ela, `data/` é gravado e
   `docs/`/e-mail ficam como estavam.
2. **Não inventar número.** Sem histórico → `None`/`n/d`. Nada de preencher, extrapolar ou assumir
   CDI/taxa zero. Datas sem cotação são descartadas, não interpoladas.
3. **Cálculo no Python, apresentação no front.** Métricas financeiras vivem em `analytics.py`
   (puras, testadas); o HTML não calcula retorno/risco.
4. **Uma definição por coisa.** Fontes monitoradas e limites de defasagem: só `scripts/fontes.py`.
   Unidade da variação diária (taxa→bps, preço→%): só `scripts/unidades.py`. Nos dois casos
   `build_site` grava o resultado no `summary.json` (`frescor`, `var_unit`) e e-mail e dashboard
   **leem** — nenhum dos dois conhece código de contrato. Não recriar dicionários nem listas de
   códigos: a regra da unidade já esteve em 3 arquivos e os 3 divergiram.
5. **Falha isolada.** Erro em `analytics` não derruba a atualização (`analytics_status` no summary).
6. BTC negocia 7 dias; cards e métricas usam só dia útil (seg–sex, sem feriados). O gráfico da aba
   Global mantém fim de semana de propósito.

## Frontend (`web/`) — React + Vite + TypeScript

Substitui o `docs/index.html` monolítico. **Só a apresentação muda**: a coleta, a validação e o
cálculo continuam no pipeline Python, que é a parte auditada.

- **Vite, não Next.js.** O destino é Pages (estático) e não há fetch em runtime — o pipeline
  commita os JSON prontos. RSC/ISR/Server Actions exigem servidor Node; com `output: 'export'`
  desligam. O ganho seria zero e o custo (build mais lento, `basePath`+`assetPrefix`) real.
- **Recharts, não Chart.js.** `<canvas>` é opaco para leitor de tela; dar a11y a ele exige montar
  tabela equivalente à mão em cada gráfico. Recharts é SVG: cada nó aceita `aria-*` e foco.
- **`base` do Vite.** O site vive num subdiretório. Sem `base: '/b3-derivatives-dashboard/'` os
  assets são pedidos na raiz do domínio e a página sobe em branco.
- **Origem do Pages mudou** de "branch main /docs" para "GitHub Actions" (`deploy.yml`). Bundle com
  hash no nome não pode ser commitado — encheria o histórico a cada build.
- **Dados em dev**: o Vite faz proxy de `/data/*` para `../docs/data/`, então o app roda contra o
  dado real sem o pipeline. Em produção o `deploy.yml` copia `docs/data/` para `dist/data/` — o
  caminho relativo é o mesmo nos dois ambientes.

### Invariantes do front
7. **A UI não decide unidade nem calcula indicador.** Lê `variation` + `var_unit` e formata. Se
   precisar de um número novo, ele nasce no Python.
8. **Paridade de formatação Python↔TS.** `scripts/unidades.py:formata()` e
   `web/src/lib/variation.ts:formataVariacao()` produzem a MESMA string para o mesmo par
   (valor, unidade) — o número aparece no e-mail (Python) e no dashboard (TS). Há teste de
   paridade; foi ele que pegou o separador de milhar divergindo (`+1234,5` vs `+1.234,5`).
9. **O contrato é validado na fronteira** (Zod, `src/services/schemas/`). Payload fora do contrato
   falha explícito e localizado, em vez de virar `undefined` num gráfico vazio.

## Comandos
- Testes (pipeline): `pip install -r requirements.txt -r requirements-dev.txt && pytest`.
- Front: `cd web && npm ci && npm run dev` (5173). `npm run typecheck && npm run lint && npm run test`
  antes de qualquer push — são os mesmos gates do `deploy.yml`, e todos bloqueantes.
- Rodar o pipeline local: `cd scripts && python update.py` (rede; Yahoo pode bloquear).
- Testes usam fixtures **reais** em `tests/fixtures/`; conferem contra aritmética direta, não
  contra a própria implementação. Ao mudar métrica, adicione caso calculável à mão.

## Convenções
- Código/comentários em português sem acentos (padrão existente); textos da UI com acentos.
- `data/` é histórico acumulado e nunca é apagado. Não editar `data/`/`docs/data/` à mão.
- Mexer em `.github/workflows/` exige permissão de workflow (integração do GitHub app não tem).
- Verificar sempre o conteúdo publicado após push (já houve erro de digitação em tooltip).
