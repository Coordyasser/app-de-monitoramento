import { useNavigate } from 'react-router-dom'
import {
  MapPin, Building2, Layers, Hash,
  CheckCircle2, ArrowRight, AlertCircle,
} from 'lucide-react'
import { useCascadeLocation } from '@/hooks/useCascadeLocation'
import { useSelectedLocation } from '@/contexts/LocationContext'
import { AppShell }            from '@/components/layout/AppShell'
import { Card, Button, Select, ComboboxSelect, PageHeader } from '@/components/ui'

// ── Resumo da localização confirmada ──────────────────────────────────────
interface LocationSummaryProps {
  municipio:     string
  zona:          string
  local_votacao: string
  secao:         string
}

function LocationSummary({ municipio, zona, local_votacao, secao }: LocationSummaryProps) {
  const items = [
    { icon: MapPin,    label: 'Município',        value: municipio     },
    { icon: Layers,    label: 'Zona Eleitoral',   value: zona          },
    { icon: Building2, label: 'Local de Votação', value: local_votacao },
    { icon: Hash,      label: 'Seção',            value: secao         },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex items-start gap-3 p-3 rounded-xl
                     bg-indigo-50/60 dark:bg-indigo-900/20
                     border border-indigo-200/40 dark:border-indigo-500/20"
        >
          <div className="mt-0.5 p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
            <Icon size={14} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">{label}</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Indicador de progresso da cascata ─────────────────────────────────────
function ProgressSteps({ filled }: { filled: number }) {
  const labels = ['Município', 'Zona', 'Local', 'Seção']
  return (
    <div className="flex items-center gap-1 mb-6">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                i < filled
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : i === filled
                    ? 'bg-white dark:bg-white/10 border-2 border-indigo-400 text-indigo-600 dark:text-indigo-400'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600',
              ].join(' ')}
            >
              {i < filled ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={[
              'text-[10px] mt-1 font-medium hidden sm:block',
              i < filled ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400',
            ].join(' ')}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={[
              'h-0.5 flex-1 mx-1 rounded-full transition-all duration-300',
              i < filled - 1
                ? 'bg-indigo-500'
                : 'bg-slate-200 dark:bg-white/10',
            ].join(' ')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export function BuscarSecaoPage() {
  const navigate    = useNavigate()
  const { setSelectedLocation } = useSelectedLocation()

  const {
    municipio, zona, local_votacao, secao,
    setMunicipio, setZona, setLocal, setSecao,
    municipios, zonas, locais, secoes,
    isComplete, selection,
  } = useCascadeLocation()

  // Contagem de níveis preenchidos para a barra de progresso (4 níveis visíveis)
  const filledCount = [municipio, zona, local_votacao, secao].filter(Boolean).length

  function handleConfirm() {
    if (!selection) return
    setSelectedLocation(selection)
    navigate('/ocorrencias/nova')
  }

  const anyError = [zonas, locais, secoes].find(l => l.error)

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title="Localizar seção eleitoral"
          subtitle="Selecione os 4 campos abaixo para identificar sua seção no TRE-PI"
          back="/"
        />

        <Card padding="lg" className="animate-slide-up">
          {/* Progresso */}
          <ProgressSteps filled={filledCount} />

          {/* Erro global */}
          {anyError && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              Erro ao carregar dados: {anyError.error}
            </div>
          )}

          {/* Selects em cascata */}
          <div className="flex flex-col gap-4">

            {/* 1 — Município (com busca por texto) */}
            <ComboboxSelect
              label="Município"
              placeholder={municipios.loading ? 'Carregando municípios...' : 'Buscar município...'}
              loading={municipios.loading}
              options={municipios.options.map(m => ({ value: m, label: m }))}
              value={municipio}
              onChange={v => setMunicipio(v)}
              error={municipios.error ?? undefined}
            />

            {/* 2 — Zona Eleitoral */}
            <Select
              label="Zona Eleitoral"
              placeholder={
                !municipio       ? 'Selecione o município primeiro'
                : zonas.loading  ? 'Carregando zonas...'
                : 'Selecione a zona eleitoral'
              }
              loading={zonas.loading}
              options={zonas.options.map(z => ({ value: z, label: `Zona ${z}` }))}
              value={zona}
              onChange={e => setZona(e.target.value)}
              disabled={!municipio}
            />

            {/* 3 — Local de Votação */}
            <Select
              label="Local de Votação"
              placeholder={
                !zona             ? 'Selecione a zona primeiro'
                : locais.loading  ? 'Carregando locais...'
                : 'Selecione o local de votação'
              }
              loading={locais.loading}
              options={locais.options.map(l => ({ value: l, label: l }))}
              value={local_votacao}
              onChange={e => setLocal(e.target.value)}
              disabled={!zona}
            />

            {/* 4 — Seção Eleitoral */}
            <Select
              label="Seção Eleitoral"
              placeholder={
                !local_votacao    ? 'Selecione o local primeiro'
                : secoes.loading  ? 'Carregando seções...'
                : 'Selecione a seção eleitoral'
              }
              loading={secoes.loading}
              options={secoes.options.map(s => ({ value: s, label: `Seção ${s}` }))}
              value={secao}
              onChange={e => setSecao(e.target.value)}
              disabled={!local_votacao}
            />

          </div>

          {/* Resumo da localização quando completo */}
          {isComplete && (
            <div className="mt-6 animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Localização identificada
                </span>
              </div>
              <LocationSummary
                municipio={municipio}
                zona={zona}
                local_votacao={local_votacao}
                secao={secao}
              />
            </div>
          )}

          {/* Botão de confirmação */}
          <div className="mt-6 pt-4 border-t border-white/30 dark:border-white/10">
            <Button
              size="lg"
              className="w-full"
              disabled={!isComplete}
              icon={<ArrowRight size={18} />}
              onClick={handleConfirm}
            >
              Confirmar localização e registrar ocorrência
            </Button>
            {!isComplete && (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2">
                Preencha todos os 4 campos para continuar
              </p>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
