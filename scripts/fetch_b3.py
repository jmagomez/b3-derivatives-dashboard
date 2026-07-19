"""Coleta diaria de derivativos da B3 via arquivo publico Up2Data
(TradeInformationConsolidatedFile) em arquivos.b3.com.br.

Layout (CSV ';', 1a linha = status, decimal ','):
RptDt;TckrSymb;ISIN;SgmtNm;MinPric;MaxPric;TradAvrgPric;LastPric;OscnPctg;
AdjstdQt;AdjstdQtTax;RefPric;TradQty;FinInstrmQty;NtlFinVol

Cobertura gratuita: ~12 meses retroativos. Datas anteriores retornam vazio
e sao ignoradas (a B3 nao disponibiliza mais o historico antigo em formato
aberto - ver README).
"""
import io
import os
import sys
import time
import datetime as dt

import pandas as pd
import requests

BASE = "https://arquivos.b3.com.br/api/download"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
FUT_RE = r"^(DI1|DOL|IND|DDI|FRC|BGI|CCM|ICF|SJC)([FGHJKMNQUVXZ]\d{2})$"
OPT_RE = r"^(DI1|IDI|DOL|IND|BGI|CCM|ICF|SJC)([FGHJKMNQUVXZ]\d{2})[CP]\d+$"

ROOT = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(ROOT, "data", "ajustes")
OPCOES = os.path.join(ROOT, "data", "opcoes.csv")

FUT_COLS = ["date", "codigo", "vencimento", "ajuste_anterior", "ajuste_atual",
            "variacao", "taxa", "contratos", "volume"]


def fetch_day(date: dt.date, session=None, retries=3):
    """Baixa e parseia o TIC file. Retorna (futuros_df, opcoes_df) ou (None, None)."""
    sess = session or requests.Session()
    last_err = None
    for attempt in range(retries):
        try:
            r = sess.get(f"{BASE}/requestname",
                         params={"fileName": "TradeInformationConsolidatedFile",
                                 "date": date.isoformat()},
                         headers=HEADERS, timeout=60)
            r.raise_for_status()
            token = r.json().get("redirectUrl", "").split("token=")[-1]
            if not token:
                return None, None
            r2 = sess.get(BASE + "?token=" + token, headers=HEADERS, timeout=180)
            r2.raise_for_status()
            break
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(3 * (attempt + 1))
    else:
        raise RuntimeError(f"Falha ao baixar TIC de {date}: {last_err}")

    if not r2.content or len(r2.content) < 100:
        return None, None
    df = pd.read_csv(io.BytesIO(r2.content), sep=";", skiprows=1, decimal=",",
                     encoding="latin1", dtype={"TckrSymb": str})
    df = df.rename(columns=lambda c: c.strip())
    if "TckrSymb" not in df.columns:
        return None, None
    df["TckrSymb"] = df["TckrSymb"].astype(str).str.strip()

    fut = df[df["TckrSymb"].str.match(FUT_RE, na=False)].copy()
    ext = fut["TckrSymb"].str.extract(FUT_RE)
    fut["codigo"], fut["vencimento"] = ext[0], ext[1]
    fut["date"] = fut["RptDt"]
    fut["ajuste_anterior"] = None
    fut["ajuste_atual"] = pd.to_numeric(fut.get("AdjstdQt"), errors="coerce")
    fut["variacao"] = pd.to_numeric(fut.get("OscnPctg"), errors="coerce")
    fut["taxa"] = pd.to_numeric(fut.get("AdjstdQtTax"), errors="coerce")
    fut["contratos"] = pd.to_numeric(fut.get("FinInstrmQty"), errors="coerce")
    fut["volume"] = pd.to_numeric(fut.get("NtlFinVol"), errors="coerce")
    fut = fut[FUT_COLS].dropna(subset=["ajuste_atual", "taxa"], how="all")

    opt = df[df["TckrSymb"].str.match(OPT_RE, na=False)].copy()
    if len(opt):
        oext = opt["TckrSymb"].str.extract(OPT_RE)
        opt["mercadoria"] = oext[0]
        for c in ("TradQty", "FinInstrmQty", "NtlFinVol"):
            opt[c] = pd.to_numeric(opt.get(c), errors="coerce").fillna(0)
        agg = opt.groupby("mercadoria").agg(
            contratos_negociados=("FinInstrmQty", "sum"),
            volume=("NtlFinVol", "sum"),
            negocios=("TradQty", "sum")).reset_index()
        agg["date"] = date.isoformat()
        agg = agg[["date", "mercadoria", "contratos_negociados", "volume", "negocios"]]
    else:
        agg = pd.DataFrame(columns=["date", "mercadoria", "contratos_negociados",
                                    "volume", "negocios"])
    return fut, agg


def load_year(year: int) -> pd.DataFrame:
    path = os.path.join(DATA_DIR, f"{year}.csv")
    if os.path.exists(path):
        return pd.read_csv(path, dtype={"vencimento": str})
    return pd.DataFrame(columns=FUT_COLS)


def save_year(year: int, df: pd.DataFrame):
    os.makedirs(DATA_DIR, exist_ok=True)
    df = df.sort_values(["date", "codigo", "vencimento"]).drop_duplicates(
        subset=["date", "codigo", "vencimento"], keep="last")
    df.to_csv(os.path.join(DATA_DIR, f"{year}.csv"), index=False)


def save_opcoes(frames):
    old = pd.read_csv(OPCOES) if os.path.exists(OPCOES) else pd.DataFrame(
        columns=["date", "mercadoria", "contratos_negociados", "volume", "negocios"])
    df = pd.concat([old] + frames, ignore_index=True)
    df = df.drop_duplicates(subset=["date", "mercadoria"], keep="last").sort_values("date")
    os.makedirs(os.path.dirname(OPCOES), exist_ok=True)
    df.to_csv(OPCOES, index=False)


def existing_dates() -> set:
    dates = set()
    if not os.path.isdir(DATA_DIR):
        return dates
    for f in os.listdir(DATA_DIR):
        if f.endswith(".csv"):
            try:
                dates |= set(pd.read_csv(os.path.join(DATA_DIR, f), usecols=["date"])["date"])
            except Exception:  # noqa: BLE001
                pass
    return dates


def update_range(start: dt.date, end: dt.date, pause=1.0, max_days=None):
    have = existing_dates()
    todo = [start + dt.timedelta(days=i) for i in range((end - start).days + 1)]
    todo = [d for d in todo if d.weekday() < 5 and d.isoformat() not in have]
    if max_days:
        todo = todo[:max_days]
    print(f"[fetch_b3] {len(todo)} dia(s) a buscar")
    sess = requests.Session()
    buf, obuf, fetched, empty = {}, [], 0, 0
    for i, day in enumerate(todo):
        try:
            fut, opc = fetch_day(day, session=sess)
        except Exception as e:  # noqa: BLE001
            print(f"[fetch_b3] ERRO {day}: {e}", file=sys.stderr)
            continue
        if fut is not None and len(fut):
            buf.setdefault(day.year, []).append(fut)
            if len(opc):
                obuf.append(opc)
            fetched += 1
        else:
            empty += 1
        if (i + 1) % 20 == 0 or i == len(todo) - 1:
            for yr, frames in buf.items():
                save_year(yr, pd.concat([load_year(yr)] + frames, ignore_index=True))
            if obuf:
                save_opcoes(obuf)
            buf, obuf = {}, []
            print(f"[fetch_b3] progresso {i + 1}/{len(todo)} (ok={fetched} vazios={empty})")
        time.sleep(pause)
    print(f"[fetch_b3] concluido: {fetched} pregoes salvos, {empty} sem arquivo")


if __name__ == "__main__":
    start = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.date(2020, 1, 1)
    end = dt.date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else dt.date.today()
    max_days = int(sys.argv[3]) if len(sys.argv) > 3 else None
    update_range(start, end, max_days=max_days)
"""Coleta diaria de derivativos da B3 via arquivo publico Up2Data
(TradeInformationConsolidatedFile) em arquivos.b3.com.br.

Layout (CSV ';', 1a linha = status, decimal ','):
RptDt;TckrSymb;ISIN;SgmtNm;MinPric;MaxPric;TradAvrgPric;LastPric;OscnPctg;
AdjstdQt;AdjstdQtTax;RefPric;TradQty;FinInstrmQty;NtlFinVol

Cobertura gratuita: ~12 meses retroativos. Datas anteriores retornam vazio
e sao ignoradas (a B3 nao disponibiliza mais o historico antigo em formato
aberto - ver README).
"""
import io
import os
import sys
import time
import datetime as dt

import pandas as pd
import requests

BASE = "https://arquivos.b3.com.br/api/download"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
FUT_RE = r"^(DI1|DOL|IND|DDI|FRC|BGI|CCM|ICF|SJC)([FGHJKMNQUVXZ]\d{2})$"
OPT_RE = r"^(DI1|IDI|DOL|IND|BGI|CCM|ICF|SJC)([FGHJKMNQUVXZ]\d{2})[CP]\d+$"

ROOT = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(ROOT, "data", "ajustes")
OPCOES = os.path.join(ROOT, "data", "opcoes.csv")

FUT_COLS = ["date", "codigo", "vencimento", "ajuste_anterior", "ajuste_atual",
            "variacao", "taxa", "contratos", "volume"]


def fetch_day(date: dt.date, session=None, retries=3):
    """Baixa e parseia o TIC file. Retorna (futuros_df, opcoes_df) ou (None, None)."""
    sess = session or requests.Session()
    last_err = None
    for attempt in range(retries):
        try:
            r = sess.get(f"{BASE}/requestname",
                         params={"fileName": "TradeInformationConsolidatedFile",
                                 "date": date.isoformat()},
                         headers=HEADERS, timeout=60)
            r.raise_for_status()
            token = r.json().get("redirectUrl", "").split("token=")[-1]
            if not token:
                return None, None
            r2 = sess.get(BASE + "?token=" + token, headers=HEADERS, timeout=180)
            r2.raise_for_status()
            break
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(3 * (attempt + 1))
    else:
        raise RuntimeError(f"Falha ao baixar TIC de {date}: {last_err}")

    if not r2.content or len(r2.content) < 100:
        return None, None
    df = pd.read_csv(io.BytesIO(r2.content), sep=";", skiprows=1, decimal=",",
                     encoding="latin1", dtype={"TckrSymb": str})
    df = df.rename(columns=lambda c: c.strip())
    if "TckrSymb" not in df.columns:
        return None, None
    df["TckrSymb"] = df["TckrSymb"].astype(str).str.strip()

    fut = df[df["TckrSymb"].str.match(FUT_RE, na=False)].copy()
    ext = fut["TckrSymb"].str.extract(FUT_RE)
    fut["codigo"], fut["vencimento"] = ext[0], ext[1]
    fut["date"] = fut["RptDt"]
    fut["ajuste_anterior"] = None
    fut["ajuste_atual"] = pd.to_numeric(fut.get("AdjstdQt"), errors="coerce")
    fut["variacao"] = pd.to_numeric(fut.get("OscnPctg"), errors="coerce")
    fut["taxa"] = pd.to_numeric(fut.get("AdjstdQtTax"), errors="coerce")
    fut["contratos"] = pd.to_numeric(fut.get("FinInstrmQty"), errors="coerce")
    fut["volume"] = pd.to_numeric(fut.get("NtlFinVol"), errors="coerce")
    fut = fut[FUT_COLS].dropna(subset=["ajuste_atual", "taxa"], how="all")

    opt = df[df["TckrSymb"].str.match(OPT_RE, na=False)].copy()
    if len(opt):
        oext = opt["TckrSymb"].str.extract(OPT_RE)
        opt["mercadoria"] = oext[0]
        for c in ("TradQty", "FinInstrmQty", "NtlFinVol"):
            opt[c] = pd.to_numeric(opt.get(c), errors="coerce").fillna(0)
        agg = opt.groupby("mercadoria").agg(
            contratos_negociados=("FinInstrmQty", "sum"),
            volume=("NtlFinVol", "sum"),
            negocios=("TradQty", "sum")).reset_index()
        agg["date"] = date.isoformat()
        agg = agg[["date", "mercadoria", "contratos_negociados", "volume", "negocios"]]
    else:
        agg = pd.DataFrame(columns=["date", "mercadoria", "contratos_negociados",
                                    "volume", "negocios"])
    return fut, agg


def load_year(year: int) -> pd.DataFrame:
    path = os.path.join(DATA_DIR, f"{year}.csv")
    if os.path.exists(path):
        return pd.read_csv(path, dtype={"vencimento": str})
    return pd.DataFrame(columns=FUT_COLS)


def save_year(year: int, df: pd.DataFrame):
    os.makedirs(DATA_DIR, exist_ok=True)
    df = df.sort_values(["date", "codigo", "vencimento"]).drop_duplicates(
        subset=["date", "codigo", "vencimento"], keep="last")
    df.to_csv(os.path.join(DATA_DIR, f"{year}.csv"), index=False)


def save_opcoes(frames):
    old = pd.read_csv(OPCOES) if os.path.exists(OPCOES) else pd.DataFrame(
        columns=["date", "mercadoria", "contratos_negociados", "volume", "negocios"])
    df = pd.concat([old] + frames, ignore_index=True)
    df = df.drop_duplicates(subset=["date", "mercadoria"], keep="last").sort_values("date")
    os.makedirs(os.path.dirname(OPCOES), exist_ok=True)
    df.to_csv(OPCOES, index=False)


def existing_dates() -> set:
    dates = set()
    if not os.path.isdir(DATA_DIR):
        return dates
    for f in os.listdir(DATA_DIR):
        if f.endswith(".csv"):
            try:
                dates |= set(pd.read_csv(os.path.join(DATA_DIR, f), usecols=["date"])["date"])
            except Exception:  # noqa: BLE001
                pass
    return dates


def update_range(start: dt.date, end: dt.date, pause=1.0, max_days=None):
    have = existing_dates()
    todo = [start + dt.timedelta(days=i) for i in range((end - start).days + 1)]
    todo = [d for d in todo if d.weekday() < 5 and d.isoformat() not in have]
    if max_days:
        todo = todo[:max_days]
    print(f"[fetch_b3] {len(todo)} dia(s) a buscar")
    sess = requests.Session()
    buf, obuf, fetched, empty = {}, [], 0, 0
    for i, day in enumerate(todo):
        try:
            fut, opc = fetch_day(day, session=sess)
        except Exception as e:  # noqa: BLE001
            print(f"[fetch_b3] ERRO {day}: {e}", file=sys.stderr)
            continue
        if fut is not None and len(fut):
            buf.setdefault(day.year, []).append(fut)
            if len(opc):
                obuf.append(opc)
            fetched += 1
        else:
            empty += 1
        if (i + 1) % 20 == 0 or i == len(todo) - 1:
            for yr, frames in buf.items():
                save_year(yr, pd.concat([load_year(yr)] + frames, ignore_index=True))
            if obuf:
                save_opcoes(obuf)
            buf, obuf = {}, []
            print(f"[fetch_b3] progresso {i + 1}/{len(todo)} (ok={fetched} vazios={empty})")
        time.sleep(pause)
    print(f"[fetch_b3] concluido: {fetched} pregoes salvos, {empty} sem arquivo")


if __name__ == "__main__":
    start = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.date(2020, 1, 1)
    end = dt.date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else dt.date.today()
    max_days = int(sys.argv[3]) if len(sys.argv) > 3 else None
    update_range(start, end, max_days=max_days)
"""Coleta de precos de ajuste de futuros da B3 (pagina de Ajustes do Pregao).

Fonte: https://www2.bmf.com.br/pages/portal/bmfbovespa/lumis/lum-ajustes-do-pregao-ptBR.asp?dData1=DD/MM/AAAA
Uma requisicao por dia retorna todos os contratos futuros (DI1, DOL, IND, DDI, FRC,
BGI, CCM, ICF, SJC, etc.) com preco de ajuste anterior, atual e variacao.
"""
import io
import os
import sys
import time
import datetime as dt

import pandas as pd
import requests

BASE_URL = (
    "https://www2.bmf.com.br/pages/portal/bmfbovespa/lumis/"
    "lum-ajustes-do-pregao-ptBR.asp"
)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
}
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "ajustes")


def _to_float(x):
    if x is None:
        return None
    s = str(x).strip().replace(".", "").replace(",", ".")
    s = s.replace("+", "").replace("\xa0", "")
    if s in ("", "-", "nan", "None"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def fetch_day(date: dt.date, session=None, retries=3) -> pd.DataFrame:
    """Retorna DataFrame com ajustes de todos os futuros para uma data.

    Colunas: date, codigo, vencimento, ajuste_anterior, ajuste_atual, variacao
    DataFrame vazio se nao houve pregao (feriado/fim de semana).
    """
    sess = session or requests.Session()
    params = {"dData1": date.strftime("%d/%m/%Y")}
    last_err = None
    for attempt in range(retries):
        try:
            r = sess.get(BASE_URL, params=params, headers=HEADERS, timeout=60)
            r.raise_for_status()
            break
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(3 * (attempt + 1))
    else:
        raise RuntimeError(f"Falha ao buscar ajustes de {date}: {last_err}")

    html = r.content.decode("latin-1", errors="replace")
    tables = []
    try:
        tables = pd.read_html(io.StringIO(html), attrs={"id": "tblDadosAjustes"})
    except ValueError:
        pass
    if not tables:
        # fallback: pega a maior tabela plausivel
        try:
            all_tables = pd.read_html(io.StringIO(html))
        except ValueError:
            return pd.DataFrame()
        cand = [t for t in all_tables if t.shape[1] >= 5 and len(t) > 5]
        if not cand:
            return pd.DataFrame()
        tables = [max(cand, key=len)]

    df = tables[0].copy()
    df.columns = list(range(df.shape[1]))
    df = df.rename(
        columns={
            0: "mercadoria",
            1: "vencimento",
            2: "ajuste_anterior",
            3: "ajuste_atual",
            4: "variacao",
        }
    )
    # a coluna mercadoria vem preenchida apenas na 1a linha de cada grupo
    df["mercadoria"] = df["mercadoria"].ffill()
    df = df.dropna(subset=["vencimento"])
    df["codigo"] = (
        df["mercadoria"].astype(str).str.extract(r"^([A-Z0-9]{2,4})\s*-")[0]
    )
    df["codigo"] = df["codigo"].fillna(
        df["mercadoria"].astype(str).str.split().str[0]
    )
    df["vencimento"] = df["vencimento"].astype(str).str.strip()
    df = df[df["vencimento"].str.match(r"^[FGHJKMNQUVXZ]\d{2}$", na=False)]
    for c in ("ajuste_anterior", "ajuste_atual", "variacao"):
        df[c] = df[c].map(_to_float)
    df["date"] = date.isoformat()
    out = df[
        ["date", "codigo", "vencimento", "ajuste_anterior", "ajuste_atual", "variacao"]
    ].reset_index(drop=True)
    return out


def load_year(year: int) -> pd.DataFrame:
    path = os.path.join(DATA_DIR, f"{year}.csv")
    if os.path.exists(path):
        return pd.read_csv(path, dtype={"vencimento": str})
    return pd.DataFrame(
        columns=["date", "codigo", "vencimento", "ajuste_anterior", "ajuste_atual", "variacao"]
    )


def save_year(year: int, df: pd.DataFrame):
    os.makedirs(DATA_DIR, exist_ok=True)
    df = df.sort_values(["date", "codigo", "vencimento"]).drop_duplicates(
        subset=["date", "codigo", "vencimento"], keep="last"
    )
    df.to_csv(os.path.join(DATA_DIR, f"{year}.csv"), index=False)


def existing_dates() -> set:
    dates = set()
    if not os.path.isdir(DATA_DIR):
        return dates
    for f in os.listdir(DATA_DIR):
        if f.endswith(".csv"):
            try:
                dates |= set(pd.read_csv(os.path.join(DATA_DIR, f), usecols=["date"])["date"])
            except Exception:  # noqa: BLE001
                pass
    return dates


def update_range(start: dt.date, end: dt.date, pause=1.0, max_days=None):
    """Busca dias uteis faltantes no intervalo e persiste por ano."""
    have = existing_dates()
    todo = []
    d = start
    while d <= end:
        if d.weekday() < 5 and d.isoformat() not in have:
            todo.append(d)
        d += dt.timedelta(days=1)
    if max_days:
        todo = todo[:max_days]
    print(f"[fetch_b3] {len(todo)} dia(s) a buscar")
    sess = requests.Session()
    buf = {}
    fetched = 0
    for i, day in enumerate(todo):
        try:
            df = fetch_day(day, session=sess)
        except Exception as e:  # noqa: BLE001
            print(f"[fetch_b3] ERRO {day}: {e}", file=sys.stderr)
            continue
        if len(df):
            buf.setdefault(day.year, []).append(df)
            fetched += 1
        if (i + 1) % 25 == 0 or i == len(todo) - 1:
            for yr, frames in buf.items():
                merged = pd.concat([load_year(yr)] + frames, ignore_index=True)
                save_year(yr, merged)
            buf = {}
            print(f"[fetch_b3] progresso {i + 1}/{len(todo)}")
        time.sleep(pause)
    print(f"[fetch_b3] concluido: {fetched} pregoes salvos")


if __name__ == "__main__":
    start = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.date(2020, 1, 1)
    end = dt.date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else dt.date.today()
    max_days = int(sys.argv[3]) if len(sys.argv) > 3 else None
    update_range(start, end, max_days=max_days)
