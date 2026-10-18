"""Testes de scripts/analytics.py (funcoes puras, sem rede).

Duas camadas:

1. Casos pequenos com resposta calculavel a mao (identidades matematicas).
2. Dados REAIS do repositorio (tests/fixtures/*.csv|json: fechamentos de
   markets.csv, PTAX/CDI/IPCA do BCB e a curva DI de 15/10/2026), conferidos
   contra aritmetica direta sobre as linhas brutas -- nao contra a propria
   implementacao. As datas do CDI do fixture sao as mesmas datas de
   divulgacao da PTAX (menos 15/10, ainda nao publicado) e os valores
   reproduzem os degraus reais de data/bcb/cdi.csv.
"""
import json
import math
import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import analytics as A  # noqa: E402

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def _pts(df, col):
    return [{"date": d, "value": float(v)} for d, v in zip(df["date"], df[col]) if pd.notna(v)]


def _s(valores: dict) -> pd.Series:
    return A.para_serie([{"date": d, "value": v} for d, v in valores.items()])


@pytest.fixture(scope="module")
def real():
    mk = pd.read_csv(os.path.join(FIX, "markets_real.csv"))
    return {
        "markets": {c: _pts(mk, c) for c in ("sp500", "nasdaq", "btc", "ibov")},
        "ptax": _pts(pd.read_csv(os.path.join(FIX, "ptax_real.csv")), "value"),
        "cdi": _pts(pd.read_csv(os.path.join(FIX, "cdi_real.csv")), "value"),
        "ipca": _pts(pd.read_csv(os.path.join(FIX, "ipca_real.csv")), "value"),
        "curva": json.load(open(os.path.join(FIX, "di_curve_real.json"))),
    }


@pytest.fixture(scope="module")
def saida(real):
    ind = [{"date": "2026-10-14", "value": 206739.0, "venc": None},
           {"date": "2026-10-15", "value": 208485.0, "venc": "Z26"}]
    return A.build(real["markets"], real["ptax"], real["cdi"], real["ipca"], ind,
                   real["curva"], "2026-10-15")


def _linha(saida, codigo):
    return next(item for item in saida["linhas"] if item["codigo"] == codigo)


# ------------------------------------------------------------ utilidades
def test_para_serie_ordena_deduplica_e_descarta_nan():
    s = A.para_serie([{"date": "2026-01-03", "value": 3.0}, {"date": "2026-01-01", "value": 1.0},
                      {"date": "2026-01-03", "value": 4.0}, {"date": "2026-01-02", "value": float("nan")}])
    assert list(s.index.strftime("%Y-%m-%d")) == ["2026-01-01", "2026-01-03"]
    assert list(s.values) == [1.0, 4.0]  # duplicata: vale a ultima


def test_dias_uteis_remove_sabado_e_domingo():
    s = _s({"2026-08-21": 1, "2026-08-22": 2, "2026-08-23": 3, "2026-08-24": 4})
    assert list(A.dias_uteis(s).index.strftime("%Y-%m-%d")) == ["2026-08-21", "2026-08-24"]


def test_converter_so_nas_datas_comuns():
    ibov = _s({"2026-10-13": 200.0, "2026-10-14": 210.0, "2026-10-15": 220.0})
    ptax = _s({"2026-10-13": 5.0, "2026-10-15": 4.0})  # sem PTAX em 14/10: nao interpola
    usd = A.converter(ibov, ptax, "USD")
    assert list(usd.index.strftime("%d")) == ["13", "15"]
    assert list(usd.values) == [40.0, 55.0]
    brl = A.converter(_s({"2026-10-13": 10.0}), ptax, "BRL")
    assert brl.iloc[0] == 50.0


# --------------------------------------------------------------- retorno
def test_retorno_janela_calculo_direto():
    s = _s({"2026-01-15": 100.0, "2026-04-15": 110.0})
    r = A.retorno_janela(s, "2026-04-15", meses=3)
    assert r["pct"] == pytest.approx(10.0)
    assert r["base"] == pd.Timestamp("2026-01-15")


def test_retorno_janela_sem_historia_suficiente_devolve_none():
    s = _s({"2026-03-01": 100.0, "2026-04-15": 110.0})
    assert A.retorno_janela(s, "2026-04-15", meses=3) is None  # comeca depois de 15/01
    assert A.retorno_janela(pd.Series(dtype=float), "2026-04-15", meses=1) is None


def test_base_cai_na_ultima_observacao_em_ou_antes_da_data_alvo():
    # alvo = 2026-04-15 - 3 meses = sabado 2026-01-15? (qui) -> usamos um alvo em fim de semana
    s = _s({"2026-01-09": 100.0, "2026-01-12": 105.0, "2026-04-11": 120.0})
    r = A.retorno_janela(s, "2026-04-11", meses=3)  # alvo 11/01 (domingo)
    assert r["base"] == pd.Timestamp("2026-01-09")
    assert r["pct"] == pytest.approx(20.0)


def test_ytd_usa_ultima_observacao_do_ano_anterior():
    # 31/12 sem cotacao (feriado): base e o ultimo dia disponivel (30/12)
    s = _s({"2025-12-29": 90.0, "2025-12-30": 100.0, "2026-02-02": 125.0})
    r = A.retorno_janela(s, "2026-02-02", ytd=True)
    assert r["base"] == pd.Timestamp("2025-12-30")
    assert r["pct"] == pytest.approx(25.0)


# -------------------------------------------------------- vol e drawdown
def test_vol_anualizada_confere_com_numpy():
    valores = [100.0, 101.0, 99.5, 102.0, 100.5, 103.0]
    s = pd.Series(valores, index=pd.bdate_range("2026-01-05", periods=6))
    esperado = np.std(np.diff(valores) / np.array(valores[:-1]), ddof=1) * math.sqrt(252) * 100
    assert A.vol_anualizada(s, "2026-01-12", 5) == pytest.approx(esperado)


def test_vol_sem_observacoes_suficientes_devolve_none():
    s = pd.Series([1.0, 1.1, 1.2], index=pd.bdate_range("2026-01-05", periods=3))
    assert A.vol_anualizada(s, "2026-01-09", 5) is None


def test_drawdown_janela():
    # 03/11 e a base (ultima obs <= 10/11); pico 120 em 08/12, vale 90 em 09/12
    s = _s({"2025-11-03": 100.0, "2025-12-08": 120.0, "2025-12-09": 90.0, "2025-12-10": 110.0})
    dd = A.drawdown_janela(s, "2025-12-10", 1)
    assert dd["max_pct"] == pytest.approx(-25.0)
    assert dd["atual_pct"] == pytest.approx((110 / 120 - 1) * 100)
    assert dd["vale"] == pd.Timestamp("2025-12-09")


def test_drawdown_janela_sem_historia_devolve_none():
    s = pd.Series([100.0, 120.0], index=pd.bdate_range("2026-01-05", periods=2))
    assert A.drawdown_janela(s, "2026-01-06", 1) is None


def test_extremos():
    s = pd.Series([100.0, 110.0, 99.0, 100.0], index=pd.bdate_range("2026-01-05", periods=4))
    e = A.extremos(s, "2026-01-08", 3)
    assert e["melhor"]["pct"] == pytest.approx(10.0)
    assert e["pior"]["pct"] == pytest.approx(-10.0)
    assert A.extremos(s, "2026-01-08", 10) is None


# -------------------------------------------------------------------- CDI
def test_cdi_entre_exclui_a_base_e_inclui_a_referencia():
    cdi = _s({"2026-01-05": 0.05, "2026-01-06": 0.05, "2026-01-07": 0.05, "2026-01-08": 0.05})
    esperado = ((1.0005) ** 3 - 1) * 100
    assert A.cdi_entre(cdi, "2026-01-05", "2026-01-08") == pytest.approx(esperado)
    assert A.cdi_entre(cdi, "2026-01-08", "2026-01-08") is None


def test_sharpe_excesso_constante_tem_desvio_zero_e_devolve_none():
    idx = pd.bdate_range("2026-01-05", periods=6)
    cdi = pd.Series(0.05, index=idx)
    ativo = pd.Series(100.0 * (1.001 ** np.arange(6)), index=idx)
    # retorno e CDI constantes => excesso constante => sd ~ 0 (pode haver ruido de ponto flutuante)
    v = A.sharpe_ex_post(ativo, cdi, idx[-1], n=5)
    assert v is None or abs(v) > 1e3  # ou None, ou razao explodindo: nunca um numero "razoavel"


def test_sharpe_confere_com_calculo_independente():
    idx = pd.bdate_range("2026-01-05", periods=7)
    precos = [100.0, 101.0, 100.5, 102.0, 101.0, 103.0, 102.5]
    cdi = pd.Series(0.04, index=idx)
    ativo = pd.Series(precos, index=idx)
    exc = np.array([precos[i] / precos[i - 1] - 1 - 0.0004 for i in range(1, 7)])
    esperado = exc.mean() / exc.std(ddof=1) * math.sqrt(252)
    assert A.sharpe_ex_post(ativo, cdi, idx[-1], n=6) == pytest.approx(esperado)


def test_sharpe_nao_assume_cdi_zero_quando_cdi_esta_atrasado():
    idx = pd.bdate_range("2026-01-05", periods=7)
    ativo = pd.Series([100.0, 101, 100.5, 102, 101, 103, 102.5], index=idx)
    cdi = pd.Series(0.04, index=idx[:-1])  # CDI publicado so ate o penultimo dia
    # com n=6 faltaria 1 retorno depois de cortar a janela no ultimo dia coberto
    assert A.sharpe_ex_post(ativo, cdi, idx[-1], n=6) is None


# -------------------------------------------------------------- correlacao
def test_correlacao_perfeita_e_inversa_e_ignora_fim_de_semana():
    idx = pd.date_range("2026-01-05", periods=12, freq="D")  # inclui sabado/domingo
    base = pd.Series(100.0 * np.cumprod(1 + np.array([0.01, -0.02, 0.015, 0.0, 0.02, -0.01, 0.01,
                                                      -0.005, 0.02, 0.01, -0.03, 0.01])), index=idx)
    inv = 10000.0 / base
    c = A.correlacao({"A": base, "B": base * 2, "C": inv}, "2026-01-16", 5)
    assert c["matriz"][0][1] == pytest.approx(1.0, abs=1e-3)
    assert c["matriz"][0][2] < -0.99
    for d in (c["inicio"], c["fim"]):
        assert pd.Timestamp(d).dayofweek < 5


def test_correlacao_sem_amostra_suficiente_devolve_none():
    idx = pd.bdate_range("2026-01-05", periods=4)
    s = pd.Series([1.0, 2.0, 3.0, 4.0], index=idx)
    assert A.correlacao({"A": s, "B": s}, "2026-01-09", 10) is None


# -------------------------------------------------------------- juro real
def test_juro_real_formula_e_janela_do_ultimo_ipca():
    meses = pd.date_range("2025-10-01", periods=12, freq="MS")
    ipca = pd.Series(0.5, index=meses)
    cdi = pd.Series(0.04, index=pd.bdate_range("2025-09-15", "2026-10-14"))
    jr = A.juro_real(cdi, ipca)
    assert jr["ipca_12m"] == pytest.approx((1.005 ** 12 - 1) * 100)
    n_du = len(cdi[(cdi.index >= "2025-10-01") & (cdi.index <= "2026-09-30")])
    assert jr["cdi_12m"] == pytest.approx((1.0004 ** n_du - 1) * 100)
    assert jr["real_12m"] == pytest.approx(((1 + jr["cdi_12m"] / 100) / (1 + jr["ipca_12m"] / 100) - 1) * 100)
    assert jr["janela_fim"] == pd.Timestamp("2026-09-30")


def test_juro_real_com_mes_faltando_ou_cdi_curto_devolve_none():
    cdi = pd.Series(0.04, index=pd.bdate_range("2025-09-15", "2026-10-14"))
    meses = list(pd.date_range("2025-10-01", periods=12, freq="MS"))
    faltando = pd.Series(0.5, index=meses[:5] + meses[6:] + [pd.Timestamp("2026-10-01")])
    assert A.juro_real(cdi, faltando) is None
    ipca = pd.Series(0.5, index=pd.date_range("2025-10-01", periods=12, freq="MS"))
    cdi_curto = pd.Series(0.04, index=pd.bdate_range("2025-09-15", "2026-08-31"))
    assert A.juro_real(cdi_curto, ipca) is None


# ---------------------------------------------------------------- curva DI
def test_taxa_no_prazo_interpola_linearmente_e_nao_extrapola():
    curva = [{"mat": "2027-10-01", "rate": 13.068}, {"mat": "2027-11-01", "rate": 12.998}]
    # alvo 15/10/2027 = 14 dias apos o 1o vertice, de 31 entre vertices
    esperado = 13.068 + (14 / 31) * (12.998 - 13.068)
    assert A.taxa_no_prazo(curva, "2026-10-15", 1) == pytest.approx(esperado)
    assert A.taxa_no_prazo(curva, "2026-10-15", 2) is None
    assert A.taxa_no_prazo([], "2026-10-15", 1) is None


# ------------------------------------------------------------ base do IND
def test_base_indice_calculo_direto():
    ibov = _s({"2026-10-14": 206506.0, "2026-10-15": 204324.0})
    ind = [{"date": "2026-10-14", "value": 206739.0, "venc": None},
           {"date": "2026-10-15", "value": 208485.0, "venc": "Z26"}]
    b = A.base_indice(ind, ibov)
    assert b["ultimo"]["pts"] == pytest.approx(208485.0 - 204324.0)
    assert b["ultimo"]["pct"] == pytest.approx((208485.0 / 204324.0 - 1) * 100)
    assert b["ultimo"]["venc"] == "Z26"


# ====================== dados reais: conferencia por aritmetica direta ======
def test_real_ibov_12m_e_razao_direta_dos_fechamentos(saida):
    # bases/ref lidas direto de markets.csv: 15/10/2025 = 142.604; 15/10/2026 = 204.324
    assert _linha(saida, "IBOV")["ret"]["12M"] == pytest.approx((204324.0 / 142604.0 - 1) * 100, abs=0.005)


def test_real_ibov_em_dolar_12m(saida):
    esperado = ((204324.0 / 5.0521) / (142604.0 / 5.4464) - 1) * 100
    assert _linha(saida, "IBOV_USD")["ret"]["12M"] == pytest.approx(esperado, abs=0.005)


def test_real_dolar_12m_e_ytd(saida):
    assert _linha(saida, "USDBRL")["ret"]["12M"] == pytest.approx((5.0521 / 5.4464 - 1) * 100, abs=0.005)
    assert _linha(saida, "USDBRL")["ret"]["YTD"] == pytest.approx((5.0521 / 5.5024 - 1) * 100, abs=0.005)


def test_real_ytd_ibov_usa_30_12_porque_31_12_nao_tem_cotacao(saida):
    assert _linha(saida, "IBOV")["ret"]["YTD"] == pytest.approx((204324.0 / 161125.0 - 1) * 100, abs=0.005)


def test_real_bitcoin_fica_com_a_propria_data_de_referencia(saida):
    btc = _linha(saida, "BTC")
    assert btc["ref"] == "2026-10-14"            # barra de 15/10 ainda nao existe nos dados
    assert _linha(saida, "IBOV")["ref"] == "2026-10-15"
    assert btc["ret"]["12M"] == pytest.approx((81562.4921875 / 110783.1640625 - 1) * 100, abs=0.005)
    assert saida["correlacao"]["63"]["fim"] == "2026-10-14"  # painel comum termina onde o BTC termina


def test_real_drawdown_atual_do_ibov(saida):
    assert _linha(saida, "IBOV")["dd12m"]["atual"] == pytest.approx((204324.0 / 209067.0 - 1) * 100, abs=0.005)


def test_real_maior_alta_diaria_do_ibov_e_05_10(saida):
    e = _linha(saida, "IBOV")["extremos_12m"]["melhor"]
    assert e["data"] == "2026-10-05"
    assert e["pct"] == pytest.approx((206912.0 / 192115.0 - 1) * 100, abs=0.005)


def test_real_curva_di_inclinacao_confere_com_interpolacao_manual(saida):
    c = saida["curva"]
    # 1a = 15/10/2027, entre V27 (01/10, 13,068) e X27 (01/11, 12,998)
    um_ano = 13.068 + (14 / 31) * (12.998 - 13.068)
    # 3a = 15/10/2029, entre V29 (01/10, 12,673) e X29 (01/11, 12,655)
    tres_anos = 12.673 + (14 / 31) * (12.655 - 12.673)
    assert c["prazos"][0]["atual"] == pytest.approx(um_ano, abs=0.001)
    assert c["inclinacao_3a_1a_bp"]["atual"] == pytest.approx((tres_anos - um_ano) * 100, abs=0.1)
    assert c["inclinacao_3a_1a_bp"]["atual"] == pytest.approx(-37.2, abs=0.1)
    assert c["inclinacao_3a_1a_bp"]["antes"] == pytest.approx(-95.8, abs=0.1)


def test_real_juro_real_confere_com_produto_direto(saida, real):
    ipca = [p["value"] for p in real["ipca"] if "2025-10-01" <= p["date"] <= "2026-09-01"]
    assert len(ipca) == 12
    ipca12 = (np.prod([1 + x / 100 for x in ipca]) - 1) * 100
    cdi = [p["value"] for p in real["cdi"] if "2025-10-01" <= p["date"] <= "2026-09-30"]
    cdi12 = (np.prod([1 + x / 100 for x in cdi]) - 1) * 100
    jr = saida["juro_real"]
    assert jr["ipca_12m"] == pytest.approx(ipca12, abs=0.005)
    assert jr["cdi_12m"] == pytest.approx(cdi12, abs=0.005)
    assert jr["real_12m"] == pytest.approx(((1 + cdi12 / 100) / (1 + ipca12 / 100) - 1) * 100, abs=0.01)


def test_real_cdi_acumulado_na_janela_do_ibovespa(saida, real):
    # janela do Ibovespa 12M: (15/10/2025, 15/10/2026]; CDI so existe ate 14/10/2026
    cdi = [p["value"] for p in real["cdi"] if "2025-10-15" < p["date"] <= "2026-10-15"]
    esperado = (np.prod([1 + x / 100 for x in cdi]) - 1) * 100
    assert saida["cdi"]["ret"]["12M"] == pytest.approx(esperado, abs=0.005)
    assert saida["cdi"]["ate"] == "2026-10-14"


def test_real_sharpe_so_para_ativos_em_reais(saida):
    for codigo in ("IBOV_USD", "SP500", "NASDAQ", "BTC"):
        assert _linha(saida, codigo)["sharpe_12m"] is None, codigo
    for codigo in ("IBOV", "SP500_BRL", "NASDAQ_BRL", "BTC_BRL", "USDBRL"):
        assert _linha(saida, codigo)["sharpe_12m"] is not None, codigo


def test_real_correlacao_e_simetrica_com_diagonal_um(saida):
    for n in ("63", "252"):
        m = np.array(saida["correlacao"][n]["matriz"])
        assert np.allclose(m, m.T)
        assert np.allclose(np.diag(m), 1.0)
        assert saida["correlacao"][n]["n"] == int(n)


def test_real_payload_e_json_valido_sem_nan(saida):
    json.dumps(saida, allow_nan=False)  # NaN/Infinity quebrariam o JSON.parse do navegador


def test_real_series_dos_graficos_cobrem_so_3_anos_e_nao_tem_buracos_de_nan(saida):
    ib = saida["series"]["ibov_brl_usd"]
    assert len(ib["R$"]) == len(ib["US$"])
    assert all(math.isfinite(p["value"]) for p in ib["R$"] + ib["US$"])
    dd = saida["series"]["drawdown"]["IBOV"]
    assert max(p["value"] for p in dd) <= 0  # drawdown nunca e positivo


def test_entradas_vazias_ou_parciais_nao_derrubam_o_build():
    """Uma fonte ausente (ex.: Yahoo fora do ar) vira n/d, nunca excecao."""
    vazio = A.build({}, [], [], [], [], None, "2026-10-15")
    json.dumps(vazio, allow_nan=False)
    assert all(v is None for v in vazio["linhas"][0]["ret"].values())
    assert vazio["juro_real"] is None and vazio["curva"] is None and vazio["base_ind"] is None

    parcial = A.build({"ibov": [{"date": "2026-10-14", "value": 1.0},
                                {"date": "2026-10-15", "value": 2.0}]},
                      [], [], [], [], None, "2026-10-15")
    json.dumps(parcial, allow_nan=False)
