"""Unidade da variacao diaria: bps para contrato cotado em taxa, % para preco.

O defeito que estes testes impedem de voltar: a mesma regra ("DI1 e FRC sao
cotados em taxa") esteve escrita em tres arquivos, com formatos diferentes, e
a apresentacao rotulava a diferenca entre duas taxas como se fosse variacao
relativa. Agora a regra mora em unidades.py e o payload carrega `var_unit`.
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import unidades as u  # noqa: E402


# --------------------------------------------------------------------------- #
# Classificacao
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("code", ["DI1", "FRC"])
def test_contratos_cotados_em_taxa_variam_em_bps(code):
    assert u.unidade_variacao(code) == u.BPS


@pytest.mark.parametrize(
    "code",
    [
        "DOL",
        "IND",
        "DDI",
        "BGI",
        "CCM",
        "ICF",
        "SJC",
        "BRENT",
        "WTI",
        "SP500",
        "NASDAQ",
        "BTC",
        "IBOV",
    ],
)
def test_contratos_cotados_em_preco_variam_em_pct(code):
    assert u.unidade_variacao(code) == u.PCT


def test_ddi_e_preco_mesmo_sendo_instrumento_de_juros():
    """A B3 cota o DDI em PU, nao em taxa -- por isso a variacao dele e relativa.

    Guard contra o engano natural de agrupar DDI com DI1/FRC por serem os tres
    da familia de juros: o que decide a unidade e COMO o contrato e cotado.
    """
    assert u.unidade_variacao("DDI") == u.PCT


def test_codigo_desconhecido_cai_em_pct():
    assert u.unidade_variacao("XYZ") == u.PCT


# --------------------------------------------------------------------------- #
# Calculo -- numeros reais do fechamento de 05/11/2026
# --------------------------------------------------------------------------- #
def test_di_usa_diferenca_e_nao_variacao_relativa():
    """DI 14,328 -> 14,212. Diferenca = -11,6 bps; relativo seria -0,81%.

    Sao perguntas diferentes e numeros diferentes. Exibir -0,12% afirmaria que
    a taxa caiu 0,12% do seu valor, o que e falso.
    """
    assert u.variacao("DI1", 14.212, 14.328) == -11.6
    relativo = round((14.212 / 14.328 - 1) * 100, 2)
    assert relativo == -0.81
    assert u.variacao("DI1", 14.212, 14.328) != relativo


def test_frc_um_ponto_base():
    assert u.variacao("FRC", 5.81, 5.80) == 1.0


def test_preco_usa_variacao_relativa():
    assert u.variacao("DOL", 5519.234, 5489.585) == 0.54
    assert u.variacao("BTC", 75942.125, 80405.289) == -5.55


def test_bps_preserva_a_terceira_casa_do_ajuste():
    """O ajuste do DI tem 3 decimais: 0,001 p.p. = 0,1 bp e e significativo."""
    assert u.variacao("DI1", 14.213, 14.212) == 0.1


def test_sem_comparacao_devolve_none_e_nao_zero():
    """Zero diria 'nao mudou'; o correto e 'nao sei'."""
    assert u.variacao("DI1", 14.2, None) is None
    assert u.variacao("DOL", None, 5.0) is None
    assert u.variacao("DOL", 5.0, 0) is None


def test_taxa_zero_no_anterior_ainda_calcula():
    """Para taxa a conta e subtracao: anterior zero nao e divisao por zero."""
    assert u.variacao("DI1", 0.25, 0.0) == 25.0


# --------------------------------------------------------------------------- #
# Formatacao
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    "valor,unidade,esperado",
    [
        (-11.6, u.BPS, "-11,6 bps"),
        (1.0, u.BPS, "+1 bp"),  # singular, e sem decimal inutil
        (-1.0, u.BPS, "-1 bp"),
        (12.0, u.BPS, "+12 bps"),
        # Separador de milhar: sem ele o Python divergia do Intl.NumberFormat
        # ('pt-BR') do front. Pego por teste de paridade, nao por inspecao.
        (1234.5, u.BPS, "+1.234,5 bps"),
        (-12345.67, u.PCT, "-12.345,67%"),
        (0.54, u.PCT, "+0,54%"),
        (-5.55, u.PCT, "-5,55%"),
        (None, u.PCT, "—"),
        (None, u.BPS, "—"),
    ],
)
def test_formata(valor, unidade, esperado):
    assert u.formata(valor, unidade) == esperado


# --------------------------------------------------------------------------- #
# Contrato publicado
# --------------------------------------------------------------------------- #
def test_summary_publicado_traz_var_unit_coerente_em_todo_item():
    """Guard de integracao contra o arquivo que o site realmente consome."""
    caminho = os.path.join(os.path.dirname(__file__), "..", "docs", "data", "summary.json")
    if not os.path.exists(caminho):
        pytest.skip("summary.json ainda nao gerado")
    with open(caminho) as f:
        s = json.load(f)
    assert s["items"], "summary sem itens"
    for it in s["items"]:
        assert "var_unit" in it, f"{it['code']} sem var_unit"
        assert it["var_unit"] in (u.BPS, u.PCT)
        assert it["var_unit"] == u.unidade_variacao(it["code"])
        assert "var_pct" not in it, f"{it['code']} ainda expoe var_pct"
        assert "variation" in it
