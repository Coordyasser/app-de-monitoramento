import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertCircle, CheckCircle2, FileText, Link2, Phone, Save, User,
} from 'lucide-react'
import { supabase }   from '@/lib/supabase'
import { useAuth }    from '@/contexts/AuthContext'
import { AppShell }   from '@/components/layout/AppShell'
import { Button, Card, Input, PageHeader, Textarea } from '@/components/ui'
import {
  LocalizacaoFields, LOCALIZACAO_VAZIA,
  type LocalizacaoErrors, type LocalizacaoRegistro,
} from '@/components/registros/LocalizacaoFields'

// ── Limites (espelham os CHECKs da migration 010) ──────────────────────────

const OBS_MAX = 2000

// ── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().trim()
    .min(3,   'Informe o nome completo')
    .max(120, 'Máximo de 120 caracteres'),
  contato: z.string().trim()
    .min(8,  'Informe um telefone ou e-mail válido')
    .max(60, 'Máximo de 60 caracteres'),
  titulo: z.string().trim()
    .min(3,   'Informe um título para o registro')
    .max(120, 'Máximo de 120 caracteres'),
  vinculo: z.string().trim()
    .min(2,  'Informe o vínculo')
    .max(80, 'Máximo de 80 caracteres'),
  observacoes: z.string().trim().max(OBS_MAX, `Máximo de ${OBS_MAX} caracteres`).optional(),
})
type FormValues = z.infer<typeof schema>

const VALORES_INICIAIS: FormValues = {
  nome: '', contato: '', titulo: '', vinculo: '', observacoes: '',
}

// ── Validação da localização ───────────────────────────────────────────────

function validarLocalizacao(loc: LocalizacaoRegistro): LocalizacaoErrors {
  const erros: LocalizacaoErrors = {}
  if (loc.cidade.trim().length < 2) erros.cidade = 'Informe a cidade'
  if (loc.zona.trim().length  < 1)  erros.zona   = 'Informe a zona'
  if (loc.secao.trim().length < 1)  erros.secao  = 'Informe a seção'
  return erros
}

// ── Página ─────────────────────────────────────────────────────────────────

export function NovoRegistroPage() {
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const [localizacao,    setLocalizacao]    = useState<LocalizacaoRegistro>(LOCALIZACAO_VAZIA)
  const [localizacaoErr, setLocalizacaoErr] = useState<LocalizacaoErrors>({})
  const [serverError,    setServerError]    = useState<string | null>(null)
  const [sucesso,        setSucesso]        = useState<string | null>(null)
  const [vinculosUsados, setVinculosUsados] = useState<string[]>([])

  // "Salvar e adicionar outro" mantém a localização e limpa o resto
  const continuarRef = useRef(false)

  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VALORES_INICIAIS,
  })

  const observacoesValue = watch('observacoes') ?? ''

  // Sugestões de vínculo já usados pela equipe — o campo é texto livre,
  // a lista só ajuda a convergir na mesma grafia.
  useEffect(() => {
    supabase.rpc('get_vinculos_sugeridos', { p_limit: 30 }).then(({ data }) => {
      setVinculosUsados((data ?? []).map(r => r.vinculo))
    })
  }, [])

  // ── Submit ───────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    setServerError(null)
    setSucesso(null)

    const erros = validarLocalizacao(localizacao)
    setLocalizacaoErr(erros)
    if (Object.keys(erros).length > 0) return

    if (!user) {
      setServerError('Sessão expirada. Entre novamente para registrar.')
      return
    }

    const { error } = await supabase.from('registros').insert({
      created_by:  user.id,
      nome:        values.nome.trim(),
      contato:     values.contato.trim(),
      titulo:      values.titulo.trim(),
      vinculo:     values.vinculo.trim(),
      cidade:      localizacao.cidade.trim(),
      zona:        localizacao.zona.trim(),
      secao:       localizacao.secao.trim(),
      secao_id:    localizacao.secao_id,
      observacoes: values.observacoes?.trim() || null,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    if (continuarRef.current) {
      continuarRef.current = false
      reset(VALORES_INICIAIS)
      setSucesso(`Registro de ${values.nome.trim()} salvo. Pode seguir para o próximo.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    navigate('/registros', { state: { criado: true } })
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="Novo registro"
          subtitle="Consolide aqui a informação levantada em campo"
          back="/registros"
        />

        {sucesso && (
          <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-xl
                          bg-emerald-50 dark:bg-emerald-900/20
                          text-emerald-700 dark:text-emerald-300 text-sm">
            <CheckCircle2 size={16} className="shrink-0" />
            {sucesso}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

          {/* Identificação */}
          <Card padding="lg">
            <div className="flex flex-col gap-5">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <User size={15} className="text-indigo-500" />
                Identificação
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nome"
                  placeholder="Nome completo"
                  autoComplete="off"
                  icon={<User size={15} />}
                  error={errors.nome?.message}
                  {...register('nome')}
                />
                <Input
                  label="Contato"
                  placeholder="Telefone ou e-mail"
                  autoComplete="off"
                  icon={<Phone size={15} />}
                  hint="Usado para identificar registros repetidos"
                  error={errors.contato?.message}
                  {...register('contato')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Título"
                  placeholder="Ex.: Coordenador de bairro"
                  autoComplete="off"
                  icon={<FileText size={15} />}
                  error={errors.titulo?.message}
                  {...register('titulo')}
                />
                <div>
                  <Input
                    label="Vínculo"
                    placeholder="Ex.: Liderança comunitária"
                    autoComplete="off"
                    list="vinculos-sugeridos"
                    icon={<Link2 size={15} />}
                    hint={vinculosUsados.length > 0
                      ? 'Campo livre — a lista mostra vínculos já usados pela equipe'
                      : 'Campo livre'}
                    error={errors.vinculo?.message}
                    {...register('vinculo')}
                  />
                  <datalist id="vinculos-sugeridos">
                    {vinculosUsados.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
              </div>
            </div>
          </Card>

          {/* Localização */}
          <Card padding="lg">
            <LocalizacaoFields
              value={localizacao}
              onChange={setLocalizacao}
              errors={localizacaoErr}
            />
          </Card>

          {/* Observações */}
          <Card padding="lg">
            <Textarea
              label="Observações"
              placeholder="Contexto, encaminhamentos, detalhes relevantes..."
              rows={5}
              maxLength={OBS_MAX}
              hint="Opcional"
              error={errors.observacoes?.message}
              counter={{ current: observacoesValue.length, max: OBS_MAX }}
              {...register('observacoes')}
            />
          </Card>

          {serverError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl
                            bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {serverError}
            </div>
          )}

          <Card padding="md">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                icon={<Save size={18} />}
                onClick={() => { continuarRef.current = false }}
                className="flex-1"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar registro'}
              </Button>
              <Button
                type="submit"
                size="lg"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => { continuarRef.current = true }}
                className="flex-1"
              >
                Salvar e adicionar outro
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              "Salvar e adicionar outro" mantém a localização preenchida para o próximo registro.
            </p>
          </Card>

        </form>
      </div>
    </AppShell>
  )
}
