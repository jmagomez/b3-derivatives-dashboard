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
4. **Uma definição por coisa.** Fontes monitoradas e limites de defasagem: só `scripts/fontes.py`
   (build_site grava em `summary.json["frescor"]`; e-mail e dashboard leem). Não recriar dicionários.
5. **Falha isolada.** Erro em `analytics` não derruba a atualização (`analytics_status` no summary).
6. BTC negocia 7 dias; cards e métricas usam só dia útil (seg–sex, sem feriados). O gráfico da aba
   Global mantém fim de semana de propósito.

## Comandos
- Testes: `pip install -r requirements.txt -r requirements-dev.txt && pytest` (CI roda o mesmo).
- Rodar o pipeline local: `cd scripts && python update.py` (rede; Yahoo pode bloquear).
- Testes usam fixtures **reais** em `tests/fixtures/`; conferem contra aritmética direta, não
  contra a própria implementação. Ao mudar métrica, adicione caso calculável à mão.

## Convenções
- Código/comentários em português sem acentos (padrão existente); textos da UI com acentos.
- `data/` é histórico acumulado e nunca é apagado. Não editar `data/`/`docs/data/` à mão.
- Mexer em `.github/workflows/` exige permissão de workflow (integração do GitHub app não tem).
- Verificar sempre o conteúdo publicado após push (já houve erro de digitação em tooltip).
