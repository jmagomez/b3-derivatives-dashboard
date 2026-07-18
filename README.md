# Dashboard de Derivativos B3

Dashboard diário dos principais contratos de derivativos do mercado brasileiro, com dados desde **01/01/2020**, atualizado automaticamente às **20h (BRT)** com envio de resumo por e-mail.

**Dashboard:** habilite o GitHub Pages (instruções abaixo) e acesse `https://<seu-usuario>.github.io/<repo>/`.

## Conteúdo

| Aba | Conteúdo | Fonte |
|---|---|---|
| Juros (DI) | Curva DI completa + taxa implícita ~1 ano | B3 (ajustes) |
| Câmbio | Dólar futuro (DOL) + PTAX | B3 / BCB |
| Ibovespa | Futuro de índice (IND) | B3 |
| Commodities | Boi (BGI), milho (CCM), café (ICF), soja (SJC) | B3 |
| Cupom cambial | DDI e FRC | B3 |
| Opções | Volume e contratos em aberto (IND/DOL) | B3 Sistema Pregão |
| Indicadores | CDI, Selic, IPCA | BCB (SGS) |

## Configuração (uma única vez)

1. **Backfill do histórico**: aba *Actions* → *Backfill historico (desde 2020)* → *Run workflow*. Leva ~1h (≈1.600 pregões, 1 requisição/dia à B3).
2. **GitHub Pages**: *Settings* → *Pages* → Source: *Deploy from a branch* → Branch `main`, pasta `/docs` → *Save*.
3. **E-mail diário** (Gmail):
   - Crie uma [senha de app do Google](https://myaccount.google.com/apppasswords) (requer verificação em 2 etapas ativa);
   - *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:
     - `MAIL_USERNAME` = seu Gmail (ex.: `jmagomez@gmail.com`)
     - `MAIL_PASSWORD` = a senha de app gerada.
   - Sem os secrets, o workflow roda normalmente e apenas pula o envio.

## Funcionamento

- `daily.yml`: roda todo dia às 23:00 UTC (20:00 BRT), busca o pregão do dia (com janela de recuperação de 10 dias), atualiza os CSVs em `data/`, regenera os JSONs de `docs/data/` e envia o e-mail.
- `backfill.yml`: preenche qualquer intervalo de datas faltante (acionamento manual).

## Limitações conhecidas

- Dados **diários** (preço de ajuste). Intraday/tick não é gratuito.
- Histórico de opções (volume/OI agregado) acumula a partir da criação do repo — a B3 não oferece esse agregado gratuito retroativo em endpoint simples.
- Taxas do DI são implícitas do PU com dias úteis aproximados (seg–sex, sem feriados) — diferença marginal vs. taxa oficial.
- As páginas da B3 (`www2.bmf.com.br`) podem mudar de layout; o parser tem fallbacks, mas monitore a aba *Actions* em caso de falha.

Uso informativo. Não constitui recomendação de investimento.
# b3-derivatives-dashboard
Dashboard diário de derivativos da B3 (DI, dólar, Ibovespa, commodities, cupom cambial, opções) desde 2020, com e-mail automático às 20h BRT
