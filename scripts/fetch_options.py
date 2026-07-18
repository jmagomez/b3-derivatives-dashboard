"""Volume e contratos em aberto de opcoes (IND e DOL) - Sistema Pregao B3.

Fonte: https://www2.bmf.com.br/pages/portal/bmfbovespa/lumis/lum-sistema-pregao-ptBR.asp?Data=DD/MM/AAAA&Mercadoria=XXX
Coleta best-effort: agrega volume negociado e contratos em aberto das secoes de
opcoes. Historico acumulado a partir da criacao do repositorio (o backfill
completo de opcoes exigiria dezenas de milhares de requisicoes).
"""
import io
import os
import sys
import time
import datetime as dt

import pandas as pd
import requests

URL = (
    "https://www2.bmf.com.br/pages/portal/bmfbovespa/lumis/"
    "lum-sistema-pregao-ptBR.asp"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
MERCADORIAS = ["IND", "DOL"]
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
PATH = os.path.join(DATA_DIR, "opcoes.csv")


def fetch_day(date: dt.date, mercadoria: str):
    params = {"Data": date.strftime("%d/%m/%Y"), "Mercadoria": mercadoria}
    try:
        r = requests.get(URL, params=params, headers=HEADERS, timeout=60)
        r.raise_for_status()
    except Exception as e:  # noqa: BLE001
        print(f"[fetch_options] ERRO {mercadoria} {date}: {e}", file=sys.stderr)
        return None
    html = r.content.decode("latin-1", errors="replace")
    try:
        tables = pd.read_html(io.StringIO(html), decimal=",", thousands=".")
    except ValueError:
        return None
    vol = oi = neg = 0.0
    found = False
    for t in tables:
        if hasattr(t.columns, "get_level_values"):
            cols = [str(c).upper() for c in t.columns.get_level_values(-1)]
        else:
            cols = [str(c).upper() for c in t.columns]
        joined = " ".join(cols)
        if "ABERT" in joined and ("VOL" in joined or "NEG" in joined):
            found = True
            for c, name in zip(t.columns, cols):
                serie = pd.to_numeric(t[c], errors="coerce").fillna(0)
                if "ABERT" in name:
                    oi += float(serie.sum())
                elif "VOL" in name:
                    vol += float(serie.sum())
                elif "NEGOC" in name:
                    neg += float(serie.sum())
    if not found:
        return None
    return {
        "date": date.isoformat(),
        "mercadoria": mercadoria,
        "contratos_abertos": oi,
        "volume": vol,
        "negocios": neg,
    }


def update(dates=None):
    os.makedirs(DATA_DIR, exist_ok=True)
    old = pd.read_csv(PATH) if os.path.exists(PATH) else pd.DataFrame(
        columns=["date", "mercadoria", "contratos_abertos", "volume", "negocios"]
    )
    have = set(zip(old.get("date", []), old.get("mercadoria", [])))
    if dates is None:
        today = dt.date.today()
        dates = [today - dt.timedelta(days=i) for i in range(8)]
        dates = [d for d in dates if d.weekday() < 5]
    rows = []
    for d in dates:
        for m in MERCADORIAS:
            if (d.isoformat(), m) in have:
                continue
            row = fetch_day(d, m)
            if row:
                rows.append(row)
            time.sleep(1)
    if rows:
        df = pd.concat([old, pd.DataFrame(rows)], ignore_index=True)
        df = df.drop_duplicates(subset=["date", "mercadoria"], keep="last").sort_values("date")
        df.to_csv(PATH, index=False)
    print(f"[fetch_options] {len(rows)} registro(s) novos")


if __name__ == "__main__":
    update()
