# Dashboard de Derivativos B3

Dashboard diário dos principais contratos de derivativos e indicadores do mercado brasileiro, atualizado automaticamente às **23h (BRT)** com envio de resumo por e-mail.

**Dashboard:** https://jmagomez.github.io/b3-derivatives-dashboard/

## Conteúdo

| Aba | Conteúdo | Fonte | Histórico |
|---|---|---|---|
| Juros (DI) | Curva DI completa + taxa ~1 ano | B3 Up2Data | ~12 meses* |
| Câmbio | Dólar futuro (DOL) + PTAX | B3 / BCB | 12m* / desde 2020 |
| Ibovespa | Futuro (IND) + à vista (BCB) | B3 / BCB | 12m* / desde 2020 |
| Commodities | Boi (BGI), milho (CCM), café (ICF), soja (SJC) | B3 | ~12 meses* |
| Cupom cambial | DDI e FRC | B3 | ~12 meses* |
| Petróleo | Brent Dated + WTI Spot, crack spreads (gasolina/diesel/jet fuel vs Brent) | EIA | desde 01/01/2020** |
| Opções | Contratos negociados e volume (DI1/IDI, DOL, IND, agro) | B3 | ~12 meses* |
| Indicadores | CDI, Selic, IPCA, PTAX, Ibovespa | BCB (SGS) | desde 01/01/2020 |

\* Limite da B3: em dez/2025 a bolsa descontinuou as páginas antigas de ajustes e passou a oferecer gratuitamente apenas ~12 meses retroativos do arquivo público `TradeInformationConsolidatedFile` (Up2Data). O repositório acumula os dados a cada dia — o histórico de contratos cresce daqui em diante e nunca é apagado. Histórico anterior a isso só via Acervo B3 (PDF) ou provedores pagos.

\*\* Não existe fonte gratuita e automatizável para a curva de futuros de petróleo (ICE Brent ou CME WTI) — as páginas de settlement das bolsas são protegidas por anti-bot e exigem assinatura paga (Bloomberg, Refinitiv, Databento, OilPriceAPI etc.). Por isso a aba Petróleo mostra apenas preços à vista (spot). Os crack spreads usam produtos americanos (gasolina e diesel/heating oil de NY Harbor, jet fuel de US Gulf Coast — EIA) contra o Brent, por falta de um benchmark europeu gratuito equivalente.

## Fontes de dados

- **B3 Up2Data público**: `arquivos.b3.com.br/api/download/requestname?fileName=TradeInformationConsolidatedFile&date=YYYY-MM-DD` — ajustes, taxas do DI, volume e negócios de futuros e opções.
- **BCB SGS**: `api.bcb.gov.br` — CDI (12), Selic (11), PTAX (1), IPCA (433), Ibovespa (7), desde 2020.
- **EIA (U.S. Energy Information Administration)**: `api.eia.gov/v2/petroleum/pri/spt` — Brent Dated (RBRTE), WTI Spot (RWTC) e produtos (gasolina, diesel/heating oil, jet fuel), desde 2020. Requer uma chave de API gratuita.

## Configuração (uma única vez)

1. **Backfill**: aba *Actions* → *Backfill historico (desde 2020)* → *Run workflow* (datas anteriores à cobertura da B3 são puladas automaticamente; indicadores BCB e EIA voltam até 2020).
2. **GitHub Pages**: já ativado (branch `main`, pasta `/docs`).
3. **E-mail diário** (Gmail):
   - Crie uma [senha de app do Google](https://myaccount.google.com/apppasswords) (requer verificação em 2 etapas);
   - *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:
     - `MAIL_USERNAME` = seu Gmail
     - `MAIL_PASSWORD_B3` = a senha de app.
   - Sem os secrets, o workflow roda normalmente e apenas pula o envio.
4. **Dados de petróleo (EIA)**:
   - Registre uma chave gratuita em [eia.gov/opendata/register](https://www.eia.gov/opendata/register.php) (só pede nome e e-mail; confirme o link de verificação enviado por e-mail);
   - *Settings* → *Secrets and variables* → *Actions* → *New repository secret*: `EIA_API_KEY` = a chave recebida.
   - Sem o secret, a aba Petróleo fica vazia e o resto do dashboard continua normal.

## Funcionamento

- `daily.yml`: todo dia às 02:00 UTC (23:00 BRT do dia anterior) — busca o pregão (janela de recuperação de 10 dias; se o arquivo do dia ainda não estiver publicado, entra no dia seguinte), atualiza `data/`, regenera `docs/data/` e envia o e-mail.
- `backfill.yml`: preenche intervalos de datas (acionamento manual).

## Observações

- Taxas do DI vêm diretamente do campo `AdjstdQtTax` da B3 (quando ausente, são implícitas do PU com dias úteis aproximados).
- Crack spread = preço do produto (US$/gal) × 42 − Brent Dated (US$/bbl).
- `scripts/fetch_options.py` é legado (fonte antiga descontinuada pela B3) e não é mais usado.
- Uso informativo. Não constitui recomendação de investimento.
