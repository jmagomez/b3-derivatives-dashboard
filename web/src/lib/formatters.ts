/**
 * Formatadores de exibicao. Puros: recebem valor, devolvem string. Nao decidem
 * unidade e nao calculam indicador -- isso e do pipeline (invariante 7).
 */

const nf2 = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Numero no padrao pt-BR, com 2 casas. */
export function numero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return nf2.format(valor);
}

/** Data ISO (AAAA-MM-DD) -> DD/MM/AAAA. Nao usa Date: evita fuso. */
export function data(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length < 10 || s[4] !== '-' || s[7] !== '-') return s;
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

/**
 * Dias uteis entre duas datas ISO (exclusivo na primeira, inclusivo na
 * segunda). Nao considera feriados -- so fins de semana, igual ao pipeline
 * (ver docstring de ultimo_dia_util em build_site.py). Serve para o selo de
 * defasagem, onde 1 dia de erro em feriado e aceitavel.
 */
export function diasUteisEntre(deISO: string, ateISO: string): number {
  const de = new Date(`${deISO}T00:00:00Z`);
  const ate = new Date(`${ateISO}T00:00:00Z`);
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime()) || de >= ate) return 0;
  let n = 0;
  const cursor = new Date(de);
  while (cursor < ate) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dia = cursor.getUTCDay();
    if (dia !== 0 && dia !== 6) n += 1;
  }
  return n;
}
