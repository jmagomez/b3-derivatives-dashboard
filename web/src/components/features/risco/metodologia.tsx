import { Card, CardNote, CardTitle } from '@/components/ui/card';

/**
 * Por que este bloco existe, e por que ele e texto e nao tooltip:
 *
 * Para o IBOV em 06/11/2026 o payload traz, ao mesmo tempo, excesso sobre o
 * CDI de -4,28 p.p. em 12 meses e Sharpe de +0,02. Os dois numeros estao
 * certos e parecem se contradizer. Quem le um dashboard de derivativos sabe
 * ler Sharpe; nao tem por que adivinhar QUAL excesso esta no numerador.
 *
 * Deixar isso num tooltip seria esconder a unica informacao que impede o
 * leitor de concluir que um dos dois esta errado.
 */
export function Metodologia() {
  return (
    <Card className="p-4">
      <CardTitle>Como cada número é calculado</CardTitle>
      <dl className="mt-3 grid gap-3 text-sm">
        <div>
          <dt className="font-medium">Retorno</dt>
          <dd className="text-muted">
            Variação de preço composta na janela, em R$ para ativos locais e em US$ para os de fora.
            Não há reinvestimento de dividendos: é retorno de preço, não retorno total — para o
            Ibovespa isso não importa (o índice já é de retorno total), para o S&P 500 e o Nasdaq
            subestima o retorno do investidor.
          </dd>
        </div>
        <div>
          <dt className="font-medium">Volatilidade</dt>
          <dd className="text-muted">
            Desvio-padrão dos retornos diários logarítmicos, anualizado por √252. É volatilidade
            realizada, olhando para trás — não é implícita e não antecipa nada.
          </dd>
        </div>
        <div>
          <dt className="font-medium">Drawdown</dt>
          <dd className="text-muted">
            Queda sobre o máximo acumulado dentro da janela de 12 meses, em preços de fechamento. O
            máximo verdadeiro pode ter ocorrido antes da janela.
          </dd>
        </div>
        <div>
          <dt className="font-medium">Excesso sobre o CDI</dt>
          <dd className="text-muted">
            Retorno composto do ativo <i>menos</i> o CDI composto da mesma janela, em pontos
            percentuais. Só para ativos em R$ — comparar um ativo em US$ com o CDI mistura o prêmio
            de risco com a variação do câmbio.
          </dd>
        </div>
        <div>
          <dt className="font-medium">Sharpe (12m)</dt>
          <dd className="text-muted">
            Média <b>aritmética</b> dos excessos diários sobre o CDI, anualizada por 252, dividida
            pela volatilidade anualizada <b>desses excessos</b>. O numerador está na coluna
            &quot;excesso anualizado&quot; e <b>não é</b> o excesso composto da coluna ao lado: a
            diferença entre os dois é o <i>volatility drag</i> (≈ −σ²/2), que cresce com a
            volatilidade e pode inverter o sinal. Com vol de excessos perto de 24% a.a. o drag passa
            de 2,9 p.p. — basta isso para um excesso composto negativo conviver com um Sharpe
            positivo. Nenhum dos dois está errado; eles respondem a perguntas diferentes.
          </dd>
        </div>
        <div>
          <dt className="font-medium">Correlação</dt>
          <dd className="text-muted">
            Pearson sobre retornos diários logarítmicos, nas janelas de 63 e 252 dias úteis, usando
            apenas as datas em que <b>todos</b> os ativos negociaram. Isso descarta os fins de
            semana do bitcoin e os feriados que não coincidem — a correlação com o BTC é, por
            construção, só a dos dias em que a B3 e NY estavam abertas.
          </dd>
        </div>
        <div>
          <dt className="font-medium">Juro real</dt>
          <dd className="text-muted">
            Fisher exato — (1 + CDI) / (1 + IPCA) − 1 — não a subtração. A janela é a do IPCA
            fechado, que sai com cerca de um mês de defasagem, então ela termina antes da janela das
            outras colunas.
          </dd>
        </div>
      </dl>
      <CardNote className="mt-3">
        Tudo é <i>ex post</i>, calculado sobre o histórico publicado no próprio repositório. Nada
        aqui é projeção, recomendação ou medida de risco prospectivo.
      </CardNote>
    </Card>
  );
}
