"""Testes de build_site.card() / ultimo_dia_util (funcoes puras, sem rede).

Fixture com fechamentos REAIS de BTC-USD extraidos de data/markets.csv em
24/08/2026: o bitcoin negocia sabado e domingo; os demais mercados (B3,
SP500, Nasdaq, Ibovespa a vista) so tem ponto em dia util. Sem o filtro de
dia util, card() pegava o ultimo ponto da serie (serie[-1]) e no fim de
semana isso vira sabado/domingo -- uma data que nenhum outro indicador do
dashboard tem -- em vez do ultimo pregao (sexta-feira, "o ultimo dia util
antes do sabado").
"""
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import build_site  # noqa: E402

# BTC-USD (Yahoo), 17 a 22/08/2026. 21/08 = sexta (ultimo dia util antes do
# sabado); 22/08 = sabado, presente so porque o bitcoin negocia 7 dias.
BTC_COM_FIM_DE_SEMANA = [
    {"date": "2026-08-17", "value": 64506.25390625},
    {"date": "2026-08-18", "value": 64680.7109375},
    {"date": "2026-08-19", "value": 69266.1875},
    {"date": "2026-08-20", "value": 73032.7578125},
    {"date": "2026-08-21", "value": 78335.1875},
    {"date": "2026-08-22", "value": 77083.4140625},
]


def test_ultimo_dia_util_descarta_fim_de_semana():
    uteis = build_site.ultimo_dia_util(BTC_COM_FIM_DE_SEMANA)
    assert uteis[-1]["date"] == "2026-08-21"
    assert all(dt.date.fromisoformat(p["date"]).weekday() < 5 for p in uteis)


def test_card_bitcoin_usa_ultimo_dia_util_nao_sabado():
    """Reproduz o bug relatado: no fim de semana o card mostrava sabado em vez
    da sexta-feira, ficando fora de sincronia com B3/SP500/Nasdaq/Ibovespa."""
    it = build_site.card("BTC", "Bitcoin", "US$", BTC_COM_FIM_DE_SEMANA)
    assert it["date"] == "2026-08-21"
    assert it["value"] == 78335.1875
    # variacao deve ser sexta vs quinta (dias uteis), nao sexta vs sabado
    assert it["prev"] == 73032.7578125
    assert it["var_pct"] == 7.26  # confere com o var_pct real do summary.json em 23/08/2026


def test_card_sem_pontos_uteis_devolve_none():
    """Se so houver pontos de fim de semana (ex.: backfill parcial), o card
    nao deve inventar uma data -- devolve None em vez de mostrar sabado."""
    fim_de_semana_apenas = [
        {"date": "2026-08-22", "value": 77083.4140625},
        {"date": "2026-08-23", "value": 76000.0},
    ]
    assert build_site.card("BTC", "Bitcoin", "US$", fim_de_semana_apenas) is None


def test_card_serie_vazia_devolve_none():
    assert build_site.card("BTC", "Bitcoin", "US$", []) is None


def test_card_series_so_dia_util_inalterada():
    """Series que ja so tem ponto em dia util (SP500, Nasdaq, Ibovespa, EIA)
    nao podem mudar de comportamento com o filtro novo."""
    serie = [
        {"date": "2026-08-20", "value": 7641.16},
        {"date": "2026-08-21", "value": 7674.37},
    ]
    it = build_site.card("SP500", "S&P 500", "pontos", serie)
    assert it["date"] == "2026-08-21"
    assert it["value"] == 7674.37
