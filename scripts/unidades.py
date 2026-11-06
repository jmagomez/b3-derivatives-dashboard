"""Fonte unica de verdade da unidade em que a variacao diaria de cada contrato e medida.

POR QUE ESTE MODULO EXISTE

Os contratos cobertos pelo dashboard se dividem em dois regimes de cotacao:

  TAXA   DI1 e FRC. O ajuste E uma taxa anualizada, em % a.a. A diferenca entre
         duas taxas se mede em pontos percentuais; a convencao de mesa de juros
         e expressa-la em basis points (1 bp = 0,01 p.p.), como em Treasuries,
         swaps e FRAs.

  PRECO  Todo o resto (dolar, Ibovespa, DDI, agricolas, petroleo, indices
         globais, bitcoin). O ajuste e um preco, PU ou pontos de indice, e a
         variacao e relativa, em %.

Confundir os dois produz um numero falso que parece certo. No fechamento de
05/11/2026 o DI foi de 14,328 para 14,212:

    diferenca  = -0,116 p.p.  = -11,6 bps     <- o que a mesa le
    relativa   = -0,81%                        <- outro numero, outra pergunta

Exibir "-0,12%" afirma que a taxa caiu 0,12% do seu valor. Ela caiu 0,81%.

POR QUE NUM MODULO, E NAO NUMA CONSTANTE LOCAL

Esta regra ja esteve escrita em tres lugares, e os tres ja tinham divergido:

    build_site.py    COTADOS_EM_TAXA = {"FRC"}  +  `code == "DI1"` a parte
    build_email.py   EM_PONTOS_PERCENTUAIS = {"DI1", "FRC"}
    docs/index.html  it.code==='DI1' || it.code==='FRC'

Note que o primeiro nem continha DI1 no conjunto -- tratava-o como caso
especial. Tres copias da mesma regra de negocio, com formatos diferentes, e
nenhuma forma de o CI perceber se uma delas deixasse de acompanhar as outras.

Agora a unidade e propriedade DO DADO: build_site.py grava `var_unit` em cada
item de summary.json, e e-mail e dashboard apenas leem e formatam. Um contrato
novo cotado em taxa entra aqui, num lugar so.

Mesmo espirito de fontes.py, que nasceu para matar uma divergencia de duas
copias entre build_email.py e docs/index.html.
"""

# Contratos cujo ajuste e uma taxa anualizada (% a.a.), e nao um preco.
COTADOS_EM_TAXA = frozenset({"DI1", "FRC"})

BPS = "bps"   # variacao = diferenca de taxa, em basis points
PCT = "pct"   # variacao = variacao relativa de preco, em %


def unidade_variacao(code: str) -> str:
    """Unidade em que a variacao diaria de `code` deve ser lida e exibida."""
    return BPS if code in COTADOS_EM_TAXA else PCT


def variacao(code: str, atual, anterior):
    """Variacao diaria de `code`, ja na unidade que `unidade_variacao` declara.

    Taxa  -> (atual - anterior) * 100, em bps, com 1 casa (o ajuste do DI tem 3
             decimais, entao 0,001 p.p. = 0,1 bp e a ultima casa e significativa).
    Preco -> (atual/anterior - 1) * 100, em %, com 2 casas.

    Devolve None quando falta ponto de comparacao ou quando o anterior e zero --
    nunca zero, que seria "nao mudou" e nao "nao sei".
    """
    if atual is None or anterior is None:
        return None
    if code in COTADOS_EM_TAXA:
        return round((atual - anterior) * 100.0, 1)
    if not anterior:
        return None
    return round((atual / anterior - 1) * 100.0, 2)


def formata(valor, unidade: str, *, sinal: bool = True) -> str:
    """Formata a variacao em pt-BR. Ex.: "-11,6 bps", "+1 bp", "+0,54%".

    Em bps o decimal so aparece quando existe: "+1 bp" em vez de "+1,0 bp".
    O singular "bp" vale so para exatamente 1 ponto-base.
    """
    if valor is None:
        return "—"
    s = f"{valor:+.2f}" if sinal else f"{valor:.2f}"
    if unidade == BPS:
        casas = 0 if float(valor) == int(valor) else 1
        s = f"{valor:+.{casas}f}" if sinal else f"{valor:.{casas}f}"
        rotulo = "bp" if abs(valor) == 1 else "bps"
        return f"{s} {rotulo}".replace(".", ",")
    return f"{s}%".replace(".", ",")
