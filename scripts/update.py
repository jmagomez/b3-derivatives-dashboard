"""Pipeline unico: busca dados novos e, se o bitcoin ja fechou, reconstroi o site + e-mail.

Uso
---
    python scripts/update.py                         # rotina diaria (daily.yml)
    python scripts/update.py --start 2020-01-01      # backfill (backfill.yml); --end opcional (hoje)

Os dados coletados sempre sao gravados em data/. No modo diario, a regeneracao de
docs/ e do e-mail so ocorre quando publicacao.decidir() libera (fechamento do BTC
do ultimo pregao da B3 disponivel) -- ver scripts/publicacao.py. No backfill (com
--start) o gate nao se aplica: o objetivo e reconstruir historico. O resultado vai
para $GITHUB_OUTPUT (publicar, novo) para o workflow decidir commit/e-mail.
"""
import argparse
import datetime as dt
import json
import os

import pandas as pd

import build_email
import build_site
import fetch_b3
import fetch_bcb
import fetch_eia
import fetch_markets
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


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--start", type=dt.date.fromisoformat, help="backfill: data inicial (YYYY-MM-DD)")
    ap.add_argument("--end", type=dt.date.fromisoformat, help="backfill: data final (padrao: hoje)")
    args = ap.parse_args(argv)

    today = dt.date.today()
    backfill = args.start is not None
    anterior = _ultimo_publicado()

    if backfill:
        end = args.end or today
        fetch_b3.update_range(args.start, end)
        fetch_bcb.update()
        fetch_eia.update(args.start, end)
        fetch_markets.update(args.start, end)
    else:
        # janela de seguranca de 10 dias p/ recuperar falhas anteriores
        fetch_b3.update_range(today - dt.timedelta(days=10), today)
        fetch_bcb.update()
        fetch_eia.update()
        fetch_markets.update()

    if not backfill:
        df = build_site.load_ajustes()
        ref = df["date"].max() if len(df) else None
        mk = pd.read_csv(build_site.MARKETS_CSV) if os.path.exists(build_site.MARKETS_CSV) else None
        d = publicacao.decidir(ref, mk, anterior)
        if not d["publicar"]:
            print(f"::warning::Publicacao adiada: {d['motivo']}. Dados gravados em data/; docs/ e e-mail inalterados.")
            _saida(publicar=False, novo=False)
            return
    else:
        d = {"novo": False}

    build_site.main()
    build_email.main()
    _saida(publicar=True, novo=d["novo"])


if __name__ == "__main__":
    main()
