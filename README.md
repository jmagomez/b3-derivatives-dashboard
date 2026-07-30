# Dashboard de Derivativos B3

Dashboard diário dos principais contratos de derivativos e indicadores do mercado brasileiro, atualizado automaticamente às **20h (BRT)** com envio de resumo por e-mail.

**Dashboard:** https://jmagomez.github.io/b3-derivatives-dashboard/

## Conteúdo

| Aba | Conteúdo | Fonte | Histórico |
|---|---|---|---|
| Juros (DI) | Curva DI completa + taxa ~1 ano | B3 Up2Data | ~12 meses* |
| Câmbio | Dólar futuro (DOL) + PTAX | B3 / BCB | 12m* / desde 2020 |
| Ibovespa | Futuro (IND) + à vista (^BVSP) | B3 / Yahoo Finance | 12m* / desde 02/01/2020 |
| Global | Bitcoin, S&P 500, Nasdaq Composite + evolução comparada (base 100) | Yahoo Finance | desde 02/01/2020 |
| Commodities | Boi (BGI), milho (CCM), café (ICF), soja (SJC) | B3 | ~12 meses* |
| Cupom cambial | DDI e FRC | B3 | ~12 meses* |
| Petróleo | Brent Dated + WTI Spot, crack spreads (gasolina/diesel/jet fuel vs Brent) | EIA | desde 01/01/2020** |
| Opções | Contratos negociados e volume (DI1/IDI, DOL, IND, agro) | B3 | ~12 meses* |
| Indicadores | CDI, Selic, IPCA, PTAX | BCB (SGS) | desde 01/01/2020 |

\* Limite da B3: em dez/2025 a bolsa descontinuou as páginas antigas de ajustes e passou a oferecer gratuitamente apenas ~12 meses retroativos do arquivo público `TradeInformationConsolidatedFile` (Up2Data). O repositório acumula os dados a cada dia — o histórico de contratos cresce daqui em diante e nunca é apagado. Histórico anterior a isso só via Acervo B3 (PDF) ou provedores pagos.

\*\* Não existe fonte gratuita e automatizável para a curva de futuros de petróleo (ICE Brent ou CME WTI) — as páginas de settlement das bolsas são protegidas por anti-bot e exigem assinatura paga (Bloomberg, Refinitiv, Databento, OilPriceAPI etc.). Por isso a aba Petróleo mostra apenas preços à vista (spot). Os crack spreads usam produtos americanos (gasolina e diesel/heating oil de NY Harbor, jet fuel de US Gulf Coast — EIA) contra o Brent, por falta de um benchmark europeu gratuito equivalente.

## Fontes de dados

- **B3 Up2Data público**: `arquivos.b3.com.br/api/download/requestname?fileName=TradeInformationConsolidatedFile&date=YYYY-MM-DD` — ajustes, taxas do DI, volume e negócios de futuros e opções.
- **BCB SGS**: `api.bcb.gov.br` — CDI (12), Selic (11), PTAX (1), IPCA (433), desde 2020.
  A série **7 (Ibovespa à vista) foi descontinuada**: responde HTTP 200 com corpo vazio para qualquer intervalo, inclusive 2020. Nunca gerou dados e o gráfico correspondente nunca renderizou — foi substituída por `^BVSP` no Yahoo.
- **Yahoo Finance** (via `yfinance`): `^GSPC` (S&P 500), `^IXIC` (Nasdaq Composite), `BTC-USD` (Bitcoin) e `^BVSP` (Ibovespa à vista), desde 02/01/2020.
  Não há alternativa gratuita e estável para S&P 500 e Nasdaq Composite com histórico diário longo: os índices são licenciados e a redistribuição é paga; o Stooq bloqueia acesso programático; o FRED publica o S&P 500 mas não o Nasdaq Composite.
  **Somente fechamentos consolidados são gravados** — a barra da sessão em curso, que o Yahoo devolve com valor intradiário, é descartada. O corte é **por ativo**, não uma data única: às 20h BRT (23:00 UTC) os índices do dia já fecharam (NY às 20:00/21:00 UTC, B3 às 21:00 UTC), mas a barra diária do bitcoin só fecha à meia-noite UTC. Um corte único descartaria o fechamento do dia dos índices à toa e deixaria as séries um dia atrasadas.
- **EIA (U.S. Energy Information Administration)**: `api.eia.gov/v2/petroleum/pri/spt` — Brent Dated (RBRTE), WTI Spot (RWTC) e produtos (gasolina, diesel/heating oil, jet fuel), desde 2020. Requer uma chave de API gratuita.

## Configuração (uma única vez)

1. **Backfill**: aba *Actions* → *Backfill historico (desde 2020)* → *Run workflow* (datas anteriores à cobertura da B3 são puladas automaticamente; indicadores BCB, EIA e Yahoo voltam até 2020).
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
5. **Índices globais e bitcoin**: não precisam de chave. Na primeira execução `fetch_markets.py` baixa o histórico completo desde 02/01/2020 automaticamente.

## Funcionamento

- `daily.yml`: todo dia às 23:00 UTC (20h BRT do mesmo dia) — busca o pregão (janela de recuperação de 10 dias; se o arquivo do dia ainda não estiver publicado, entra no dia seguinte), atualiza `data/`, regenera `docs/data/` e envia o e-mail.
- `backfill.yml`: preenche intervalos de datas (acionamento manual).

### Sobre o horário

Às 20h BRT o pregão da B3 já encerrou (18h) e o de Nova York também (17h/18h BRT), então o e-mail sai com o fechamento do próprio dia. A contrapartida é que a B3 publica o `TradeInformationConsolidatedFile` com atraso variável: se o arquivo do dia ainda não estiver disponível às 20h, a janela de recuperação de 10 dias o pega na execução seguinte. Por isso o campo `frescor` e o aviso de defasagem importam — eles distinguem "atraso normal de publicação" de "coleta quebrada".

## Observações

- Taxas do DI vêm diretamente do campo `AdjstdQtTax` da B3 (quando ausente, são implícitas do PU com dias úteis aproximados).
- Crack spread = preço do produto (US$/gal) × 42 − Brent Dated (US$/bbl).
- `scripts/fetch_options.py` é legado (fonte antiga descontinuada pela B3) e não é mais usado.
- **FRC é cotado em taxa (% a.a.), não em PU.** O arquivo da B3 traz `AdjstdQt` vazio e o valor em `AdjstdQtTax` para esse contrato; a série era montada a partir do PU e por isso saía vazia, apesar dos 11.841 registros já coletados.
- **Detecção de defasagem**: `summary.json` traz um bloco `frescor` com a data mais recente e o atraso em dias de cada fonte (B3, BCB, EIA, Yahoo). O dashboard e o e-mail exibem um aviso quando alguma fonte passa do limite tolerado. Sem isso uma quebra na coleta passa batida — o dashboard continua publicando o último fechamento bom como se fosse o de hoje.
- **Ausência de arquivo ≠ falha de coleta.** A B3 às vezes responde HTTP 200 com uma página HTML (bloqueio/limite de taxa) em vez do CSV. Antes os dois casos eram tratados igual e o dia entrava na conta de "sem pregão", criando buracos silenciosos no histórico. Agora `fetch_b3` valida a assinatura do arquivo e separa `ArquivoIndisponivel` (definitivo) de `FalhaFonte` (retentável, reportado).
- Índices são em **pontos**, não retorno total: não incluem dividendos. Bitcoin negocia 7 dias por semana e os índices só em dias de pregão — as séries têm contagens de pontos diferentes de propósito.
- Uso informativo. Não constitui recomendação de investimento.
