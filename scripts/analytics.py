"""Metricas de risco e retorno para o dashboard (funcoes puras, sem rede).

Tudo aqui e calculado a partir de series JA coletadas pelo repositorio
(markets.csv, PTAX/CDI/IPCA do BCB, ajustes do IND e curva DI). Nenhum numero
e estimado ou preenchido: onde a historia nao cobre a janela pedida, o campo
sai None e o dashboard mostra "n/d".

Convencoes (tambem exibidas no dashboard, aba "Risco & Retorno"):

* Retornos sao de PRECO (indices em pontos, nao incluem dividendos).
* Data de referencia unica (`as_of` = ultimo pregao da B3). Cada ativo usa a
  ultima observacao em ou antes de `as_of` e informa a sua propria data -- o
  bitcoin, p.ex., costuma estar 1 dia util atras (ver README).
* Janela de N meses: base = ultima observacao em ou antes de `as_of - N meses`.
* Bitcoin entra so com dias uteis (seg-sex), a mesma convencao do card de
  resumo, para que retornos e correlacoes sejam comparaveis aos indices.
* Volatilidade = desvio-padrao amostral dos retornos diarios entre
  observacoes consecutivas da propria serie x raiz(252) (padrao de mercado
  para dias de pregao; para o bitcoin, amostrado em dias uteis).
* Conversao cambial usa a PTAX venda do BCB (media de janelas de ~13h BRT),
  que NAO e sincrona com o fechamento de NY (~17h BRT): a conversao e
  aproximada. Retorno em R$ de ativo em US$ = sem hedge cambial.
* Sharpe ex-post so e calculado para ativos cotados em R$ (CDI e o ativo livre
  de risco na mesma moeda). Para ativos em US$ nao ha taxa livre de risco em
  US$ nos dados do repositorio -- fica n/d, de proposito.
"""
import math

import numpy as np
import pandas as pd

DIAS_UTEIS_ANO = 252
JANELAS_MESES = {"1M": 1, "3M": 3, "6M": 6, "12M": 12}
JANELAS_VOL = {"1M": 21, "3M": 63, "12M": 252}
JANELAS_CORR = (63, 252)
PRAZOS_ANOS = (1, 2, 3, 5, 10)
ANOS_SERIES_GRAFICO = 3


# ---------------------------------------------------------------- utilidades
def _vazia() -> pd.Series:
    """Serie vazia COM DatetimeIndex: comparacoes de data com um indice vazio
    de outro tipo levantam TypeError (uma coluna ausente derrubaria o build)."""
    return pd.Series(dtype=float, index=pd.DatetimeIndex([]))


def para_serie(pontos) -> pd.Series:
    """[{date, value}, ...] -> Series float indexada por Timestamp (sem NaN)."""
    if not pontos:
        return _vazia()
    idx = pd.to_datetime([str(p["date"])[:10] for p in pontos])
    s = pd.Series([p["value"] for p in pontos], index=idx, dtype=float)
    s = s[~s.index.duplicated(keep="last")].sort_index()
    return s.dropna()


def dias_uteis(s: pd.Series) -> pd.Series:
    """Mantem so segunda a sexta (nao considera feriados)."""
    return s[s.index.dayofweek < 5]


def ate(s: pd.Series, data) -> pd.Series:
    if s.empty:
        return s
    return s[s.index <= pd.Timestamp(data)]


def _arred(x, n=2):
    return None if x is None or (isinstance(x, float) and not math.isfinite(x)) else round(float(x), n)


def _iso(ts):
    return None if ts is None else pd.Timestamp(ts).strftime("%Y-%m-%d")


def pontos(s: pd.Series, n=3) -> list:
    return [{"date": _iso(d), "value": round(float(v), n)} for d, v in s.items()]


def converter(local: pd.Series, ptax: pd.Series, para: str) -> pd.Series:
    """Converte uma serie pela PTAX nas datas em que AMBAS existem.

    para="USD": serie em R$ -> US$ (divide). para="BRL": serie em US$ -> R$
    (multiplica). Datas sem PTAX (feriado no Brasil) ou sem cotacao local sao
    descartadas -- nada e interpolado.
    """
    j = pd.concat([local, ptax], axis=1, join="inner").dropna()
    if j.empty:
        return _vazia()
    a, fx = j.iloc[:, 0], j.iloc[:, 1]
    return (a / fx) if para == "USD" else (a * fx)


# ------------------------------------------------------------------- retorno
def _base(s: pd.Series, alvo):
    ant = s[s.index <= pd.Timestamp(alvo)]
    if ant.empty:
        return None
    return ant.index[-1], float(ant.iloc[-1])


def _alvo(as_of, meses=None, ytd=False):
    as_of = pd.Timestamp(as_of)
    if ytd:
        return pd.Timestamp(year=as_of.year - 1, month=12, day=31)
    return as_of - pd.DateOffset(months=meses)


def retorno_janela(s: pd.Series, as_of, meses=None, ytd=False):
    """Retorno de preco (%) entre a base da janela e a ultima obs <= as_of.

    None se a serie nao tem historia suficiente (comeca depois da data-alvo).
    """
    s = ate(s, as_of)
    if s.empty:
        return None
    alvo = _alvo(as_of, meses, ytd)
    if s.index[0] > alvo:
        return None
    base = _base(s, alvo)
    if base is None:
        return None
    (d0, v0), (d1, v1) = base, (s.index[-1], float(s.iloc[-1]))
    if v0 == 0:
        return None
    return {"pct": (v1 / v0 - 1) * 100, "base": d0, "ref": d1}


def vol_anualizada(s: pd.Series, as_of, n: int):
    """Vol anualizada (%) dos ultimos n retornos diarios; None se faltar dado."""
    r = ate(s, as_of).pct_change().dropna().iloc[-n:]
    if len(r) < n:
        return None
    return float(r.std(ddof=1) * math.sqrt(DIAS_UTEIS_ANO) * 100)


def extremos(s: pd.Series, as_of, n: int = DIAS_UTEIS_ANO):
    """Melhor e pior retorno diario entre os ultimos n. Serve para explicar a
    volatilidade e para flagrar dado suspeito: um unico dia pode dominar a vol."""
    r = ate(s, as_of).pct_change().dropna().iloc[-n:]
    if len(r) < n:
        return None
    return {"melhor": {"pct": float(r.max() * 100), "data": r.idxmax()},
            "pior": {"pct": float(r.min() * 100), "data": r.idxmin()}}


def drawdown(s: pd.Series) -> pd.Series:
    return s / s.cummax() - 1


def drawdown_janela(s: pd.Series, as_of, meses: int):
    """Max drawdown dentro da janela (pico e vale dentro dela) e o atual."""
    s = ate(s, as_of)
    if s.empty or s.index[0] > _alvo(as_of, meses):
        return None
    base = _base(s, _alvo(as_of, meses))
    w = s[s.index >= base[0]]
    dd = drawdown(w)
    vale = dd.idxmin()
    return {"max_pct": float(dd.min() * 100), "vale": vale, "atual_pct": float(dd.iloc[-1] * 100)}


# ----------------------------------------------------------------------- CDI
def indice_cdi(cdi: pd.Series) -> pd.Series:
    """Indice acumulado do CDI (base 1 antes da 1a observacao); taxa em % a.d."""
    return (1 + cdi / 100).cumprod()


def cdi_entre(cdi: pd.Series, base, ref):
    """CDI acumulado (%) com taxas datadas em (base, ref].

    Convencao simples; a escolha de contar a taxa do dia da base ou a do dia de
    referencia muda o resultado em ~1 dia de CDI (~0,05 p.p.) -- ordem de
    grandeza irrelevante frente ao horizonte de 12 meses, mas registrada.
    """
    w = cdi[(cdi.index > pd.Timestamp(base)) & (cdi.index <= pd.Timestamp(ref))]
    if w.empty:
        return None
    return float(((1 + w / 100).prod() - 1) * 100)


def sharpe_ex_post(s: pd.Series, cdi: pd.Series, as_of, n: int = DIAS_UTEIS_ANO):
    """Sharpe ex-post: media dos excessos diarios sobre o CDI / desvio dos
    excessos, anualizado. So faz sentido para ativos em R$.

    Excesso de cada intervalo = retorno do ativo - CDI acumulado no mesmo
    intervalo (taxas datadas em (d_anterior, d]). Se o CDI ainda nao cobre os
    ultimos dias do ativo (publicacao defasada), a janela termina no ultimo dia
    coberto; se sobrar menos de n retornos, devolve None -- nao assume CDI zero.
    """
    s = ate(s, as_of)
    if cdi.empty:
        return None
    s = s[s.index <= cdi.index[-1]]
    if len(s) < n + 1:
        return None
    s = s.iloc[-(n + 1):]
    if cdi.index[0] > s.index[0]:
        return None
    idx = indice_cdi(cdi)
    datas = list(s.index)
    exc = []
    for i in range(1, len(datas)):
        f0 = float(idx[idx.index <= datas[i - 1]].iloc[-1])
        f1 = float(idx[idx.index <= datas[i]].iloc[-1])
        exc.append(float(s.iloc[i] / s.iloc[i - 1] - 1) - (f1 / f0 - 1))
    exc = np.array(exc)
    sd = exc.std(ddof=1)
    if sd == 0:
        return None
    return float(exc.mean() / sd * math.sqrt(DIAS_UTEIS_ANO))


# ---------------------------------------------------------------- correlacao
def correlacao(series: dict, as_of, n: int):
    """Correlacao dos retornos diarios (ultimas n observacoes COMUNS).

    Painel em dias uteis com so as datas em que todos os ativos tem cotacao: um
    feriado de qualquer mercado remove a data de todos (o retorno vira o de 2
    dias para todos, mantendo a comparabilidade).
    """
    painel = pd.concat({k: dias_uteis(ate(v, as_of)) for k, v in series.items()}, axis=1).dropna()
    r = painel.pct_change().dropna().iloc[-n:]
    if len(r) < n:
        return None
    c = r.corr()
    return {
        "ativos": list(c.columns),
        "matriz": [[_arred(x, 3) for x in linha] for linha in c.values.tolist()],
        "n": int(len(r)), "inicio": _iso(r.index[0]), "fim": _iso(r.index[-1]),
    }


# ------------------------------------------------------------------ juro real
def juro_real(cdi: pd.Series, ipca: pd.Series):
    """Juro real ex-post em 12 meses: (1+CDI)/(1+IPCA)-1 sobre os MESMOS 12
    meses do ultimo IPCA publicado (o CDI e cortado no fim desse mes, nao hoje).
    """
    if len(ipca) < 12 or cdi.empty:
        return None
    ult = ipca.iloc[-12:]
    meses = ult.index.to_period("M")
    if any((meses[i + 1] - meses[i]).n != 1 for i in range(11)):
        return None  # falta algum mes: nao inventa
    ini = ult.index[0]
    fim = ult.index[-1] + pd.offsets.MonthEnd(0)
    if cdi.index[0] > ini or cdi.index[-1] < fim:
        return None
    cdi12 = cdi_entre(cdi, ini - pd.Timedelta(days=1), fim)
    ipca12 = float(((1 + ult / 100).prod() - 1) * 100)
    return {
        "cdi_12m": cdi12, "ipca_12m": ipca12,
        "real_12m": ((1 + cdi12 / 100) / (1 + ipca12 / 100) - 1) * 100,
        "janela_ini": ini, "janela_fim": fim,
    }


def cdi_anualizado(cdi: pd.Series):
    """Taxa CDI diaria mais recente anualizada (base 252), em %."""
    if cdi.empty:
        return None
    return {"pct": float(((1 + cdi.iloc[-1] / 100) ** DIAS_UTEIS_ANO - 1) * 100), "data": cdi.index[-1]}


# ----------------------------------------------------------------- curva DI
def taxa_no_prazo(curva: list, ref, anos: int):
    """Taxa interpolada (linear em dias corridos) no prazo `ref + anos`.

    None se o prazo cai fora dos vertices existentes (sem extrapolar).
    """
    if not curva:
        return None
    ref = pd.Timestamp(ref)
    alvo = ref + pd.DateOffset(years=anos)
    xs = [(pd.Timestamp(p["mat"]) - ref).days for p in curva]
    ys = [p["rate"] for p in curva]
    d = (alvo - ref).days
    if d < min(xs) or d > max(xs):
        return None
    return float(np.interp(d, xs, ys))


def curva_prazos(curva_info: dict):
    """Taxas em prazos fixos (1/2/3/5/10a) hoje vs ha ~12 meses + inclinacoes."""
    if not curva_info or not curva_info.get("curve"):
        return None
    ref, old = curva_info["ref"], curva_info.get("ref_old")
    linhas = []
    for a in PRAZOS_ANOS:
        agora = taxa_no_prazo(curva_info["curve"], ref, a)
        antes = taxa_no_prazo(curva_info.get("curve_old") or [], old, a) if old else None
        linhas.append({
            "anos": a, "atual": agora, "antes": antes,
            "var_bp": None if agora is None or antes is None else (agora - antes) * 100,
        })
    por = {x["anos"]: x for x in linhas}

    def incl(a, b, chave):
        va, vb = por[a][chave], por[b][chave]
        return None if va is None or vb is None else (vb - va) * 100

    return {
        "ref": ref, "ref_old": old, "prazos": linhas,
        "inclinacao_3a_1a_bp": {"atual": incl(1, 3, "atual"), "antes": incl(1, 3, "antes")},
        "inclinacao_10a_1a_bp": {"atual": incl(1, 10, "atual"), "antes": incl(1, 10, "antes")},
    }


# ------------------------------------------------------- base IND x a vista
def base_indice(ind_pts: list, ibov: pd.Series):
    """Base do mini-indice futuro (contrato da frente) sobre o Ibovespa a vista.

    O ajuste do futuro e apurado em janela proxima do fim do pregao e o fechamento
    do a vista em outro instante: parte da base e ruido de sincronia, e ela
    converge a zero no vencimento (serrote a cada rolagem).
    """
    ind = para_serie(ind_pts)
    if ind.empty or ibov.empty:
        return None
    venc = {pd.Timestamp(str(p["date"])[:10]): p.get("venc") for p in ind_pts}
    j = pd.concat([ind, ibov], axis=1, join="inner").dropna()
    if j.empty:
        return None
    j.columns = ["ind", "ibov"]
    j["pts"] = j["ind"] - j["ibov"]
    j["pct"] = (j["ind"] / j["ibov"] - 1) * 100
    ult = j.index[-1]
    return {
        "ultimo": {"date": ult, "ind": float(j.loc[ult, "ind"]), "ibov": float(j.loc[ult, "ibov"]),
                   "pts": float(j.loc[ult, "pts"]), "pct": float(j.loc[ult, "pct"]),
                   "venc": venc.get(ult)},
        "serie": j["pct"],
    }


# ------------------------------------------------------------------- montagem
LINHAS = (
    # codigo, rotulo, moeda
    ("IBOV", "Ibovespa", "R$"),
    ("IBOV_USD", "Ibovespa", "US$"),
    ("SP500", "S&P 500", "US$"),
    ("SP500_BRL", "S&P 500", "R$"),
    ("NASDAQ", "Nasdaq Composite", "US$"),
    ("NASDAQ_BRL", "Nasdaq Composite", "R$"),
    ("BTC", "Bitcoin", "US$"),
    ("BTC_BRL", "Bitcoin", "R$"),
    ("USDBRL", "Dolar (PTAX venda)", "R$/US$"),
)
# Ativos cotados em R$ -> Sharpe contra o CDI faz sentido.
EM_REAIS = {"IBOV", "SP500_BRL", "NASDAQ_BRL", "BTC_BRL", "USDBRL"}


def series_base(markets: dict, ptax: pd.Series) -> dict:
    """Constroi todas as series usadas nas linhas (todas em dias uteis)."""
    sp = dias_uteis(para_serie(markets.get("sp500")))
    nq = dias_uteis(para_serie(markets.get("nasdaq")))
    ib = dias_uteis(para_serie(markets.get("ibov")))
    bt = dias_uteis(para_serie(markets.get("btc")))
    return {
        "IBOV": ib,
        "IBOV_USD": converter(ib, ptax, "USD"),
        "SP500": sp, "SP500_BRL": converter(sp, ptax, "BRL"),
        "NASDAQ": nq, "NASDAQ_BRL": converter(nq, ptax, "BRL"),
        "BTC": bt, "BTC_BRL": converter(bt, ptax, "BRL"),
        "USDBRL": ptax,
    }


def linha(codigo, rotulo, moeda, s, cdi, as_of):
    ret = {}
    for nome, m in JANELAS_MESES.items():
        r = retorno_janela(s, as_of, meses=m)
        ret[nome] = None if r is None else _arred(r["pct"])
    r = retorno_janela(s, as_of, ytd=True)
    ret["YTD"] = None if r is None else _arred(r["pct"])
    vol = {n: _arred(vol_anualizada(s, as_of, k)) for n, k in JANELAS_VOL.items()}
    dd = drawdown_janela(s, as_of, 12)
    ate_s = ate(s, as_of)
    sharpe = sharpe_ex_post(s, cdi, as_of) if codigo in EM_REAIS else None
    ext = extremos(s, as_of)
    return {
        "codigo": codigo, "rotulo": rotulo, "moeda": moeda,
        "ref": _iso(ate_s.index[-1]) if len(ate_s) else None,
        "ret": ret, "vol": vol,
        "dd12m": None if dd is None else {
            "max": _arred(dd["max_pct"]), "vale": _iso(dd["vale"]), "atual": _arred(dd["atual_pct"])},
        "sharpe_12m": _arred(sharpe),
        "extremos_12m": None if ext is None else {
            k: {"pct": _arred(v["pct"]), "data": _iso(v["data"])} for k, v in ext.items()},
    }


def build(markets: dict, ptax_pts: list, cdi_pts: list, ipca_pts: list,
          ind_pts: list, curva_info: dict, as_of: str) -> dict:
    """Monta o payload de docs/data/analytics.json. `as_of` = ultimo pregao B3."""
    ptax, cdi, ipca = para_serie(ptax_pts), para_serie(cdi_pts), para_serie(ipca_pts)
    s = series_base(markets, ptax)

    linhas = [linha(c, r, m, s[c], cdi, as_of) for c, r, m in LINHAS]

    # CDI na mesma base de datas do Ibovespa (mesmo calendario de pregao BR)
    cdi_ret = {}
    for nome, m in JANELAS_MESES.items():
        r = retorno_janela(s["IBOV"], as_of, meses=m)
        cdi_ret[nome] = None if r is None else _arred(cdi_entre(cdi, r["base"], r["ref"]))
    r = retorno_janela(s["IBOV"], as_of, ytd=True)
    cdi_ret["YTD"] = None if r is None else _arred(cdi_entre(cdi, r["base"], r["ref"]))

    # excesso sobre o CDI (p.p., aritmetico) nas janelas ja calculadas
    for item in linhas:
        if item["codigo"] in EM_REAIS:
            item["excesso_cdi"] = {k: (None if item["ret"][k] is None or cdi_ret[k] is None
                                       else _arred(item["ret"][k] - cdi_ret[k])) for k in item["ret"]}

    corr_series = {k: s[k] for k in ("IBOV", "SP500", "NASDAQ", "BTC")}
    correl = {str(n): correlacao(corr_series, as_of, n) for n in JANELAS_CORR}

    jr = juro_real(cdi, ipca)
    ca = cdi_anualizado(cdi)
    base = base_indice(ind_pts, s["IBOV"])

    corte = pd.Timestamp(as_of) - pd.DateOffset(years=ANOS_SERIES_GRAFICO)
    dd_series = {c: pontos(drawdown(s[c])[lambda x: x.index >= corte] * 100, 2)
                 for c in ("IBOV", "SP500", "NASDAQ", "BTC")}
    ibov_brl_usd = {
        "R$": pontos(s["IBOV"][s["IBOV"].index >= corte]),
        "US$": pontos(s["IBOV_USD"][s["IBOV_USD"].index >= corte]),
    }

    return {
        "as_of": as_of,
        "linhas": linhas,
        "cdi": {"ret": cdi_ret, "ate": _iso(cdi.index[-1]) if len(cdi) else None,
                "anualizado_atual": None if ca is None else {"pct": _arred(ca["pct"]), "data": _iso(ca["data"])}},
        "correlacao": correl,
        "juro_real": None if jr is None else {
            "cdi_12m": _arred(jr["cdi_12m"]), "ipca_12m": _arred(jr["ipca_12m"]),
            "real_12m": _arred(jr["real_12m"]),
            "janela_ini": _iso(jr["janela_ini"]), "janela_fim": _iso(jr["janela_fim"])},
        "curva": _curva_json(curva_prazos(curva_info)),
        "base_ind": None if base is None else {
            "ultimo": {**{k: _arred(v) if isinstance(v, float) else v
                          for k, v in base["ultimo"].items() if k != "date"},
                       "date": _iso(base["ultimo"]["date"])},
            "serie": pontos(base["serie"][base["serie"].index >= corte], 3)},
        "series": {"drawdown": dd_series, "ibov_brl_usd": ibov_brl_usd},
    }


def _curva_json(c):
    if c is None:
        return None
    return {
        "ref": c["ref"], "ref_old": c["ref_old"],
        "prazos": [{"anos": p["anos"], "atual": _arred(p["atual"], 3), "antes": _arred(p["antes"], 3),
                    "var_bp": _arred(p["var_bp"], 1)} for p in c["prazos"]],
        "inclinacao_3a_1a_bp": {k: _arred(v, 1) for k, v in c["inclinacao_3a_1a_bp"].items()},
        "inclinacao_10a_1a_bp": {k: _arred(v, 1) for k, v in c["inclinacao_10a_1a_bp"].items()},
    }
