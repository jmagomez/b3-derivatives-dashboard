"""Atualizacao diaria: busca dados novos e reconstroi o site + e-mail."""
import datetime as dt

import fetch_b3
import fetch_bcb
import fetch_options
import build_site
import build_email

if __name__ == "__main__":
    today = dt.date.today()
    # janela de seguranca de 10 dias p/ recuperar falhas anteriores
    fetch_b3.update_range(today - dt.timedelta(days=10), today)
    fetch_bcb.update()
    fetch_options.update()
    build_site.main()
    build_email.main()
