// Exportação do dashboard em PDF, do jeito que ele aparece na tela.
//
// Os gráficos são CSS e SVG com as cores dos tokens de `.dash`, então
// redesenhar tudo no jsPDF seria refazer o dashboard. Em vez disso a página é
// fotografada (html-to-image, que usa o próprio motor do navegador) e colada
// em A4.
//
// Uma foto só, corrida, e não um bloco por vez: bloco que não coubesse no fim
// da página pulava inteiro para a seguinte e deixava um buraco. Aqui a folha é
// sempre preenchida, e o corte procura o melhor lugar perto do fim dela — o
// vão entre dois blocos, senão uma linha em branco dentro do cartão (entre
// duas barras de um ranking, por exemplo), para não passar no meio de texto.

/** Marca o que fica fora do PDF: botões, abas, seletor de período. */
export const PDF_IGNORAR = 'data-pdf-ignorar'

const MARGEM    = 10    // mm
const RODAPE    = 7     // mm reservados para o rodapé
const RESOLUCAO = 2     // pixels por pixel de tela: nítido sem estourar a memória
const RECUO_VAO = 0.35  // até quanto da folha se recua para cortar num vão entre blocos
const RECUO_LINHA = 0.2 // idem, para cortar numa linha em branco

export async function exportarDashboardPDF(raiz: HTMLElement) {
  const [{ jsPDF }, { toCanvas, getFontEmbedCSS }] = await Promise.all([
    import('jspdf'),
    import('html-to-image'),
  ])

  // Na tela, o que aparece atrás dos cartões é o gradiente do app, não o
  // `--bg` do dashboard (no escuro ele é `transparent`). O PDF precisa de uma
  // cor sólida: a do tom predominante do gradiente em cada tema.
  const escuro = document.documentElement.classList.contains('dark')
  const fundo  = escuro ? '#0F1226' : '#FFFFFF'
  const tinta  = getComputedStyle(raiz).getPropertyValue('--ink-3').trim() || '#8a8c94'

  // A foto é tirada de uma cópia fora da tela, sem os botões e as abas. Tirá-los
  // da página de verdade fazia os controles sumirem enquanto o PDF era gerado;
  // e removê-los só na foto (filtro do html-to-image) deslocaria o layout em
  // relação às posições medidas abaixo. Na cópia, medida e foto batem.
  const palco = document.createElement('div')
  palco.style.cssText = `position: fixed; left: -100000px; top: 0; width: ${raiz.offsetWidth}px; pointer-events: none;`
  const copia = raiz.cloneNode(true) as HTMLElement
  copia.querySelectorAll(`[${PDF_IGNORAR}]`).forEach(el => el.remove())
  palco.appendChild(copia)
  document.body.appendChild(palco)

  let canvas: HTMLCanvasElement
  let vaos: number[]
  try {
    // Vãos entre os blocos da página (seções, cabeçalho), em pixels da foto.
    const topo = copia.getBoundingClientRect().top
    const blocos = [...copia.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.offsetHeight > 0,
    )
    vaos = blocos.slice(1).map((el, i) => {
      const fimAnterior = blocos[i].getBoundingClientRect().bottom - topo
      const inicio      = el.getBoundingClientRect().top - topo
      return Math.round(((fimAnterior + inicio) / 2) * RESOLUCAO)
    })

    // As fontes (Google Fonts) entram embutidas; sem isso a foto sai com a
    // fonte padrão do sistema.
    const fontEmbedCSS = await getFontEmbedCSS(copia).catch(() => undefined)
    canvas = await toCanvas(copia, { pixelRatio: RESOLUCAO, backgroundColor: fundo, fontEmbedCSS })
  } finally {
    palco.remove()
  }

  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const largPag  = doc.internal.pageSize.getWidth()
  const altPag   = doc.internal.pageSize.getHeight()
  const largUtil = largPag - MARGEM * 2
  const mmPorPx  = largUtil / canvas.width
  const folhaPx  = Math.floor((altPag - MARGEM * 2 - RODAPE) / mmPorPx)

  const linhaLimpa = criarDetectorDeLinha(canvas)

  /** Onde cortar a folha que começa em `origem`. */
  function corte(origem: number): number {
    const alvo = origem + folhaPx
    if (alvo >= canvas.height) return canvas.height
    // 1º o vão entre blocos mais baixo que caiba na folha
    const vao = vaos.filter(v => v > alvo - folhaPx * RECUO_VAO && v <= alvo).pop()
    if (vao !== undefined) return vao
    // 2º uma linha em branco, subindo a partir do fim da folha
    for (let y = alvo; y > alvo - folhaPx * RECUO_LINHA; y--) {
      if (linhaLimpa(y)) return y
    }
    return alvo
  }

  let origem = 0
  let primeira = true
  while (origem < canvas.height) {
    const fim = corte(origem)
    if (!primeira) doc.addPage()
    primeira = false
    doc.setFillColor(fundo)
    doc.rect(0, 0, largPag, altPag, 'F')

    const fatia = document.createElement('canvas')
    fatia.width  = canvas.width
    fatia.height = fim - origem
    fatia.getContext('2d')!.drawImage(canvas, 0, origem, canvas.width, fim - origem, 0, 0, canvas.width, fim - origem)
    doc.addImage(fatia, 'JPEG', MARGEM, MARGEM, largUtil, (fim - origem) * mmPorPx)
    origem = fim
  }

  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const paginas  = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(tinta)
    doc.text(`Dashboard · gerado em ${geradoEm}`, MARGEM, altPag - MARGEM + 2)
    doc.text(`${p}/${paginas}`, largPag - MARGEM, altPag - MARGEM + 2, { align: 'right' })
  }

  doc.save(`dashboard-${new Date().toISOString().slice(0, 10)}.pdf`)
}

/**
 * Uma linha da imagem é "em branco" quando quase não muda de cor ao longo da
 * largura: só as bordas dos cartões e as trocas de fundo. Texto e barras
 * produzem dezenas de trocas.
 */
function criarDetectorDeLinha(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const PASSO = 2
  const MAX_TROCAS = 10
  return (y: number) => {
    const px = ctx.getImageData(0, y, canvas.width, 1).data
    let trocas = 0
    for (let x = PASSO * 4; x < px.length; x += PASSO * 4) {
      const d = Math.abs(px[x] - px[x - PASSO * 4])
              + Math.abs(px[x + 1] - px[x + 1 - PASSO * 4])
              + Math.abs(px[x + 2] - px[x + 2 - PASSO * 4])
      if (d > 30 && ++trocas > MAX_TROCAS) return false
    }
    return true
  }
}
