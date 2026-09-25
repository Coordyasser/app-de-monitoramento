import { useEffect, useState } from 'react'
import { AlertCircle, FileDown, RotateCcw } from 'lucide-react'
import { Button, Input, Modal, Select } from '@/components/ui'
import { FILTROS_EST } from '@/lib/est'
import { FILTRO_VAZIO, temFiltro, type FiltroDash } from './filtro'

interface Props {
  open:      boolean
  onClose:   () => void
  onGerar:   (f: FiltroDash) => void
}

/**
 * Popup da exportação do dashboard. O recorte vale só para o PDF: ao gerar, o
 * dashboard é recarregado com ele, fotografado e volta ao geral.
 */
export function ExportarDashModal({ open, onClose, onGerar }: Props) {
  const [filtro, setFiltro] = useState<FiltroDash>(FILTRO_VAZIO)

  useEffect(() => { if (open) setFiltro(FILTRO_VAZIO) }, [open])

  const aplicar = (patch: Partial<FiltroDash>) => setFiltro(f => ({ ...f, ...patch }))
  const invertido = Boolean(filtro.de && filtro.ate && filtro.de > filtro.ate)

  return (
    <Modal open={open} onClose={onClose} title="Exportar dashboard em PDF" maxWidth="md" solido>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Escolha o recorte. Em branco, sai o dashboard completo.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Cadastrados de"
          type="date"
          value={filtro.de}
          max={filtro.ate || undefined}
          onChange={e => aplicar({ de: e.target.value })}
        />
        <Input
          label="Até"
          type="date"
          value={filtro.ate}
          min={filtro.de || undefined}
          onChange={e => aplicar({ ate: e.target.value })}
        />
        <Select
          label="Est"
          value={filtro.est}
          onChange={e => aplicar({ est: e.target.value })}
          placeholder="Todos"
          options={[{ value: '', label: 'Todos' }, ...FILTROS_EST]}
        />
      </div>

      {invertido && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20
                        text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          A data inicial está depois da final.
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {temFiltro(filtro) && (
          <Button
            variant="ghost"
            icon={<RotateCcw size={14} />}
            onClick={() => setFiltro(FILTRO_VAZIO)}
            className="mr-auto"
          >
            Limpar
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button
          icon={<FileDown size={16} />}
          disabled={invertido}
          onClick={() => onGerar(filtro)}
        >
          Gerar PDF
        </Button>
      </div>
    </Modal>
  )
}
