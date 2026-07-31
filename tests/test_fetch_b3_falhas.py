"""A B3 as vezes responde HTTP 200 com uma pagina HTML em vez do CSV.

Antes esse caso caia no mesmo balde de "nao houve pregao": fetch_day devolvia
(None, None) e o dia era contado como vazio. O resultado foram buracos
silenciosos no historico. Estes testes travam a distincao entre as duas situacoes.
"""
import datetime as dt
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import fetch_b3  # noqa: E402

DIA = dt.date(2026, 7, 28)

CSV_OK = (
    b"Status do Arquivo: Final\n"
    b"RptDt;TckrSymb;ISIN;SgmtNm;MinPric;MaxPric;TradAvrgPric;LastPric;OscnPctg;"
    b"AdjstdQt;AdjstdQtTax;RefPric;TradQty;FinInstrmQty;NtlFinVol\n"
    b"2026-07-28;DI1F27;X;FUT;0;0;0;0;-0,10;100000;14,05;0;10;1000;123456\n"
)
PAGINA_HTML = b"<!DOCTYPE html><html><body>" + b"x" * 500 + b"</body></html>"


class RespFake:
    def __init__(self, content=b"", ctype="application/json", payload=None, status=200):
        self.content = content
        self.headers = {"Content-Type": ctype}
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        if self._payload is None:
            raise ValueError("nao e JSON")
        return self._payload


class SessaoFake:
    """Roteiro: primeiro requestname, depois o download."""

    def __init__(self, requestname, download=None):
        self.requestname = requestname
        self.download = download
        self.chamadas = 0

    def get(self, url, **kw):
        self.chamadas += 1
        if url.endswith("/requestname"):
            return self.requestname
        return self.download


def test_html_em_requestname_e_falha_nao_ausencia():
    sess = SessaoFake(RespFake(content=PAGINA_HTML, ctype="text/html"))
    with pytest.raises(fetch_b3.FalhaFonte):
        fetch_b3.fetch_day(DIA, session=sess, retries=1)


def test_sem_redirecturl_e_arquivo_indisponivel():
    sess = SessaoFake(RespFake(payload={}, ctype="application/json"))
    with pytest.raises(fetch_b3.ArquivoIndisponivel):
        fetch_b3.fetch_day(DIA, session=sess, retries=1)


def test_download_sem_assinatura_e_falha():
    sess = SessaoFake(
        RespFake(payload={"redirectUrl": "~/download?token=abc"}),
        RespFake(content=PAGINA_HTML, ctype="text/html"),
    )
    with pytest.raises(fetch_b3.FalhaFonte):
        fetch_b3.fetch_day(DIA, session=sess, retries=1)


def test_csv_valido_e_parseado():
    sess = SessaoFake(
        RespFake(payload={"redirectUrl": "~/download?token=abc"}),
        RespFake(content=CSV_OK, ctype="text/csv"),
    )
    fut, opc = fetch_b3.fetch_day(DIA, session=sess, retries=1)
    assert len(fut) == 1
    linha = fut.iloc[0]
    assert linha["codigo"] == "DI1" and linha["vencimento"] == "F27"
    assert linha["taxa"] == pytest.approx(14.05)
    assert linha["ajuste_atual"] == pytest.approx(100000)


def test_arquivo_indisponivel_nao_consome_retentativas():
    """Ausencia de arquivo e definitiva: nao faz sentido tentar 3x."""
    sess = SessaoFake(RespFake(payload={}, ctype="application/json"))
    with pytest.raises(fetch_b3.ArquivoIndisponivel):
        fetch_b3.fetch_day(DIA, session=sess, retries=3)
    assert sess.chamadas == 1
