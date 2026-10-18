"""Fonte unica de verdade das fontes de dados monitoradas: rotulo e defasagem tolerada.

Antes, esses limites e nomes eram redefinidos em build_email.py E em docs/index.html
(duas copias que podiam divergir). Agora build_site.py grava `nome` e `limite` em cada
entrada de `summary.json["frescor"]`, e e-mail e dashboard apenas leem.

Chaves: b3, bcb, eia, markets (S&P 500/Nasdaq/Ibovespa) e btc (rastreado a parte
porque negocia fim de semana -- ver README, "Bitcoin: card de resumo vs. grafico").
Limite = dias corridos tolerados antes de acusar atraso.
"""
FONTES = {
    "b3": ("contratos da B3", 4),
    "bcb": ("indicadores do BCB", 5),
    "eia": ("petroleo (EIA)", 12),
    "markets": ("S&P 500/Nasdaq/Ibovespa (Yahoo)", 4),
    "btc": ("Bitcoin (Yahoo)", 4),
}
LIMITE_PADRAO = 7  # fonte desconhecida
