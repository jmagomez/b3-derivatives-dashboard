/**
 * Unica camada que fala HTTP. Centraliza o caminho base, timeout e a mensagem
 * de erro -- um componente nunca chama fetch.
 */

export class ErroDeDados extends Error {
  constructor(
    message: string,
    readonly arquivo: string,
    readonly causa?: unknown,
  ) {
    super(message);
    this.name = 'ErroDeDados';
  }
}

/**
 * Em producao o app vive em /<repo>/ e os JSON em /<repo>/data/. `BASE_URL` e
 * injetado pelo Vite a partir de `base` (ver vite.config.ts); usar caminho
 * absoluto "/data/..." quebraria no subdiretorio do GitHub Pages.
 */
const BASE = import.meta.env.BASE_URL;

const TIMEOUT_MS = 15_000;

export async function buscaJson(arquivo: string): Promise<unknown> {
  const url = `${BASE}data/${arquivo}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(url, { signal: controller.signal });
    if (!resposta.ok) {
      throw new ErroDeDados(`${arquivo}: servidor respondeu ${resposta.status}`, arquivo);
    }
    return (await resposta.json()) as unknown;
  } catch (erro) {
    if (erro instanceof ErroDeDados) throw erro;
    if (erro instanceof DOMException && erro.name === 'AbortError') {
      throw new ErroDeDados(`${arquivo}: tempo esgotado`, arquivo, erro);
    }
    throw new ErroDeDados(`${arquivo}: falha ao carregar`, arquivo, erro);
  } finally {
    clearTimeout(timer);
  }
}
