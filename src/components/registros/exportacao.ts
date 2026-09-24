// Geração dos arquivos de exportação da lista de registros.

import { capitalizarLugar, exibirTexto } from '@/lib/texto'
import { situacaoEfetiva } from '@/lib/situacao'
import type { RegistroDetalhado } from '@/types/database.types'
import { descreverLocal, formatarData } from './consulta'

function nomeArquivo(extensao: string) {
  return `registros-${new Date().toISOString().slice(0, 10)}.${extensao}`
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

// ── CSV ────────────────────────────────────────────────────────────────────

export function baixarCSV(linhas: RegistroDetalhado[]) {
  const cabecalho = [
    'Nome', 'Contato', 'Título', 'Vínculo', 'Situação', 'Est', 'Cidade', 'Zona', 'Seção',
    'Local de votação', 'Localização validada', 'Observações', 'Registrado por', 'Data',
  ]
  const escapar = (v: unknown) => {
    const texto = v === null || v === undefined ? '' : String(v)
    return `"${texto.replace(/"/g, '""')}"`
  }
  const corpo = linhas.map(r => [
    r.nome, r.contato, r.titulo, r.vinculo, situacaoEfetiva(r) ?? '', r.est ?? '',
    capitalizarLugar(r.cidade), r.zona, r.secao,
    r.local_votacao ?? '', r.localizacao_validada ? 'Sim' : 'Não',
    r.observacoes ?? '', r.agente_nome ?? '', formatarData(r.created_at),
  ].map(escapar).join(';'))

  const conteudo = [cabecalho.map(escapar).join(';'), ...corpo].join('\r\n')
  // BOM para o Excel reconhecer o acento
  baixar(new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' }), nomeArquivo('csv'))
}

// ── PDF ────────────────────────────────────────────────────────────────────

/**
 * Tabela em A4 paisagem, com os filtros aplicados no cabeçalho para quem
 * receber o arquivo saber o recorte. O jsPDF só é carregado aqui, na hora de
 * exportar, para não pesar no carregamento da página.
 */
export async function baixarPDF(linhas: RegistroDetalhado[], filtros: string[]) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const margem = 12
  const largura = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(30, 41, 59)
  doc.text('Registros', margem, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  const total = `${linhas.length.toLocaleString('pt-BR')} ${linhas.length === 1 ? 'registro' : 'registros'}`
  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  doc.text(`${total} · gerado em ${geradoEm}`, margem, 22)

  const textoFiltros = filtros.length > 0 ? `Filtros: ${filtros.join(' · ')}` : 'Sem filtros'
  const linhasFiltro = doc.splitTextToSize(textoFiltros, largura - margem * 2) as string[]
  doc.text(linhasFiltro, margem, 27)

  autoTable(doc, {
    startY: 27 + linhasFiltro.length * 4 + 2,
    margin: { left: margem, right: margem, bottom: 14 },
    head:   [['Nome', 'Contato', 'Título', 'Vínculo', 'Situação', 'Est', 'Localização', 'Local de votação', 'Registrado por', 'Data']],
    body:   linhas.map(r => [
      r.nome,
      exibirTexto(r.contato),
      exibirTexto(r.titulo),
      exibirTexto(r.vinculo),
      situacaoEfetiva(r) ?? '—',
      r.est ?? '—',
      descreverLocal(r),
      r.local_votacao ?? '—',
      r.agente_nome ?? '—',
      formatarData(r.created_at),
    ]),
    styles:     { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak', textColor: [51, 65, 85] },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    columnStyles: {
      0: { cellWidth: 42 },
      4: { cellWidth: 18 },
      5: { cellWidth: 11 },
      9: { cellWidth: 22 },
    },
    didDrawPage: () => {
      const altura = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`Página ${doc.getNumberOfPages()}`, largura - margem, altura - 7, { align: 'right' })
    },
  })

  baixar(doc.output('blob'), nomeArquivo('pdf'))
}
