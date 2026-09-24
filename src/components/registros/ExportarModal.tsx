import { useEffect, useState } from 'react'
import { AlertCircle, FileSpreadsheet, FileText, Loader2, RotateCcw } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import type { RegistroDetalhado } from '@/types/database.types'
import { FILTROS_VAZIOS, descreverFiltros, montarQuery, type Filtros } from './consulta'
import { FiltrosCampos } from './FiltrosCampos'
import { baixarCSV, baixarPDF } from './exportacao'

const EXPORT_MAX = 5000

type Formato = 'pdf' | 'csv'

interface Props {
  open:        boolean
  onClose:     () => void
  /** Os filtros da tabela no momento em que o popup abre */
  iniciais:    Filtros
  cidadeOpts:  string[]
  vinculoOpts: string[]
}

export function ExportarModal({ open, onClose, iniciais, cidadeOpts, vinculoOpts }: Props) {
  const [filtros,    setFiltros]    = useState<Filtros>(iniciais)
  const [total,      setTotal]      = useState<number | null>(null)
  const [exportando, setExportando] = useState<Formato | null>(null)
  const [erro,       setErro]       = useState<string | null>(null)

  // Cada abertura parte do que está filtrado na tabela
  useEffect(() => {
    if (!open) return
    setFiltros(iniciais)
    setErro(null)
  }, [open, iniciais])

  // Prévia de quantos registros saem, com debounce por causa da busca
  useEffect(() => {
    if (!open) return
    setTotal(null)
    let cancelado = false
    const t = setTimeout(async () => {
      const { count, error } = await montarQuery(filtros, true).range(0, 0)
      if (cancelado) return
      if (error) { setErro(error.message); return }
      setTotal(count ?? 0)
    }, 350)
    return () => { cancelado = true; clearTimeout(t) }
  }, [open, filtros])

  const temFiltro = Object.values(filtros).some(Boolean)

  function aplicar(patch: Partial<Filtros>) {
    setFiltros(f => ({ ...f, ...patch }))
  }

  async function exportar(formato: Formato) {
    setExportando(formato)
    setErro(null)
    try {
      const { data, error } = await montarQuery(filtros, false).range(0, EXPORT_MAX - 1)
      if (error) throw new Error(error.message)
      const linhas = (data as RegistroDetalhado[]) ?? []
      if (formato === 'pdf') await baixarPDF(linhas, descreverFiltros(filtros))
      else                   baixarCSV(linhas)
      onClose()
    } catch (e) {
      setErro(`Falha ao exportar: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExportando(null)
    }
  }

  const vazio = total === 0

  return (
    <Modal open={open} onClose={onClose} title="Exportar registros" maxWidth="xl">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Escolha os filtros do que vai para o arquivo. Eles começam iguais aos da lista.
      </p>

      <FiltrosCampos
        filtros={filtros}
        onChange={aplicar}
        busca={filtros.busca}
        onBusca={v => aplicar({ busca: v })}
        cidadeOpts={cidadeOpts}
        vinculoOpts={vinculoOpts}
        comRotulos
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      />

      {/* Prévia */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl
                      bg-slate-100/70 dark:bg-white/[0.06] text-sm">
        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          {total === null ? (
            <><Loader2 size={14} className="animate-spin" /> Contando registros...</>
          ) : (
            <>
              <strong className="text-slate-800 dark:text-slate-100 tabular-nums">
                {total.toLocaleString('pt-BR')}
              </strong>
              {total === 1 ? 'registro será exportado' : 'registros serão exportados'}
            </>
          )}
        </span>
        {temFiltro && (
          <Button
            variant="ghost" size="sm"
            icon={<RotateCcw size={14} />}
            onClick={() => setFiltros(FILTROS_VAZIOS)}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {total !== null && total > EXPORT_MAX && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          O arquivo leva só os {EXPORT_MAX.toLocaleString('pt-BR')} mais recentes. Refine os filtros para pegar o resto.
        </p>
      )}

      {erro && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20
                        text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {erro}
        </div>
      )}

      {/* Ações */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={exportando !== null}>
          Cancelar
        </Button>
        <Button
          variant="secondary"
          icon={<FileSpreadsheet size={16} />}
          loading={exportando === 'csv'}
          disabled={vazio || exportando !== null}
          onClick={() => exportar('csv')}
        >
          Exportar CSV
        </Button>
        <Button
          icon={<FileText size={16} />}
          loading={exportando === 'pdf'}
          disabled={vazio || exportando !== null}
          onClick={() => exportar('pdf')}
        >
          Exportar PDF
        </Button>
      </div>
    </Modal>
  )
}
