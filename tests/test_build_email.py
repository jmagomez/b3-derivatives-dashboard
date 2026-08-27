"""Testes de build_email.py (funcoes puras, sem rede/disco).

Antes desta bateria de testes, build_email.py nao tinha NENHUMA cobertura --
inclusive a logica de aviso de defasagem (fmt, fmt_date, mensagens_atraso) que
foi alterada nesta mesma sessao para rastrear "btc" separado de "markets"
(ver scripts/build_site.py e tests/test_card_dia_util.py). mensagens_atraso()
foi extraida de main() especificamente para poder ser testada sem tocar em
disco (main() le e escreve arquivo).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import build_email  # noqa: E402


def test_fmt_none_vira_traco():
    assert build_email.fmt(None) == "-"


def test_fmt_usa_separador_decimal_brasileiro():
    assert build_email.fmt(1234.5) == "1.234,50"
    assert build_email.fmt(-7.1) == "-7,10"


def test_fmt_date_converte_iso_para_br():
    assert build_email.fmt_date("2026-08-21") == "21/08/2026"
    assert build_email.fmt_date("2026-08-21T10:00:00") == "21/08/2026"


def test_fmt_date_vazio_vira_traco():
    assert build_email.fmt_date(None) == "-"
    assert build_email.fmt_date("") == "-"


def test_sem_fonte_defasada_nao_gera_aviso():
    frescor = {"b3": {"last_date": "2026-08-21", "dias": 1}}
    assert build_email.mensagens_atraso(frescor) == []


def test_btc_defasado_sozinho_gera_aviso():
    """Caso real desta sessao: markets (SP500) em dia, btc atrasado -- precisa
    acusar mesmo com as outras fontes do Yahoo saudaveis (por isso btc e
    rastreado a parte de markets em scripts/build_site.py)."""
    frescor = {
        "markets": {"last_date": "2026-08-21", "dias": 0},
        "btc": {"last_date": "2026-08-16", "dias": 5},
    }
    msgs = build_email.mensagens_atraso(frescor)
    assert len(msgs) == 1
    assert "Bitcoin (Yahoo)" in msgs[0]
    assert "16/08/2026" in msgs[0]
    assert "5 dias" in msgs[0]


def test_fonte_desconhecida_usa_limite_padrao_de_7_dias():
    acima_do_padrao = {"nova_fonte": {"last_date": "2026-08-10", "dias": 8}}
    assert len(build_email.mensagens_atraso(acima_do_padrao)) == 1

    dentro_do_padrao = {"nova_fonte": {"last_date": "2026-08-15", "dias": 6}}
    assert build_email.mensagens_atraso(dentro_do_padrao) == []


def test_dias_none_nao_gera_aviso_nem_quebra():
    """dias pode vir None (data mal formada); deve ser ignorado, nao contado
    como defasado."""
    frescor = {"b3": {"last_date": None, "dias": None}}
    assert build_email.mensagens_atraso(frescor) == []


def test_ordem_alfabetica_por_chave_da_fonte():
    frescor = {
        "markets": {"last_date": "2026-08-01", "dias": 20},
        "btc": {"last_date": "2026-08-01", "dias": 20},
        "eia": {"last_date": "2026-08-01", "dias": 20},
    }
    msgs = build_email.mensagens_atraso(frescor)
    assert len(msgs) == 3
    assert "Bitcoin" in msgs[0]
    assert "petroleo" in msgs[1]
    assert "S&P 500" in msgs[2]


def test_frescor_vazio_nao_gera_aviso():
    assert build_email.mensagens_atraso({}) == []
