import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';

export function ThemeToggle() {
  const { tema, alternar } = useTheme();
  const indo = tema === 'dark' ? 'claro' : 'escuro';

  return (
    <button
      type="button"
      onClick={alternar}
      // O rotulo diz o que o botao FAZ, nao o estado atual: leitor de tela
      // anuncia a acao, que e o que o usuario precisa decidir.
      aria-label={`Mudar para o tema ${indo}`}
      title={`Mudar para o tema ${indo}`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors duration-theme hover:text-fg"
    >
      {tema === 'dark' ? <Sun aria-hidden className="h-4 w-4" /> : <Moon aria-hidden className="h-4 w-4" />}
    </button>
  );
}
