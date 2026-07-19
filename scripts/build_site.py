"""Gera os JSONs consumidos pelo dashboard (docs/data/) a partir dos CSVs."""
import json
import os
import glob
import datetime as dt

import numpy as np
import pandas as pd

ROOT = os.path.join(os.path.dirname(__file__), "..")
AJUSTES_DIR = os.path.join(ROOT, "data", "ajustes")
BCB_DIR = os.path.join(ROOT, "data", "bcb")
OPCOES = os.path.join(ROOT, "data", "opcoes.csv")
OUT = os.path.join(ROOT, "docs", "data")

MONTH = {"F": 1, "G": 2, "H": 3, "J": 4, "K": 5, "M": 6,
         "N": 7, "Q": 8, "U": 9, "V": 10, "X": 11, "Z": 12}

TRACKED = {
    "DI1": "DI Futuro",
    "DOL": "Dolar Futuro",
    "IND": "Ibovespa Futuro",
    "DDI": "Cupom Cambial (DDI)",
    "FRC": "FRA de Cupom (FRC)",
    "BGI": "Boi Gordo",
    "CCM": "Milho",
    "ICF": "Cafe Arabica",
    "SJC": "Soja",
}


def maturity(venc: str) -> dt.date:
    m = MONTH[venc[0]]
    y = 2000 + int(venc[1:])
    return dt.date(y, m, 1)


def load_ajustes() -> pd.DataFrame:
    files = sorted(glob.glob(os.path.join(AJUSTES_DIR, "*.csv")))
    if not files:
        return pd.DataFrame()
    df = pd.concat([pd.read_csv(f, dtype={"vencimento": str}) for f in files], ignore_index=True)
    df = df[df["codigo"].isin(TRACKED)]
    df["mat"] = df["vencimento"].map(maturity)
    df["date_d"] = pd.to_datetime(df["date"]).dt.date
    return df


def front_month_series(df: pd.DataFrame, code: str) -> list:
    sub = df[df["codigo"] == code].copy()
    if sub.empty:
        return []
    sub = sub[sub["mat"] >= sub["date_d"].map(lambda d: dt.date(d.year, d.month, 1))]
    sub = sub.sort_values(["date", "mat"])
    first = sub.groupby("date").first().reset_index()
    return [
        {"date": r["date"], "value": r["ajuste_atual"], "venc": r["vencimento"]}
        for _, r in first.iterrows()
        if pd.notna(r["ajuste_atual"])
    ]


def di_rate(pu: float, ref: dt.date, mat: dt.date):
    if not pu or pu <= 0 or mat <= ref:
        return None
    bu = int(np.busday_count(ref.isoformat(), mat.isoformat()))
    if bu <= 0:
        return None
    return round(((100000.0 / pu) ** (252.0 / bu) - 1) * 100, 3)


def row_rate(r, ref):
    if "taxa" in r and pd.notna(r.get("taxa")):
        return round(float(r["taxa"]), 3)
    return di_rate(r["ajuste_atual"], ref, r["mat"])


def di_curve(df: pd.DataFrame, ref_date: str) -> list:
    sub = df[(df["codigo"] == "DI1") & (df["date"] == ref_date)].copy()
    ref = dt.date.fromisoformat(ref_date)
    out = []
    for _, r in sub.sort_values("mat").iterrows():
        rate = row_rate(r, ref)
        if rate is not None and 0 < rate < 60:
            out.append({"venc": r["vencimento"], "mat": r["mat"].isoformat(), "rate": rate})
    return out


def di_front_rate_series(df: pd.DataFrame) -> list:
    """Taxa implicita do DI com ~1 ano de prazo (contrato jan mais proximo de 252 du)."""
    sub = df[df["codigo"] == "DI1"].copy()
    out = []
    for date, g in sub.groupby("date"):
        ref = dt.date.fromisoformat(date)
        g = g.copy()
        g["du"] = g["mat"].map(lambda m: int(np.busday_count(ref.isoformat(), m.isoformat())) if m > ref else -1)
        g = g[g["du"] > 20]
        if g.empty:
            continue
        g["dist"] = (g["du"] - 252).abs()
        r = g.sort_values("dist").iloc[0]
        rate = row_rate(r, ref)
        if rate is not None and 0 < rate < 60:
            out.append({"date": date, "value": rate, "venc": r["vencimento"]})
    return sorted(out, key=lambda x: x["date"])


def main():
    os.makedirs(OUT, exist_ok=True)
    df = load_ajustes()
    payload_series = {}
    summary = {"generated_at": dt.datetime.now().isoformat(timespec="seconds"), "items": []}

    if len(df):
        last_date = df["date"].max()
        summary["last_date"] = last_date
        for code, label in TRACKED.items():
            if code == "DI1":
                serie = di_front_rate_series(df)
                unit = "% a.a. (DI ~1 ano)"
            else:
                serie = front_month_series(df, code)
                unit = "pts/R$"
            payload_series[code] = {"label": label, "unit": unit, "serie": serie}
            if len(serie) >= 2:
                cur, prev = serie[-1], serie[-2]
                var = None
                if code == "DI1":
                    var = round(cur["value"] - prev["value"], 3)  # p.p.
                elif prev["value"]:
                    var = round((cur["value"] / prev["value"] - 1) * 100, 2)
                summary["items"].append({
                    "code": code, "label": label, "date": cur["date"],
                    "value": cur["value"], "prev": prev["value"], "var_pct": var,
                    "venc": cur.get("venc"),
                })
        curve = di_curve(df, last_date)
        # curva de ~1 ano atras para comparacao
        dates = sorted(df["date"].unique())
        old_ref = [d for d in dates if d <= (dt.date.fromisoformat(last_date) - dt.timedelta(days=365)).isoformat()]
        curve_old = di_curve(df, old_ref[-1]) if old_ref else []
        with open(os.path.join(OUT, "di_curve.json"), "w") as f:
            json.dump({"ref": last_date, "curve": curve,
                       "ref_old": old_ref[-1] if old_ref else None, "curve_old": curve_old}, f)

    with open(os.path.join(OUT, "series.json"), "w") as f:
        json.dump(payload_series, f)

    bcb = {}
    for path in glob.glob(os.path.join(BCB_DIR, "*.csv")):
        name = os.path.splitext(os.path.basename(path))[0]
        d = pd.read_csv(path)
        bcb[name] = d.to_dict(orient="records")
    with open(os.path.join(OUT, "bcb.json"), "w") as f:
        json.dump(bcb, f)

    opc = []
    if os.path.exists(OPCOES):
        opc = pd.read_csv(OPCOES).to_dict(orient="records")
    with open(os.path.join(OUT, "opcoes.json"), "w") as f:
        json.dump(opc, f)

    with open(os.path.join(OUT, "summary.json"), "w") as f:
        json.dump(summary, f, ensure_ascii=False)
    print(f"[build_site] JSONs gerados em {OUT}")


if __name__ == "__main__":
    main()
