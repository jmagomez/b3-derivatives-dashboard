"""Precos EIA (gratuito, requer EIA_API_KEY): Brent Dated, WTI Spot e produtos
(gasolina, diesel/heating oil, jet fuel) usados para os crack spreads.

Fonte: https://api.eia.gov/v2/petroleum/pri/spt/data/
Nao ha fonte gratuita para a curva de futuros ICE Brent/CME WTI (paginas de
settlement sao protegidas por anti-bot e exigem assinatura) - por isso
usamos apenas os precos a vista (spot).
"""
import os
import sys
import time
import datetime as dt

import pandas as pd
import requests

API_KEY = os.environ.get("EIA_API_KEY", "")
BASE = "https://api.eia.gov/v2/petroleum/pri/spt/data/"

# codigo da serie EIA -> nome da coluna no CSV
SERIES = {
    "RBRTE": "brent",                       # Europe Brent Spot Price FOB ($/bbl)
    "RWTC": "wti",                          # Cushing OK WTI Spot Price FOB ($/bbl)
    "EER_EPMRU_PF4_Y35NY_DPG": "gasoline",  # NY Harbor Conventional Gasoline Regular ($/gal)
    "EER_EPD2F_PF4_Y35NY_DPG": "diesel",    # NY Harbor No. 2 Heating Oil ($/gal) - proxy diesel
    "EER_EPJK_PF4_RGC_DPG": "jet_fuel",     # US Gulf Coast Kerosene-Type Jet Fuel ($/gal)
}

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "eia.csv")


def fetch_range(start: dt.date, end: dt.date, session=None) -> list:
    session = session or requests.Session()
    rows = []
    offset = 0
    length = 5000
    while True:
        params = {
            "api_key": API_KEY,
            "frequency": "daily",
            "data[0]": "value",
            "start": start.isoformat(),
            "end": end.isoformat(),
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
            "offset": offset,
            "length": length,
        }
        for i, code in enumerate(SERIES):
            params[f"facets[series][{i}]"] = code
        r = session.get(BASE, params=params, timeout=60)
        r.raise_for_status()
        data = r.json().get("response", {}).get("data", [])
        rows.extend(data)
        if len(data) < length:
            break
        offset += length
        time.sleep(0.3)
    return rows


def update(start=dt.date(2020, 1, 1), end=None):
    if not API_KEY:
        print("[fetch_eia] EIA_API_KEY nao configurada, pulando.", file=sys.stderr)
        return
    end = end or dt.date.today()

    old = pd.DataFrame()
    fetch_start = start
    if os.path.exists(CSV_PATH):
        old = pd.read_csv(CSV_PATH, parse_dates=["date"])
        if len(old):
            last = old["date"].max().date()
            fetch_start = min(start, last - dt.timedelta(days=10))  # sobreposicao p/ revisoes

    try:
        rows = fetch_range(fetch_start, end)
    except Exception as e:  # noqa: BLE001
        print(f"[fetch_eia] ERRO: {e}", file=sys.stderr)
        return

    if not rows:
        print("[fetch_eia] Nenhum dado retornado.")
        return

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["period"])
    df["serie"] = df["series"].map(SERIES)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna(subset=["serie", "value"])
    pivot = df.pivot_table(index="date", columns="serie", values="value", aggfunc="last").reset_index()

    if not old.empty:
        combined = (
            pd.concat([old, pivot], ignore_index=True)
            .drop_duplicates(subset="date", keep="last")
            .sort_values("date")
        )
    else:
        combined = pivot.sort_values("date")

    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    combined.to_csv(CSV_PATH, index=False)
    print(f"[fetch_eia] {len(combined)} dias salvos em {CSV_PATH}")


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        update(dt.date.fromisoformat(sys.argv[1]), dt.date.fromisoformat(sys.argv[2]))
    else:
        update()
