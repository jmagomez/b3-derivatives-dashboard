"""Gera o corpo HTML do e-mail diario a partir de docs/data/summary.json."""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
SUMMARY = os.path.join(ROOT, "docs", "data", "summary.json")
OUT = os.path.join(ROOT, "email_body.html")

PAGES_URL = os.environ.get("PAGES_URL", "")

# Contratos cotados em taxa: a variacao vai em pontos percentuais, nao em %.
EM_PONTOS_PERCENTUAIS = {"DI1", "FRC"}

# Defasagem tolerada por fonte, em dias corridos.
LIMITES = {"b3": 4, "bcb": 5, "eia": 12, "markets": 4}
NOMES = {"b3": "contratos da B3", "bcb": "indicadores do BCB",
         "eia": "petroleo (EIA)", "markets": "indices globais/BTC"}


def fmt(v):
    if v is None:
        return "-"
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_date(iso):
    if not iso:
        return "-"
    s = str(iso)
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return f"{s[8:10]}/{s[5:7]}/{s[0:4]}"
    return s


def main():
    with open(SUMMARY) as f:
        s = json.load(f)
    last = s.get("last_date", "-")
    rows = []
    for it in s.get("items", []):
        var = it.get("var_pct")
        color = "#666" if var is None else ("#0a7a2f" if var >= 0 else "#c0392b")
        suffix = " p.p." if it["code"] in EM_PONTOS_PERCENTUAIS else "%"
        var_txt = "-" if var is None else f"{var:+.2f}{suffix}".replace(".", ",")
        rows.append(
            f"<tr><td style='padding:6px 10px;border-bottom:1px solid #eee'>{it['label']}"
            f" <span style='color:#999;font-size:12px'>({it.get('venc') or ''})</span></td>"
            f"<td style='padding:6px 10px;border-bottom:1px solid #eee;text-align:right'>{fmt(it['value'])}</td>"
            f"<td style='padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:{color}'>{var_txt}</td>"
            f"<td style='padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#999;font-size:12px'>{fmt_date(it.get('date'))}</td></tr>"
        )
    link = f"<p><a href='{PAGES_URL}' style='color:#1a56db'>Abrir dashboard completo</a></p>" if PAGES_URL else ""

    # Aviso de defasagem: sem isso o e-mail diario apresenta o ultimo fechamento
    # bom como se fosse o de hoje, e uma quebra na coleta passa semanas sem ser
    # notada.
    atrasadas = [
        f"{NOMES.get(k, k)} parado em {fmt_date(v.get('last_date'))} ({v.get('dias')} dias)"
        for k, v in sorted(s.get("frescor", {}).items())
        if v.get("dias") is not None and v["dias"] > LIMITES.get(k, 7)
    ]
    aviso = ""
    if atrasadas:
        aviso = (
            "<div style='background:#fdecea;border:1px solid #f5c6cb;color:#8a1c1c;"
            "padding:10px 12px;border-radius:6px;margin:0 0 14px;font-size:13px;line-height:1.5'>"
            "<b>Atencao: dados possivelmente defasados.</b><br>"
            + "<br>".join(atrasadas)
            + "<br>Os valores abaixo sao o ultimo fechamento disponivel de cada fonte, "
            "nao necessariamente o de hoje.</div>"
        )
    html = f"""
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px">
  <h2 style="margin-bottom:4px">Derivativos B3 — fechamento {last}</h2>
  {aviso}
  <p style="color:#666;margin-top:0">Precos de ajuste dos principais contratos futuros (fonte: B3), mais indices globais e bitcoin (Yahoo). Cada linha mostra sua propria data de referencia, pois as fontes (B3, BCB, EIA, Yahoo) publicam com atrasos diferentes.</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <tr style="background:#f5f5f5">
      <th style="padding:6px 10px;text-align:left">Contrato</th>
      <th style="padding:6px 10px;text-align:right">Ajuste</th>
      <th style="padding:6px 10px;text-align:right">Var. d/d</th>
      <th style="padding:6px 10px;text-align:right">Ref.</th>
    </tr>
    {''.join(rows)}
  </table>
  {link}
  <p style="color:#999;font-size:12px">Gerado automaticamente em {s.get('generated_at','')}. Dados desde 01/01/2020.</p>
</div>
"""
    with open(OUT, "w") as f:
        f.write(html)
    print(f"[build_email] {OUT} gerado ({len(rows)} linhas)")


if __name__ == "__main__":
    main()
