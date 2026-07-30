"""Testes de fetch_markets.normaliza (funcao pura, sem rede).

Os valores da fixture sao fechamentos REAIS do Yahoo Finance, conferidos contra
noticiario independente: em 28/07/2026 o S&P 500 fechou em 7.428,78 (+0,21%) e o
Nasdaq Composite em 24.876,91 (-0,22%).
"""
import datetime as dt
import os
import sys

import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import fetch_markets  # noqa: E402

# 29/07/2026 e o dia corrente: para os indices e um fechamento (a sessao encerra
# 20:00/21:00 UTC), para o BTC e uma barra ainda em formacao (fecha 00:00 UTC).
GSPC = {"2026-07-24": 7411.98, "2026-07-27": 7413.18, "2026-07-28": 7428.78, "2026-07-29": 7316.15}
IXIC = {"2026-07-24": 24975.82, "2026-07-27": 24932.08, "2026-07-28": 24876.91, "2026-07-29": 24442.94}
BTC = {"2026-07-25": 64311.81, "2026-07-26": 65340.30, "2026-07-27": 63724.90, "2026-07-28": 63871.36}
BVSP = {"2026-07-24": 174042.0, "2026-07-27": 175335.0, "2026-07-28": 176565.0}

# Os dois horarios que importam, ambos em 29/07/2026 (quarta):
#   23:00 UTC = 20h BRT, horario da rotina diaria. Indices de 29/07 ja fecharam,
#               barra do BTC de 29/07 ainda nao.
#   02:00 UTC = madrugada; nada do dia 29 fechou ainda.
AS_20H_BRT = dt.datetime(2026, 7, 29, 23, 0, tzinfo=dt.timezone.utc)
AS_02H_UTC = dt.datetime(2026, 7, 29, 2, 0, tzinfo=dt.timezone.utc)


def _serie(d):
    return pd.Series(list(d.values()), index=pd.to_datetime(list(d.keys())))


@pytest.fixture
def bruto():
    return {"^GSPC": _serie(GSPC), "^IXIC": _serie(IXIC),
            "BTC-USD": _serie(BTC), "^BVSP": _serie(BVSP)}


def test_btc_do_dia_corrente_nunca_entra(bruto):
    """A barra diaria do BTC so fecha a 00:00 UTC do dia seguinte."""
    for agora in (AS_02H_UTC, AS_20H_BRT):
        df = fetch_markets.normaliza(bruto, agora=agora).set_index("date")
        assert dt.date(2026, 7, 29) not in df.index or pd.isna(df.loc[dt.date(2026, 7, 29), "btc"])


def test_as_20h_brt_o_fechamento_do_dia_dos_indices_entra(bruto):
    """NY fecha 20:00/21:00 UTC e a B3 21:00 UTC: as 23:00 UTC ja sao definitivos.

    A regra ingenua (data < hoje UTC) jogaria fora o fechamento do proprio dia e
    deixaria as series um dia atrasadas.
    """
    df = fetch_markets.normaliza(bruto, agora=AS_20H_BRT).set_index("date")
    hoje = dt.date(2026, 7, 29)
    assert df.loc[hoje, "sp500"] == pytest.approx(7316.15)
    assert df.loc[hoje, "nasdaq"] == pytest.approx(24442.94)


def test_de_madrugada_nada_do_dia_entra(bruto):
    """As 02:00 UTC a sessao de 29/07 nem comecou: so vale ate 28/07."""
    df = fetch_markets.normaliza(bruto, agora=AS_02H_UTC)
    assert df["date"].max() == dt.date(2026, 7, 28)


def test_barra_fechada_por_ativo():
    d = dt.date(2026, 7, 29)
    as_2130 = dt.datetime(2026, 7, 29, 21, 30, tzinfo=dt.timezone.utc)
    as_2129 = dt.datetime(2026, 7, 29, 21, 29, tzinfo=dt.timezone.utc)
    assert fetch_markets.barra_fechada("^GSPC", d, as_2130)
    assert not fetch_markets.barra_fechada("^GSPC", d, as_2129)
    assert not fetch_markets.barra_fechada("BTC-USD", d, as_2130)
    assert fetch_markets.barra_fechada("BTC-USD", d, dt.datetime(2026, 7, 30, 0, 0, tzinfo=dt.timezone.utc))


def test_preserva_fechamentos_conferidos(bruto):
    df = fetch_markets.normaliza(bruto, agora=AS_02H_UTC).set_index("date")
    d = dt.date(2026, 7, 28)
    assert df.loc[d, "sp500"] == pytest.approx(7428.78)
    assert df.loc[d, "nasdaq"] == pytest.approx(24876.91)
    assert df.loc[d, "btc"] == pytest.approx(63871.36)
    assert df.loc[d, "ibov"] == pytest.approx(176565.0)


def test_btc_tem_fim_de_semana_e_indices_nao(bruto):
    """BTC negocia 7 dias; indices nao. O merge externo deve preservar os dois."""
    df = fetch_markets.normaliza(bruto, agora=AS_02H_UTC).set_index("date")
    sabado = dt.date(2026, 7, 25)
    assert df.loc[sabado, "btc"] == pytest.approx(64311.81)
    assert pd.isna(df.loc[sabado, "sp500"]), "indice nao deve ter valor em dia sem sessao"


def test_variacao_diaria_confere_com_noticiario(bruto):
    df = fetch_markets.normaliza(bruto, agora=AS_02H_UTC).set_index("date")
    d27, d28 = dt.date(2026, 7, 27), dt.date(2026, 7, 28)
    var_sp = (df.loc[d28, "sp500"] / df.loc[d27, "sp500"] - 1) * 100
    var_nq = (df.loc[d28, "nasdaq"] / df.loc[d27, "nasdaq"] - 1) * 100
    assert var_sp == pytest.approx(0.21, abs=0.01)
    assert var_nq == pytest.approx(-0.22, abs=0.01)


def test_colunas_e_ordem_estaveis(bruto):
    df = fetch_markets.normaliza(bruto, agora=AS_02H_UTC)
    assert list(df.columns) == fetch_markets.COLS
    assert df["date"].is_monotonic_increasing


def test_ticker_ausente_nao_derruba_os_outros(bruto):
    del bruto["^IXIC"]
    df = fetch_markets.normaliza(bruto, agora=AS_02H_UTC)
    assert "nasdaq" in df.columns and df["nasdaq"].isna().all()
    assert df["sp500"].notna().any()


def test_entrada_vazia_devolve_quadro_vazio():
    df = fetch_markets.normaliza({}, agora=AS_02H_UTC)
    assert df.empty and list(df.columns) == fetch_markets.COLS
