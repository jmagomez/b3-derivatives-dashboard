"""Integracao build_site.main() -> docs/data/analytics.json (sem rede).

Markets/BCB vem dos fixtures REAIS. Os ajustes da B3 sao so a fiacao minima
para o main() rodar (um DI1 e dois IND) -- os numeros deles nao sao afirmados
em nenhum teste, so a existencia/forma do resultado.
"""
import json
import os
import shutil
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import build_site  # noqa: E402

FIX = os.path.join(os.path.dirname(__file__), "fixtures")

AJUSTES = (
    "date,codigo,vencimento,ajuste_anterior,ajuste_atual,variacao,taxa,contratos,volume\n"
    "2026-10-14,IND,V26,,206739.0,,,100,1000.0\n"
    "2026-10-15,IND,Z26,,208485.0,,,100,1000.0\n"
    "2026-10-15,DI1,F28,,,,12.886,100,1000.0\n"
)


@pytest.fixture
def repo(tmp_path, monkeypatch):
    data = tmp_path / "data"
    (data / "ajustes").mkdir(parents=True)
    (data / "bcb").mkdir()
    (tmp_path / "docs" / "data").mkdir(parents=True)
    (data / "ajustes" / "2026.csv").write_text(AJUSTES)
    shutil.copy(os.path.join(FIX, "markets_real.csv"), data / "markets.csv")
    shutil.copy(os.path.join(FIX, "ptax_real.csv"), data / "bcb" / "ptax_venda.csv")
    shutil.copy(os.path.join(FIX, "cdi_real.csv"), data / "bcb" / "cdi.csv")
    shutil.copy(os.path.join(FIX, "ipca_real.csv"), data / "bcb" / "ipca.csv")
    monkeypatch.setattr(build_site, "AJUSTES_DIR", str(data / "ajustes"))
    monkeypatch.setattr(build_site, "BCB_DIR", str(data / "bcb"))
    monkeypatch.setattr(build_site, "OPCOES", str(data / "opcoes.csv"))
    monkeypatch.setattr(build_site, "EIA_CSV", str(data / "eia.csv"))
    monkeypatch.setattr(build_site, "MARKETS_CSV", str(data / "markets.csv"))
    monkeypatch.setattr(build_site, "OUT", str(tmp_path / "docs" / "data"))
    return tmp_path / "docs" / "data"


def test_main_gera_analytics_e_marca_status_ok(repo):
    build_site.main()
    summary = json.loads((repo / "summary.json").read_text())
    assert summary["analytics_status"] == {"ok": True, "erro": None}
    ana = json.loads((repo / "analytics.json").read_text())
    assert ana["as_of"] == "2026-10-15"
    assert {item["codigo"] for item in ana["linhas"]} >= {"IBOV", "IBOV_USD", "BTC_BRL", "USDBRL"}
    # a base do IND usa o Ibovespa a vista do markets.csv real
    assert ana["base_ind"]["ultimo"]["date"] == "2026-10-15"
    assert ana["base_ind"]["ultimo"]["venc"] == "Z26"


def test_falha_no_analytics_nao_derruba_o_main_e_remove_json_antigo(repo, monkeypatch):
    (repo / "analytics.json").write_text('{"antigo": true}')

    def quebra(*a, **k):
        raise RuntimeError("falha simulada")

    monkeypatch.setattr(build_site.analytics, "build", quebra)
    build_site.main()  # nao pode levantar
    summary = json.loads((repo / "summary.json").read_text())
    assert summary["analytics_status"]["ok"] is False
    assert "falha simulada" in summary["analytics_status"]["erro"]
    assert not (repo / "analytics.json").exists()
    assert (repo / "series.json").exists()  # o resto da atualizacao segue normal


def test_sem_last_date_da_b3_status_nao_ok(repo):
    status = build_site._gera_analytics({}, {}, {}, None, None)
    assert status["ok"] is False and "last_date" in status["erro"]
