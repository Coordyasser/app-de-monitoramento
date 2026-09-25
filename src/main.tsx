import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Cada deploy troca o nome dos arquivos em /assets. Uma aba aberta antes do
// deploy ainda pede os nomes antigos quando carrega algo sob demanda (o jsPDF
// da exportação), e eles não existem mais. Recarregar busca a versão nova.
// A marca na sessão evita recarregar em laço se o arquivo faltar de verdade.
window.addEventListener('vite:preloadError', () => {
  const CHAVE = 'recarregado-por-deploy'
  try {
    const ultimo = Number(sessionStorage.getItem(CHAVE) ?? 0)
    if (Date.now() - ultimo < 30_000) return
    sessionStorage.setItem(CHAVE, String(Date.now()))
  } catch {
    // Sem sessionStorage, recarrega mesmo assim: o laço é o caso improvável.
  }
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
