import { useCallback, useEffect, useState } from 'react';

export type Tema = 'light' | 'dark';

const CHAVE = 'tema';

function temaInicial(): Tema {
  // O script bloqueante do index.html ja aplicou a classe antes do primeiro
  // paint; aqui so lemos o que ele decidiu, para nao divergir.
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Tema sem `next-themes`, que e desenhado para o ciclo de vida do Next.
 * Alterna a classe `dark` no <html>, persiste a escolha e acompanha o sistema
 * enquanto o usuario nao escolher explicitamente.
 */
export function useTheme() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark');
    try {
      localStorage.setItem(CHAVE, tema);
    } catch {
      /* modo privado / storage bloqueado: o tema ainda vale nesta sessao */
    }
  }, [tema]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = (e: MediaQueryListEvent) => {
      // So segue o sistema se o usuario nunca escolheu a mao.
      let escolheu = false;
      try {
        escolheu = localStorage.getItem(CHAVE) !== null;
      } catch {
        escolheu = false;
      }
      if (!escolheu) setTema(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  const alternar = useCallback(() => {
    setTema((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { tema, alternar } as const;
}
