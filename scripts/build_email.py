"""Gera o corpo HTML do e-mail diario a partir de docs/data/summary.json."""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
SUMMARY = os.path.join(ROOT, "docs", "data", "summary.json")
OUT = os.path.join(ROOT, "email_body.html")

PAGES_URL = os.environ.get("PAGES_URL", "")


def fmt(v):
    if v is None:
        return "-"
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def main():
    with open(SUMMARY) as f:
        s = json.load(f)
    last = s.get("last_date", "-")
    rows = []
    for it in s.get("items", []):
        var = it.get("var_pct")
        color = "#666" if var is None else ("#0a7a2f" if var >= 0 else "#c0392b")
        suffix = " p.p." if it["code"] == "DI1" else "%"
        var_txt = "-" if var is None else f"{var:+.2f}{suffix}".replace(".", ",")
        rows.append(
            f"<tr><td style='padding:6px 10px;border-bottom:1px solid #eee'>{it['label']}"
            f" <span style='color:#999;font-size:12px'>({it.get('venc') or ''})</span></td>"
            f"<td style='padding:6px 10px;border-bottom:1px solid #eee;text-align:right'>{fmt(it['value'])}</td>"
            f"<td style='padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:{color}'>{var_txt}</td></tr>"
        )
    link = f"<p><a href='{PAGES_URL}' style='color:#1a56db'>Abrir dashboard completo</a></p>" if PAGES_URL else ""
    html = f"""
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px">
  <h2 style="margin-bottom:4px">Derivativos B3 — fechamento {last}</h2>
  <p style="color:#666;margin-top:0">Precos de ajuste dos principais contratos futuros (fonte: B3).</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <tr style="background:#f5f5f5">
      <th style="padding:6px 10px;text-align:left">Contrato</th>
      <th style="padding:6px 10px;text-align:right">Ajuste</th>
      <th style="padding:6px 10px;text-align:right">Var. d/d</th>
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
    if not rows:
        sys.exit(0)


if __name__ == "__main__":
    main()
