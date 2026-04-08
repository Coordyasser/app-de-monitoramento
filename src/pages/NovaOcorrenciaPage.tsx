import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom' // Link usado no card de localização ("Alterar")
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  MapPin, Building2, Layers, Hash, Cpu,
  Navigation, Send, AlertCircle, Loader2,
} from 'lucide-react'
import { supabase }             from '@/lib/supabase'
import { useAuth }              from '@/contexts/AuthContext'
import { useSelectedLocation }  from '@/contexts/LocationContext'
import { AppShell }             from '@/components/layout/AppShell'
import { Card, Button, Select, Textarea, Dropzone, PageHeader } from '@/components/ui'
import type { OcorrenciaCategoria } from '@/types/database.types'

// ── Constantes ─────────────────────────────────────────────────────────────

const CATEGORIAS: { value: OcorrenciaCategoria; label: string }[] = [
  { value: 'irregularidade_administrativa', label: 'Irregularidade administrativa' },
  { value: 'problema_com_urna',             label: 'Problema com urna'             },
  { value: 'fila_aglomeracao',              label: 'Fila / Aglomeração'            },
  { value: 'acessibilidade',                label: 'Acessibilidade'                },
  { value: 'conduta_suspeita',              label: 'Conduta suspeita'              },
  { value: 'outro',                         label: 'Outro'                         },
]

const DESCRICAO_MIN = 20
const DESCRICAO_MAX = 1000

// ── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  categoria: z.enum([
    'irregularidade_administrativa', 'problema_com_urna', 'fila_aglomeracao',
    'acessibilidade', 'conduta_suspeita', 'outro',
  ], { required_error: 'Selecione uma categoria' }),
  descricao: z
    .string()
    .min(DESCRICAO_MIN, `Descreva com pelo menos ${DESCRICAO_MIN} caracteres`)
    .max(DESCRICAO_MAX, `Máximo de ${DESCRICAO_MAX} caracteres`),
  foto: z.instanceof(File).nullable(),
})
type FormValues = z.infer<typeof schema>

// ── Resumo da localização ──────────────────────────────────────────────────

function LocationCard({
  municipio, zona, local_votacao, secao, urna,
}: {
  municipio: string; zona: string; local_votacao: string; secao: string; urna: string
}) {
  const rows = [
    { icon: MapPin,    label: 'Município', value: municipio     },
    { icon: Layers,    label: 'Zona',      value: zona          },
    { icon: Building2, label: 'Local',     value: local_votacao },
    { icon: Hash,      label: 'Seção',     value: secao         },
    // Urna omitida quando não disponível nos dados do TRE-PI
    ...(urna && urna !== '-' ? [{ icon: Cpu, label: 'Urna', value: urna }] : []),
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {rows.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex items-start gap-2 p-2.5 rounded-xl
                     bg-indigo-50/60 dark:bg-indigo-900/20
                     border border-indigo-200/40 dark:border-indigo-500/20"
        >
          <Icon size={13} className="mt-0.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
          <div className="min-w-0">
            <p className="text-[10px] text-indigo-400 dark:text-indigo-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

export function NovaOcorrenciaPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { selectedLocation }           = useSelectedLocation()

  const [geoLoading,  setGeoLoading]  = useState(false)
  const [geoCoords,   setGeoCoords]   = useState<{ lat: number; lng: number } | null>(null)
  const [geoError,    setGeoError]    = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register, control, handleSubmit, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { categoria: undefined, descricao: '', foto: null },
  })

  const descricaoValue = watch('descricao') ?? ''

  // Aguarda resolução do auth antes de renderizar
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    )
  }

  // Sem localização selecionada
  if (!selectedLocation) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto">
          <Card padding="lg" className="text-center">
            <AlertCircle size={40} className="mx-auto text-amber-500 mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Nenhuma localização selecionada
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Você precisa buscar sua seção eleitoral antes de registrar uma ocorrência.
            </p>
            <Link to="/buscar-secao">
              <Button>Buscar seção eleitoral</Button>
            </Link>
          </Card>
        </div>
      </AppShell>
    )
  }

  // Captura o valor em variável local após o guard — TypeScript infere como non-null
  const location = selectedLocation

  // ── Geolocalização ───────────────────────────────────────────────────

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocalização não suportada neste dispositivo.')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoLoading(false)
      },
      () => {
        setGeoError('Não foi possível obter sua localização. Verifique as permissões.')
        setGeoLoading(false)
      },
      { timeout: 10000 }
    )
  }

  // ── Upload da foto ────────────────────────────────────────────────────
  // Anônimos usam pasta 'anonimo/' (policy de storage validada na migration 006)
  // Autenticados usam pasta com seu user_id

  async function uploadFoto(file: File): Promise<string | null> {
    const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const folder   = user?.id ?? 'anonimo'
    const filename = `${folder}/${crypto.randomUUID()}.${ext}`

    const { error } = await supabase.storage
      .from('incidents')
      .upload(filename, file, { contentType: file.type, upsert: false })

    if (error) throw new Error(`Erro no upload: ${error.message}`)

    const { data } = supabase.storage.from('incidents').getPublicUrl(filename)
    return data?.publicUrl ?? null
  }

  // ── Submit ────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      let foto_url: string | null = null

      if (values.foto) {
        foto_url = await uploadFoto(values.foto)
      }

      const { error } = await supabase.from('ocorrencias').insert({
        user_id:   user?.id ?? null,      // null = denúncia anônima (RLS 006 valida)
        secao_id:  location.secao_id,
        categoria: values.categoria,
        descricao: values.descricao,
        foto_url,
        latitude:  geoCoords?.lat ?? null,
        longitude: geoCoords?.lng ?? null,
        status:    'pendente',
      })

      if (error) throw new Error(error.message)

      navigate('/ocorrencias')
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Erro ao enviar ocorrência.')
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title="Nova ocorrência"
          subtitle={user ? 'Registrado com seu perfil' : 'Envio anônimo — sem identificação'}
          back="/buscar-secao"
        />

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

          {/* Card: Localização */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <MapPin size={15} className="text-indigo-500" />
                Localização da seção
              </span>
              <Link
                to="/buscar-secao"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Alterar
              </Link>
            </div>
            <LocationCard
              municipio={location.municipio}
              zona={location.zona}
              local_votacao={location.local_votacao}
              secao={location.secao}
              urna={location.urna}
            />
          </Card>

          {/* Card: Detalhes */}
          <Card padding="lg">
            <div className="flex flex-col gap-5">

              <Controller
                name="categoria"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Categoria"
                    options={CATEGORIAS}
                    placeholder="Selecione a categoria"
                    error={errors.categoria?.message}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value)}
                  />
                )}
              />

              <Textarea
                label="Descrição"
                placeholder="Descreva detalhadamente o que foi observado..."
                rows={5}
                maxLength={DESCRICAO_MAX}
                error={errors.descricao?.message}
                hint={`Mínimo ${DESCRICAO_MIN} caracteres`}
                counter={{ current: descricaoValue.length, max: DESCRICAO_MAX }}
                {...register('descricao')}
              />

              {/* Foto — opcional para anônimos e autenticados */}
              <Controller
                name="foto"
                control={control}
                render={({ field }) => (
                  <Dropzone
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.foto?.message}
                  />
                )}
              />

              {/* Geolocalização */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Localização GPS (opcional)
                </span>
                {geoCoords ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl
                                  bg-emerald-50/60 dark:bg-emerald-900/20
                                  border border-emerald-200/40 dark:border-emerald-500/20">
                    <Navigation size={15} className="text-emerald-500 shrink-0" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">
                      {geoCoords.lat.toFixed(6)}, {geoCoords.lng.toFixed(6)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGeoCoords(null)}
                      className="ml-auto text-xs text-emerald-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={geoLoading}
                    icon={<Navigation size={15} />}
                    onClick={handleGetLocation}
                    className="self-start"
                  >
                    {geoLoading ? 'Obtendo localização...' : 'Obter minha localização atual'}
                  </Button>
                )}
                {geoError && (
                  <p className="text-xs text-rose-500">{geoError}</p>
                )}
              </div>
            </div>
          </Card>

          {serverError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl
                            bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {serverError}
            </div>
          )}

          <Card padding="md">
            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              icon={<Send size={18} />}
              className="w-full"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar ocorrência'}
            </Button>
          </Card>

        </form>
      </div>
    </AppShell>
  )
}
