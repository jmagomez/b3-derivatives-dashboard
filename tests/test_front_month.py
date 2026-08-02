"""Testes da serie do 1o vencimento (build_site.front_month_series).

O risco aqui nao e o codigo quebrar, e ele acertar o preco e errar a liquidez:
o vencimento da frente nem sempre tem contratos/volume registrados, e uma
selecao coluna a coluna traz o numero de OUTRO vencimento sem nenhum sinal.
"""
import os
import sys

import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import build_site  # noqa: E402


def linha(date, venc, ajuste, contratos=None, volume=None, codigo="DOL"):
    return {"date": date, "codigo": codigo, "vencimento": venc,
            "ajuste_atual": ajuste, "taxa": None,
            "contratos": contratos, "volume": volume}


def frame(*linhas):
    df = pd.DataFrame(list(linhas))
    df["mat"] = df["vencimento"].map(build_site.maturity)
    df["date_d"] = pd.to_datetime(df["date"]).dt.date
    return df


def test_pega_o_primeiro_vencimento():
    df = frame(linha("2026-07-30", "U26", 5100.0, 10, 1000.0),
               linha("2026-07-30", "Q26", 5000.0, 20, 2000.0))
    (p,) = build_site.front_month_series(df, "DOL")
    assert p["venc"] == "Q26"
    assert p["value"] == 5000.0
    assert p["contratos"] == 20
    assert p["volume"] == 2000.0


def test_liquidez_nao_vaza_de_outro_vencimento():
    """O 1o vencimento sem contratos registrados nao pode herdar os do 2o.

    Este e o caso real que motivou o teste: em 2026-07-30 o SJC Q26 nao tinha
    liquidez registrada e o grafico mostrava os 55 contratos do U26.
    """
    df = frame(linha("2026-07-30", "Q26", 5000.0, None, None),
               linha("2026-07-30", "U26", 5100.0, 55, 3255726.4))
    (p,) = build_site.front_month_series(df, "DOL")
    assert p["venc"] == "Q26"
    assert "contratos" not in p
    assert "volume" not in p


def test_uma_linha_por_data():
    df = frame(linha("2026-07-29", "Q26", 4990.0, 5, 500.0),
               linha("2026-07-29", "U26", 5090.0, 6, 600.0),
               linha("2026-07-30", "Q26", 5000.0, 7, 700.0))
    serie = build_site.front_month_series(df, "DOL")
    assert [p["date"] for p in serie] == ["2026-07-29", "2026-07-30"]
    assert [p["contratos"] for p in serie] == [5, 7]


def test_vencimento_vencido_e_ignorado():
    df = frame(linha("2026-07-30", "F26", 4900.0, 99, 9900.0),
               linha("2026-07-30", "Q26", 5000.0, 20, 2000.0))
    (p,) = build_site.front_month_series(df, "DOL")
    assert p["venc"] == "Q26"
    assert p["contratos"] == 20


def test_sem_preco_a_serie_fica_vazia():
    df = frame(linha("2026-07-30", "Q26", None, 20, 2000.0))
    assert build_site.front_month_series(df, "DOL") == []
