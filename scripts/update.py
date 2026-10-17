"""Atualizacao diaria: busca dados novos e, se o bitcoin ja fechou, reconstroi o site + e-mail.

Os dados coletados sempre sao gravados em data/. A regeneracao de docs/ e do
e-mail so ocorre quando publicacao.decidir() libera (fechamento do BTC do
ultimo pregao da B3 disponivel) -- ver scripts/publicacao.py. O resultado vai
para $GITHUB_OUTPUT (publicar, novo) para o workflow decidir commit/e-mail.
"""
import datetime as dt
import json
import os

import pandas as pd

import fetch_b3
import fetch_bcb
import fetch_eia
import fetch_markets
import build_site
import build_email
import publicacao


def _saida(**kv):
    for k, v in kv.items():
        print(f"[update] {k}={v}")
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as f:
            for k, v in kv.items():
                f.write(f"{k}={str(v).lower()}\n")


def _ultimo_publicado():
    try:
        with open(os.path.join(build_site.OUT, "summary.json")) as f:
            return json.load(f).get("last_date")
    except (OSError, ValueError):
        return None


if __name__ == "__main__":
    today = dt.date.today()
    anterior = _ultimo_publicado()
    # janela de seguranca de 10 dias p/ recuperar falhas anteriores
    fetch_b3.update_range(today - dt.timedelta(days=10), today)
    fetch_bcb.update()
    fetch_eia.update()
    fetch_markets.update()

    df = build_site.load_ajustes()
    ref = df["date"].max() if len(df) else None
    mk = pd.read_csv(build_site.MARKETS_CSV) if os.path.exists(build_site.MARKETS_CSV) else None
    d = publicacao.decidir(ref, mk, anterior)
    if not d["publicar"]:
        print(f"::warning::Publicacao adiada: {d['motivo']}. Dados gravados em data/; docs/ e e-mail inalterados.")
        _saida(publicar=False, novo=False)
        raise SystemExit(0)
    build_site.main()
    build_email.main()
    _saida(publicar=True, novo=d["novo"])
