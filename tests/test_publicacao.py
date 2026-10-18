"""Gate de publicacao: so publica com o fechamento consolidado do BTC do ultimo pregao."""
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import publicacao  # noqa: E402


def _mk(linhas):
    return pd.DataFrame(linhas, columns=["date", "btc"])


def test_btc_fechado_quando_ha_barra_na_data():
    assert publicacao.btc_fechado(_mk([("2026-10-14", 81562.0)]), "2026-10-14")


def test_btc_nao_fechado_quando_falta_a_barra_ou_e_nan():
    assert not publicacao.btc_fechado(_mk([("2026-10-14", 1.0)]), "2026-10-15")
    assert not publicacao.btc_fechado(_mk([("2026-10-15", float("nan"))]), "2026-10-15")
    assert not publicacao.btc_fechado(_mk([]), "2026-10-15")
    assert not publicacao.btc_fechado(None, "2026-10-15")
    assert not publicacao.btc_fechado(pd.DataFrame({"date": ["2026-10-15"]}), "2026-10-15")


def test_caso_real_15_10_bloqueia_porque_btc_so_vai_ate_14_10():
    # situacao real de 16/10/2026: BTC (Yahoo) ate 14/10, B3 ja com 15/10 (markets.csv real)
    mk = _mk([("2026-10-13", 83095.125), ("2026-10-14", 81562.4921875), ("2026-10-15", float("nan"))])
    d = publicacao.decidir("2026-10-15", mk, "2026-10-14")
    assert d["publicar"] is False and d["novo"] is False
    assert "2026-10-15" in d["motivo"]
    assert publicacao.decidir("2026-10-14", mk, "2026-10-13")["publicar"] is True


def test_novo_so_quando_pregao_ainda_nao_publicado():
    mk = _mk([("2026-10-15", 1.0)])
    assert publicacao.decidir("2026-10-15", mk, "2026-10-14") == {"publicar": True, "novo": True, "motivo": "ok"}
    assert publicacao.decidir("2026-10-15", mk, "2026-10-15")["novo"] is False  # retentativa: sem e-mail repetido


def test_sem_pregao_nao_publica():
    assert publicacao.decidir(None, _mk([("2026-10-15", 1.0)]), None)["publicar"] is False
