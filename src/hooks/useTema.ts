import { useCallback, useEffect, useState } from 'react'

export type Tema = 'claro' | 'escuro'

const CHAVE = 'tema'

/** O que está gravado, ou nada se o usuário nunca escolheu. */
function temaSalvo(): Tema | null {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'claro' || v === 'escuro' ? v : null
  } catch {
    // Navegação privada com storage bloqueado: cai na preferência do sistema.
    return null
  }
}

function temaDoSistema(): Tema {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

export function temaInicial(): Tema {
  return temaSalvo() ?? temaDoSistema()
}

/** O Tailwind está em `darkMode: 'class'` — quem manda é a classe no <html>. */
export function aplicarTema(tema: Tema) {
  document.documentElement.classList.toggle('dark', tema === 'escuro')
}

/**
 * Tema da aplicação.
 *
 * O app inteiro já tinha estilos `dark:`, mas ninguém punha a classe — eles
 * nunca chegavam a valer. A escolha fica no localStorage; sem escolha, segue
 * a preferência do sistema, e continua seguindo enquanto o usuário não
 * decidir por conta própria.
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  // Enquanto não houver escolha explícita, acompanha o sistema em tempo real.
  useEffect(() => {
    if (temaSalvo()) return
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const ouvir = (e: MediaQueryListEvent) => setTema(e.matches ? 'escuro' : 'claro')
    mq.addEventListener('change', ouvir)
    return () => mq.removeEventListener('change', ouvir)
  }, [])

  const alternar = useCallback(() => {
    setTema(atual => {
      const proximo: Tema = atual === 'escuro' ? 'claro' : 'escuro'
      try { localStorage.setItem(CHAVE, proximo) } catch { /* sem storage, vale só nesta sessão */ }
      return proximo
    })
  }, [])

  return { tema, alternar }
}
