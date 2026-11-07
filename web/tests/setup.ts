import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom nao implementa matchMedia, e use-theme depende dele. Sem este stub
// qualquer teste que monte a App estoura antes da primeira assercao.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Recharts mede o container pelo ResizeObserver, que o jsdom nao implementa.
// Sem este stub qualquer teste que monte um grafico estoura em
// "ResizeObserver is not defined" -- mesmo caso do matchMedia acima.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
globalThis.ResizeObserver = ResizeObserverStub;
