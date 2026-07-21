"""Series diarias/mensais do Banco Central (API SGS) - gratuitas e estaveis."""
import os
import sys
import time
import datetime as dt

import pandas as pd
import requests

SERIES = {
    "cdi": 12,        # CDI diario (% a.d.)
    "selic": 11,      # Selic diaria (% a.d.)
    "ptax_venda": 1,  # Dolar PTAX venda
    "ipca": 433,      # IPCA mensal (% a.m.)
    "ibov": 7,        # Ibovespa - fechamento diario (pontos)
}
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "bcb")
URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados"


def fetch_series(code: int, start: dt.date, end: dt.date, retries: int = 3) -> pd.DataFrame:
    frames = []
    # API limita a 10 anos por chamada; buscamos ano a ano por robustez
    d = start
    while d <= end:
        chunk_end = min(dt.date(d.year, 12, 31), end)
        params = {
            "formato": "json",
            "dataInicial": d.strftime("%d/%m/%Y"),
            "dataFinal": chunk_end.strftime("%d/%m/%Y"),
        }
        last_err = None
        data = None
        for attempt in range(retries):
            try:
                r = requests.get(URL.format(code=code), params=params, timeout=60)
                r.raise_for_status()
                data = r.json()
                break
            except Exception as e:  # noqa: BLE001
                last_err = e
                time.sleep(3 * (attempt + 1))
        else:
            raise RuntimeError(f"Falha ao baixar serie {code} ({d}-{chunk_end}): {last_err}")
        if data:
            frames.append(pd.DataFrame(data))
        d = dt.date(d.year + 1, 1, 1)
    if not frames:
        return pd.DataFrame(columns=["date", "value"])
    df = pd.concat(frames, ignore_index=True)
    df["date"] = pd.to_datetime(df["data"], format="%d/%m/%Y").dt.strftime("%Y-%m-%d")
    df["value"] = pd.to_numeric(df["valor"].astype(str).str.replace(",", "."), errors="coerce")
    return df[["date", "value"]].dropna()


def update(start=dt.date(2020, 1, 1), end=None):
    end = end or dt.date.today()
    os.makedirs(DATA_DIR, exist_ok=True)
    for name, code in SERIES.items():
        path = os.path.join(DATA_DIR, f"{name}.csv")
        s = start
        old = pd.DataFrame(columns=["date", "value"])
        if os.path.exists(path):
            old = pd.read_csv(path)
            if len(old):
                last = dt.date.fromisoformat(str(old["date"].max()))
                s = last - dt.timedelta(days=10)  # sobreposicao p/ revisoes
        try:
            new = fetch_series(code, s, end)
        except Exception as e:  # noqa: BLE001
            print(f"[fetch_bcb] ERRO {name}: {e}", file=sys.stderr)
            continue
        df = (
            pd.concat([old, new], ignore_index=True)
            .drop_duplicates(subset=["date"], keep="last")
            .sort_values("date")
        )
        df.to_csv(path, index=False)
        print(f"[fetch_bcb] {name}: {len(df)} observacoes")


if __name__ == "__main__":
    update()
