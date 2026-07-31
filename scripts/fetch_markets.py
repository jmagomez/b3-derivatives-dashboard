"""Indices globais, bitcoin e Ibovespa a vista (Yahoo Finance via yfinance).

Series coletadas
----------------
    ^GSPC    S&P 500              (pontos, fechamento da sessao de NY)
    ^IXIC    Nasdaq Composite     (pontos, fechamento da sessao de NY)
    BTC-USD  Bitcoin              (US$, fechamento da barra diaria UTC)
    ^BVSP    Ibovespa a vista     (pontos, fechamento da sessao da B3)

Por que Yahoo/yfinance
----------------------
Nao ha fonte gratuita e estavel para S&P 500 e Nasdaq Composite com historico
diario longo: os indices sao licenciados e a redistribuicao e paga; o Stooq
bloqueia acesso programatico ("Access denied"); o FRED publica o S&P 500 mas nao
o Nasdaq Composite. O endpoint `chart` do Yahoo entrega os quatro desde
02/01/2020 e o yfinance cuida do handshake de cookie/crumb -- mesma dependencia
ja usada em producao no repositorio oil-gas-financial-dashboard.

^BVSP substitui a serie 7 do SGS/BCB (Ibovespa a vista), descontinuada: a API
responde HTTP 200 com corpo vazio para qualquer intervalo, inclusive 2020.

Barra da sessao em curso
------------------------
O Yahoo devolve a barra do dia corrente ainda em formacao (valor intradiario).
Grava-la misturaria intradia com fechamento no mesmo grafico.

O corte NAO pode ser um simples "data < hoje (UTC)", porque cada ativo fecha num
horario diferente e a rotina diaria roda as 23:00 UTC (20h BRT):

    ^GSPC / ^IXIC   NY fecha 16:00 ET = 20:00 UTC (verao) ou 21:00 UTC (inverno)
    ^BVSP           B3 fecha 18:00 BRT = 21:00 UTC (BRT e UTC-3 fixo desde 2019)
    BTC-USD         negocia 24/7: a barra diaria so fecha a 00:00 UTC do dia SEGUINTE

As 23:00 UTC os indices do dia ja fecharam, mas a barra do bitcoin ainda tem uma
hora pela frente. Com a regra ingenua, o fechamento do dia dos indices seria
descartado a toa e as series ficariam um dia atrasadas. Por isso o corte e por
ativo (FECHAMENTO_MIN_UTC).
"""
import datetime as dt
import os
import sys

import pandas as pd

# ticker do Yahoo -> nome da coluna no CSV
SERIES = {
    "^GSPC": "sp500",
    "^IXIC": "nasdaq",
    "BTC-USD": "btc",
    "^BVSP": "ibov",
}

# Minutos apos 00:00 UTC do dia D a partir dos quais a barra de D e considerada
# FECHADA. 1440 = so no dia seguinte. Margem de 30 min sobre o fechamento real
# para o Yahoo consolidar o preco oficial.
FECHAMENTO_MIN_UTC = {
    "^GSPC": 21 * 60 + 30,
    "^IXIC": 21 * 60 + 30,
    "^BVSP": 21 * 60 + 30,
    "BTC-USD": 24 * 60,
}
PADRAO_FECHAMENTO_MIN = 24 * 60

INICIO = dt.date(2020, 1, 1)
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "markets.csv")
COLS = ["date"] + list(SERIES.values())


def _agora_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _hoje_utc() -> dt.date:
    return _agora_utc().date()


def barra_fechada(ticker: str, data: dt.date, agora: dt.datetime) -> bool:
    """A barra diaria de `data` para `ticker` ja e um fechamento consolidado?"""
    minutos = FECHAMENTO_MIN_UTC.get(ticker, PADRAO_FECHAMENTO_MIN)
    corte = dt.datetime.combine(data, dt.time(0, 0), tzinfo=dt.timezone.utc) + dt.timedelta(minutes=minutos)
    return agora >= corte


def normaliza(bruto: dict, agora=None) -> pd.DataFrame:
    """Converte {ticker: serie de fechamentos} num DataFrame date x serie.

    Funcao pura (sem rede): recebe o que a camada de rede devolveu e aplica o
    corte da sessao em curso, por ativo. Testada em tests/test_markets.py.
    """
    agora = agora or _agora_utc()
    if agora.tzinfo is None:
        agora = agora.replace(tzinfo=dt.timezone.utc)
    quadros = []
    for ticker, coluna in SERIES.items():
        s = bruto.get(ticker)
        if s is None or len(s) == 0:
            continue
        df = pd.DataFrame({
            "date": pd.to_datetime(pd.Series(list(s.index))).dt.date,
            coluna: pd.to_numeric(pd.Series(list(s.values)), errors="coerce"),
        })
        df = df.dropna(subset=[coluna])
        # descarta a barra ainda em formacao (ver docstring do modulo)
        df = df[df["date"].map(lambda d: barra_fechada(ticker, d, agora))]
        df = df.drop_duplicates(subset=["date"], keep="last")
        if len(df):
            quadros.append(df)

    if not quadros:
        return pd.DataFrame(columns=COLS)

    out = quadros[0]
    for df in quadros[1:]:
        out = out.merge(df, on="date", how="outer")
    out = out.sort_values("date").reset_index(drop=True)
    for coluna in SERIES.values():
        if coluna not in out.columns:
            out[coluna] = float("nan")
    return out[COLS]


def busca(start: dt.date, end: dt.date) -> dict:
    """Unico ponto que fala com a internet. Um ticker que falha nao derruba os outros."""
    try:
        import yfinance  # type: ignore
    except ImportError:
        print("[fetch_markets] yfinance nao instalado, pulando.", file=sys.stderr)
        return {}

    bruto = {}
    for ticker in SERIES:
        try:
            hist = yfinance.Ticker(ticker).history(
                start=start.isoformat(),
                end=(end + dt.timedelta(days=1)).isoformat(),
                interval="1d",
                auto_adjust=False,
            )
        except Exception as exc:  # noqa: BLE001
            print(f"[fetch_markets] ERRO {ticker}: {exc}", file=sys.stderr)
            continue
        if hist is None or hist.empty or "Close" not in hist:
            print(f"[fetch_markets] {ticker}: resposta vazia", file=sys.stderr)
            continue
        bruto[ticker] = hist["Close"].dropna()
    return bruto


def update(start=INICIO, end=None):
    end = end or _hoje_utc()

    antigo = pd.DataFrame(columns=COLS)
    if os.path.exists(CSV_PATH):
        antigo = pd.read_csv(CSV_PATH)
        antigo["date"] = pd.to_datetime(antigo["date"]).dt.date
        if len(antigo):
            # so rebusca a ponta (sobreposicao p/ revisoes); backfill usa start explicito
            ultimo = max(antigo["date"])
            start = max(start, ultimo - dt.timedelta(days=10))

    bruto = busca(start, end)
    if not bruto:
        print("[fetch_markets] nenhum dado retornado; CSV mantido.", file=sys.stderr)
        return

    novo = normaliza(bruto, agora=_agora_utc())
    if novo.empty:
        print("[fetch_markets] nada novo apos o corte da sessao em curso.")
        return

    combinado = (
        pd.concat([antigo, novo], ignore_index=True)
        .drop_duplicates(subset=["date"], keep="last")
        .sort_values("date")
    )
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    combinado.to_csv(CSV_PATH, index=False)
    cobertura = {c: int(combinado[c].notna().sum()) for c in SERIES.values()}
    print(f"[fetch_markets] {len(combinado)} datas salvas em {CSV_PATH} | {cobertura}")


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        update(dt.date.fromisoformat(sys.argv[1]), dt.date.fromisoformat(sys.argv[2]))
    else:
        update()
