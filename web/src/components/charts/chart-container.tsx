import type { ReactNode } from 'react';
import { Card, CardTitle, CardNote } from '@/components/ui/card';

interface Props {
  titulo: string;
  /** `| undefined` explicito por causa de exactOptionalPropertyTypes: a flag
      distingue "propriedade ausente" de "propriedade com valor undefined", e
      quem repassa uma variavel opcional precisa do segundo. */
  nota?: string | undefined;
  /** Frase que descreve o que o grafico mostra, para leitor de tela. */
  descricao: string;
  children: ReactNode;
  tabela?: ReactNode | undefined;
}

/**
 * Moldura comum dos graficos: titulo, nota de metodologia, rotulo acessivel e
 * a tabela equivalente logo abaixo.
 *
 * `role="img"` + `aria-label` no wrapper do SVG: sem isso o leitor de tela
 * atravessa dezenas de <path> sem nenhum significado. Com isso, anuncia uma
 * frase e segue para a tabela, que tem o dado.
 */
export function ChartContainer({ titulo, nota, descricao, children, tabela }: Props) {
  return (
    <Card>
      <CardTitle>{titulo}</CardTitle>
      {nota && <CardNote className="mt-0.5">{nota}</CardNote>}
      <div role="img" aria-label={descricao} className="mt-3 h-64 w-full">
        {children}
      </div>
      {tabela}
    </Card>
  );
}
