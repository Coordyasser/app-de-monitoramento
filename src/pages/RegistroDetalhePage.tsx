import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle, BadgeCheck, Calendar, CheckCircle2, FileSpreadsheet, Link2,
  Loader2, MapPin, Pencil, Phone, ShieldCheck, Trash2, TriangleAlert,
  User, UserCircle2,
} from 'lucide-react'
import { supabase }  from '@/lib/supabase'
import { useAuth }   from '@/contexts/AuthContext'
import { AppShell }  from '@/components/layout/AppShell'
import { Button, Card, Input, PageHeader, Select, Textarea } from '@/components/ui'
import {
  LocalizacaoFields,
  type LocalizacaoErrors, type LocalizacaoRegistro,
} from '@/components/registros/LocalizacaoFields'
import { conferirTitulo, formatarTitulo } from '@/lib/titulo'
import { capitalizarLugar } from '@/lib/texto'
import type { RegistroDetalhado } from '@/types/database.types'

// String literal única: o select() do Supabase infere o tipo do retorno a
// partir dela, e uma concatenação faz a inferência cair para GenericStringError.
const COLUNAS = 'id,nome,contato,titulo,vinculo,cidade,zona,secao,observacoes,secao_id,created_by,created_at,updated_at,agente_nome,local_votacao,localizacao_validada,origem_id,situacao,bairro'

/** Valores que a planilha de origem usa na coluna SITUAÇÃO. */
const SITUACOES = ['OK', 'PENDENTE', 'CONFERIR']

// ── Helpers de apresentação ────────────────────────────────────────────────

function formatarData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Secao({ titulo, acao, children }: {
  titulo: string; acao?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="py-5 first:pt-0 last:pb-0
                        border-b last:border-b-0 border-white/40 dark:border-white/10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold
                       text-slate-400 dark:text-slate-500">
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  )
}

function Campo({ icon, label, children }: {
  icon: React.ReactNode; label: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400 dark:text-slate-500 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium">
          {label}
        </p>
        <div className="text-sm text-slate-700 dark:text-slate-200 break-words">{children}</div>
      </div>
    </div>
  )
}

function SituacaoBadge({ situacao }: { situacao: string | null }) {
  if (!situacao) return null
  const cores: Record<string, string> = {
    OK:       'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    PENDENTE: 'bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    CONFERIR: 'bg-sky-100/70 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  }
  const cor = cores[situacao.toUpperCase()]
    ?? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      text-xs font-medium ${cor}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {situacao}
    </span>
  )
}

/** Selo de conferência do título, ao lado do valor. */
function TituloSelo({ valor }: { valor: string | null | undefined }) {
  const { situacao, mensagem } = conferirTitulo(valor)
  if (situacao === 'ausente') return null

  const estilo = {
    valido:     { cor: 'text-emerald-600 dark:text-emerald-400', Icone: BadgeCheck },
    'outra-uf': { cor: 'text-sky-600 dark:text-sky-400',         Icone: BadgeCheck },
    invalido:   { cor: 'text-rose-600 dark:text-rose-400',       Icone: TriangleAlert },
  }[situacao]

  const { cor, Icone } = estilo
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cor}`}>
      <Icone size={12} className="shrink-0" />
      {mensagem}
    </span>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

export function RegistroDetalhePage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const { user, profile } = useAuth()

  const [registro, setRegistro] = useState<RegistroDetalhado | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [naoEncontrado, setNaoEncontrado] = useState(false)

  const [editando,  setEditando]  = useState(false)
  const [salvando,  setSalvando]  = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [erro,      setErro]      = useState<string | null>(null)
  const [salvo,     setSalvo]     = useState(false)

  const [nome,        setNome]        = useState('')
  const [contato,     setContato]     = useState('')
  const [titulo,      setTitulo]      = useState('')
  const [vinculo,     setVinculo]     = useState('')
  const [situacao,    setSituacao]    = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [localizacao, setLocalizacao] = useState<LocalizacaoRegistro>({
    cidade: '', zona: '', secao: '', secao_id: null, local_votacao: null, manual: false,
  })
  const [locErros, setLocErros] = useState<LocalizacaoErrors>({})

  const ehAdmin    = profile?.role === 'admin'
  const ehDono     = !!user && registro?.created_by === user.id
  const podeEditar = ehAdmin || ehDono

  /** Repõe o formulário a partir do registro carregado. */
  const preencherFormulario = useCallback((r: RegistroDetalhado) => {
    setNome(r.nome ?? '')
    setContato(r.contato ?? '')
    setTitulo(r.titulo ?? '')
    setVinculo(r.vinculo ?? '')
    setSituacao(r.situacao ?? '')
    setObservacoes(r.observacoes ?? '')
    setLocalizacao({
      cidade:        r.cidade ?? '',
      zona:          r.zona ?? '',
      secao:         r.secao ?? '',
      secao_id:      r.secao_id ?? null,
      local_votacao: r.local_votacao ?? null,
      // Sem vínculo com a base oficial, a localização foi digitada à mão
      manual:        r.secao_id === null,
    })
    setLocErros({})
  }, [])

  // ── Carga ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    let ativo = true

    setCarregando(true)
    supabase
      .from('vw_registros_detalhados')
      .select(COLUNAS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return
        setCarregando(false)
        if (error) { setErro(error.message); return }
        // Sem linha pode ser id inexistente ou bloqueio do RLS — para quem
        // consulta, os dois casos são indistinguíveis de propósito.
        if (!data) { setNaoEncontrado(true); return }
        const r = data as RegistroDetalhado
        setRegistro(r)
        preencherFormulario(r)
      })

    return () => { ativo = false }
  }, [id, preencherFormulario])

  // O aviso de "salvo" some sozinho
  useEffect(() => {
    if (!salvo) return
    const t = setTimeout(() => setSalvo(false), 4000)
    return () => clearTimeout(t)
  }, [salvo])

  // ── Salvar ───────────────────────────────────────────────────────────

  async function salvar() {
    if (!registro) return
    setErro(null)

    const erros: LocalizacaoErrors = {}
    if (localizacao.cidade.trim().length < 2) erros.cidade = 'Informe a cidade'
    if (localizacao.zona.trim().length  < 1)  erros.zona   = 'Informe a zona'
    if (localizacao.secao.trim().length < 1)  erros.secao  = 'Informe a seção'
    setLocErros(erros)
    if (Object.keys(erros).length > 0) return

    if (nome.trim().length < 3 || contato.trim().length < 8 ||
        titulo.trim().length < 3 || vinculo.trim().length < 2) {
      setErro('Preencha nome, contato, título e vínculo.')
      return
    }

    setSalvando(true)
    const patch = {
      nome:        nome.trim(),
      contato:     contato.trim(),
      titulo:      titulo.trim(),
      vinculo:     vinculo.trim(),
      situacao:    situacao.trim() || null,
      cidade:      localizacao.cidade.trim(),
      zona:        localizacao.zona.trim(),
      secao:       localizacao.secao.trim(),
      secao_id:    localizacao.secao_id,
      observacoes: observacoes.trim() || null,
    }

    const { error } = await supabase.from('registros').update(patch).eq('id', registro.id!)
    setSalvando(false)
    if (error) { setErro(error.message); return }

    setRegistro({
      ...registro,
      ...patch,
      local_votacao:        localizacao.local_votacao,
      localizacao_validada: localizacao.secao_id !== null,
      updated_at:           new Date().toISOString(),
    })
    setEditando(false)
    setSalvo(true)
  }

  function cancelar() {
    if (registro) preencherFormulario(registro)
    setEditando(false)
    setErro(null)
  }

  // ── Excluir ──────────────────────────────────────────────────────────

  async function excluir() {
    if (!registro) return
    setExcluindo(true)
    const { error } = await supabase.from('registros').delete().eq('id', registro.id!)
    setExcluindo(false)
    if (error) { setErro(error.message); setConfirmar(false); return }
    navigate('/registros', { replace: true, state: { excluido: true } })
  }

  // ── Estados de carga ─────────────────────────────────────────────────

  if (carregando) {
    return (
      <AppShell>
        <div className="py-24 flex items-center justify-center">
          <Loader2 size={26} className="animate-spin text-indigo-500" />
        </div>
      </AppShell>
    )
  }

  if (naoEncontrado || !registro) {
    return (
      <AppShell>
        <PageHeader title="Registro não encontrado" back="/registros" />
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            O registro não existe ou você não tem permissão para vê-lo.
          </p>
          <Button className="mt-4" onClick={() => navigate('/registros')}>
            Voltar para a lista
          </Button>
        </Card>
      </AppShell>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageHeader
        title={registro.nome ?? 'Registro'}
        subtitle={editando ? 'Editando — as alterações só valem ao salvar' : undefined}
        back="/registros"
        actions={!editando && podeEditar ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<Pencil size={15} />}
              onClick={() => setEditando(true)}
            >
              Editar
            </Button>
            {ehAdmin && !confirmar && (
              <Button
                variant="ghost"
                icon={<Trash2 size={15} />}
                onClick={() => setConfirmar(true)}
                className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              >
                Excluir
              </Button>
            )}
          </div>
        ) : undefined}
      />

      {salvo && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl
                        bg-emerald-50 dark:bg-emerald-900/20
                        text-emerald-700 dark:text-emerald-300 text-sm animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          Alterações salvas.
        </div>
      )}

      {erro && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl
                        bg-rose-50 dark:bg-rose-900/20
                        text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {erro}
        </div>
      )}

      {confirmar && (
        <Card className="mb-6 border-rose-200 dark:border-rose-900/50">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Excluir <strong>{registro.nome}</strong> em definitivo? Não há como desfazer.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Button variant="danger" loading={excluindo} onClick={excluir}>
              Confirmar exclusão
            </Button>
            <Button variant="ghost" onClick={() => setConfirmar(false)} disabled={excluindo}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {/* ── Dados pessoais ─────────────────────────────────────── */}
        <Secao
          titulo="Dados pessoais"
          acao={!editando ? <SituacaoBadge situacao={registro.situacao} /> : undefined}
        >
          {editando ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Nome"    value={nome}    onChange={e => setNome(e.target.value)} />
              <Input label="Contato" value={contato} onChange={e => setContato(e.target.value)} />
              <Input
                label="Título"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                hint={conferirTitulo(titulo).mensagem}
              />
              <Input label="Vínculo" value={vinculo} onChange={e => setVinculo(e.target.value)} />
              <Select
                label="Situação"
                value={situacao}
                onChange={e => setSituacao(e.target.value)}
                placeholder="Sem situação"
                options={SITUACOES.map(s => ({ value: s, label: s }))}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo icon={<User size={15} />} label="Nome">{registro.nome}</Campo>
              <Campo icon={<Phone size={15} />} label="Contato">{registro.contato}</Campo>
              <Campo icon={<UserCircle2 size={15} />} label="Título">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="tabular-nums">{formatarTitulo(registro.titulo)}</span>
                  <TituloSelo valor={registro.titulo} />
                </span>
              </Campo>
              <Campo icon={<Link2 size={15} />} label="Vínculo">{registro.vinculo}</Campo>
            </div>
          )}
        </Secao>

        {/* ── Localização ────────────────────────────────────────── */}
        <Secao
          titulo="Localização"
          acao={!editando ? (
            registro.localizacao_validada ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={12} /> validada no TRE-PI
              </span>
            ) : (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                digitada manualmente
              </span>
            )
          ) : undefined}
        >
          {editando ? (
            <LocalizacaoFields value={localizacao} onChange={setLocalizacao} errors={locErros} />
          ) : (
            <Campo icon={<MapPin size={15} />} label="Seção eleitoral">
              {capitalizarLugar(registro.cidade)} · Zona {registro.zona} · Seção {registro.secao}
              {/* Bairro e local só existem quando a seção veio da base oficial */}
              {registro.bairro && (
                <span className="block text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Bairro {capitalizarLugar(registro.bairro)}
                </span>
              )}
              {registro.local_votacao && (
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {registro.local_votacao}
                </span>
              )}
            </Campo>
          )}
        </Secao>

        {/* ── Observações ────────────────────────────────────────── */}
        <Secao titulo="Observações">
          {editando ? (
            <Textarea
              rows={4}
              maxLength={2000}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Anotações sobre este registro"
            />
          ) : registro.observacoes ? (
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap
                          rounded-xl bg-white/50 dark:bg-white/5 p-3">
              {registro.observacoes}
            </p>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sem observações.</p>
          )}
        </Secao>

        {/* ── Procedência ────────────────────────────────────────── */}
        <Secao titulo="Procedência">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Campo icon={<UserCircle2 size={15} />} label="Registrado por">
              {registro.agente_nome ?? 'Importado da planilha'}
            </Campo>
            <Campo icon={<Calendar size={15} />} label="Criado em">
              {formatarData(registro.created_at)}
            </Campo>
            <Campo icon={<FileSpreadsheet size={15} />} label="Origem">
              {registro.origem_id
                ? `Planilha, linha ${registro.origem_id}`
                : 'Criado no aplicativo'}
            </Campo>
          </div>
          {registro.updated_at && registro.updated_at !== registro.created_at && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
              Última alteração em {formatarData(registro.updated_at)}
            </p>
          )}
        </Secao>

        {/* ── Ações de edição ────────────────────────────────────── */}
        {editando && (
          <div className="flex flex-wrap gap-3 pt-5 border-t border-white/40 dark:border-white/10">
            <Button onClick={salvar} loading={salvando} className="flex-1 sm:flex-none">
              Salvar alterações
            </Button>
            <Button variant="ghost" onClick={cancelar} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        )}
      </Card>
    </AppShell>
  )
}
