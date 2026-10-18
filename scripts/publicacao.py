"""Decide se o dashboard pode ser publicado hoje.

Regra (definida pelo dono do repositorio): so fechamentos consolidados entram
no dashboard, e a publicacao espera o fechamento do bitcoin. Se a barra diaria
do BTC do ultimo pregao da B3 ainda nao existe em data/markets.csv, os dados
coletados sao guardados (data/), mas docs/ e o e-mail NAO sao regenerados --
o dashboard continua mostrando o ultimo conjunto completo. Nada e estimado
nem preenchido com valor intradiario.
"""
import pandas as pd


def btc_fechado(markets: pd.DataFrame, ref_date: str) -> bool:
    """True se existe cotacao consolidada do BTC na data `ref_date` (ISO)."""
    if markets is None or markets.empty or "btc" not in markets.columns:
        return False
    d = pd.to_datetime(markets["date"]).dt.strftime("%Y-%m-%d")
    return bool(markets.loc[(d == ref_date) & markets["btc"].notna()].shape[0])


def decidir(ref_date, markets: pd.DataFrame, ultimo_publicado) -> dict:
    """{publicar, novo, motivo}. `novo` = ha pregao ainda nao publicado
    (so ele dispara o e-mail; reexecucoes de tentativa nao reenviam)."""
    if not ref_date:
        return {"publicar": False, "novo": False, "motivo": "sem pregao da B3 nos dados"}
    if not btc_fechado(markets, ref_date):
        return {"publicar": False, "novo": False,
                "motivo": f"fechamento do bitcoin de {ref_date} ainda nao disponivel"}
    return {"publicar": True, "novo": ref_date != ultimo_publicado, "motivo": "ok"}
