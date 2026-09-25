import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertCircle, CheckCircle2, FileText, Phone, Save, User,
} from 'lucide-react'
import { supabase }   from '@/lib/supabase'
import { ouNaoConsta } from '@/lib/texto'
import { situacaoEfetiva } from '@/lib/situacao'
import { EST_SELECT, ehEstValido } from '@/lib/est'
import { useAuth }    from '@/contexts/AuthContext'
import { AppShell }   from '@/components/layout/AppShell'
import { Button, Card, Input, PageHeader, Select, Textarea } from '@/components/ui'
import {
  LocalizacaoFields, LOCALIZACAO_VAZIA,
  type LocalizacaoErrors, type LocalizacaoRegistro,
} from '@/components/registros/LocalizacaoFields'
import { VinculoSelect } from '@/components/registros/VinculoSelect'

// ── Limites (espelham os CHECKs da migration 010) ──────────────────────────

const OBS_MAX = 2000

// ── Schema ─────────────────────────────────────────────────────────────────
//
// O levantamento em campo chega em pedaços: o agente anota o nome e o
// telefone hoje e só descobre a seção depois. Por isso só o nome é exigido —
// o resto pode ficar em branco e ser completado na página do registro.
//
// Em branco não significa "qualquer coisa serve": o campo preenchido ainda
// precisa caber nos CHECKs da migration 010, senão o banco recusa o insert
// inteiro. Daí o mínimo valer apenas quando há texto.
const opcional = (min: number, max: number, curto: string) =>
  z.string().trim()
    .max(max, `Máximo de ${max} caracteres`)
    .refine(v => v === '' || v.length >= min, curto)
    .optional()

const schema = z.object({
  nome: z.string().trim()
    .min(3,   'Informe o nome completo')
    .max(120, 'Máximo de 120 caracteres'),
  contato: opcional(8, 60, 'Telefone ou e-mail curto demais — deixe em branco se ainda não tem'),
  titulo:  opcional(3, 120, 'Título curto demais — deixe em branco se ainda não tem'),
  vinculo: opcional(2, 80,  'Vínculo curto demais — deixe em branco se ainda não tem'),
  // Domínio fechado (migration 016): o Select já garante, mas o schema é
  // quem fala com o banco, e o CHECK recusaria qualquer outro valor.
  est: z.string().trim().refine(ehEstValido, 'Escolha Ana, Gil ou deixe em branco').optional(),
  observacoes: z.string().trim().max(OBS_MAX, `Máximo de ${OBS_MAX} caracteres`).optional(),
})
type FormValues = z.infer<typeof schema>

const VALORES_INICIAIS: FormValues = {
  nome: '', contato: '', titulo: '', vinculo: '', est: '', observacoes: '',
}

// ── Validação da localização ───────────────────────────────────────────────
//
// Mesma lógica: localização vazia entra como "Não consta". O que não pode é
// estourar o tamanho da coluna.
function validarLocalizacao(loc: LocalizacaoRegistro): LocalizacaoErrors {
  const erros: LocalizacaoErrors = {}
  if (loc.cidade.trim().length > 80) erros.cidade = 'Máximo de 80 caracteres'
  if (loc.zona.trim().length   > 20) erros.zona   = 'Máximo de 20 caracteres'
  if (loc.secao.trim().length  > 20) erros.secao  = 'Máximo de 20 caracteres'
  return erros
}

// ── Página ─────────────────────────────────────────────────────────────────

// Cada chegada à página é um formulário novo. O React Router reaproveita o
// componente quando se navega para a mesma rota (o botão "Novo registro" do
// menu, estando já no formulário), e com ele iam o estado dos campos e o da
// localização. A chave da navegação força a montagem do zero.
export function NovoRegistroPage() {
  const { key } = useLocation()
  return <FormularioNovoRegistro key={key} />
}

function FormularioNovoRegistro() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAuth()

  const [localizacao,    setLocalizacao]    = useState<LocalizacaoRegistro>(LOCALIZACAO_VAZIA)
  const [localizacaoErr, setLocalizacaoErr] = useState<LocalizacaoErrors>({})
  const [serverError,    setServerError]    = useState<string | null>(null)
  // Recado do registro anterior, quando se chega por "Salvar e adicionar outro".
  const sucesso = (location.state as { salvo?: string } | null)?.salvo ?? null

  useEffect(() => {
    if (sucesso) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [sucesso])

  const continuarRef = useRef(false)

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: VALORES_INICIAIS,
  })

  const observacoesValue = watch('observacoes') ?? ''

  // Aviso do que entra como "Não consta" — o agente salva sabendo o que falta.
  const emBranco = [
    ['Contato', watch('contato')],
    ['Título',  watch('titulo')],
    ['Vínculo', watch('vinculo')],
    ['Cidade',  localizacao.cidade],
    ['Zona',    localizacao.zona],
    ['Seção',   localizacao.secao],
  ].filter(([, v]) => !String(v ?? '').trim()).map(([rotulo]) => rotulo)

  // ── Submit ───────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const erros = validarLocalizacao(localizacao)
    setLocalizacaoErr(erros)
    if (Object.keys(erros).length > 0) return

    if (!user) {
      setServerError('Sessão expirada. Entre novamente para registrar.')
      return
    }

    const registro = {
      created_by:  user.id,
      nome:        values.nome.trim(),
      contato:     ouNaoConsta(values.contato),
      titulo:      ouNaoConsta(values.titulo),
      vinculo:     ouNaoConsta(values.vinculo),
      cidade:      ouNaoConsta(localizacao.cidade),
      zona:        ouNaoConsta(localizacao.zona),
      secao:       ouNaoConsta(localizacao.secao),
      secao_id:    localizacao.secao_id,
      // Domínio fechado: em branco é NULL, não a sentinela.
      est:         values.est?.trim() || null,
      observacoes: values.observacoes?.trim() || null,
    }

    const { error } = await supabase.from('registros').insert({
      ...registro,
      // Situação pela mesma regra do resto do app: sem título e sem contato o
      // registro nasce PENDENTE, para reaparecer na triagem de quem for
      // completá-lo. Com um dos dois em mãos, já é utilizável.
      situacao: situacaoEfetiva({ ...registro, situacao: 'PENDENTE' }),
    })

    if (error) {
      setServerError(error.message)
      return
    }

    // O próximo começa em branco, localização inclusive: navegar de novo
    // para a rota remonta o formulário (ver NovoRegistroPage).
    if (continuarRef.current) {
      navigate('/registros/novo', {
        replace: true,
        state: { salvo: `Registro de ${values.nome.trim()} salvo. Pode seguir para o próximo.` },
      })
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
          subtitle="Consolide aqui a informação levantada em campo — só o nome é obrigatório"
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
                  hint="Opcional — usado para identificar registros repetidos"
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
                  hint="Opcional"
                  error={errors.titulo?.message}
                  {...register('titulo')}
                />
                <div className="flex flex-col gap-1.5">
                  <VinculoSelect
                    value={watch('vinculo') ?? ''}
                    onChange={v => setValue('vinculo', v, { shouldValidate: true })}
                    error={errors.vinculo?.message}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Opcional. A lista é o cadastro de vínculos; para incluir um novo,
                    peça ao administrador em Configurações.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Est"
                  value={watch('est') ?? ''}
                  onChange={e => setValue('est', e.target.value, { shouldValidate: true })}
                  placeholder="Em branco"
                  options={EST_SELECT}
                  error={errors.est?.message}
                />
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
            {emBranco.length > 0 && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                {emBranco.join(', ')} {emBranco.length === 1 ? 'fica' : 'ficam'} como
                {' '}"Não consta" e {emBranco.length === 1 ? 'pode' : 'podem'} ser
                {' '}{emBranco.length === 1 ? 'completado' : 'completados'} depois,
                {' '}na página do registro.
              </p>
            )}
          </Card>

        </form>
      </div>
    </AppShell>
  )
}
