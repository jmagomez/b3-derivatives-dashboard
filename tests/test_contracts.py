"""Testes das expressoes regulares de contratos da B3 (fetch_b3)."""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import fetch_b3  # noqa: E402


def test_fut_re_casa_futuros():
    assert re.match(fetch_b3.FUT_RE, "DI1F26")
    assert re.match(fetch_b3.FUT_RE, "DOLX25")
    assert re.match(fetch_b3.FUT_RE, "BGIJ26")


def test_fut_re_nao_casa_opcoes_nem_vencimento_invalido():
    assert not re.match(fetch_b3.FUT_RE, "DI1F26C1150")
    assert not re.match(fetch_b3.FUT_RE, "DI1A26")


def test_opt_re_casa_opcoes():
    assert re.match(fetch_b3.OPT_RE, "DI1F26C1150")
    assert re.match(fetch_b3.OPT_RE, "DOLX25P5800")


def test_opt_re_nao_casa_futuro_puro():
    assert not re.match(fetch_b3.OPT_RE, "DOLX25")
