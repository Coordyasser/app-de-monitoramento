import { useEffect, useState } from 'react'
import {
  AlertCircle, Calendar, Link2, MapPin, Pencil, Phone,
  ShieldCheck, Trash2, User, UserCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth }  from '@/contexts/AuthContext'
import { Button, Input, Modal, Textarea } from '@/components/ui'
import {
  LocalizacaoFields,
  type LocalizacaoErrors, type LocalizacaoRegistro,
} from './LocalizacaoFields'
import type { RegistroDetalhado } from '@/types/database.types'

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  registro:   RegistroDetalhado | null
  onClose:    () => void
  onSalvar:   (registro: RegistroDetalhado) => void
  onExcluir:  (id: string) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatarData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
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

// ── Componente ─────────────────────────────────────────────────────────────

export function RegistroDetalheModal({ registro, onClose, onSalvar, onExcluir }: Props) {
  const { user, profile } = useAuth()

  const [editando,   setEditando]   = useState(false)
  const [salvando,   setSalvando]   = useState(false)
  const [excluindo,  setExcluindo]  = useState(false)
  const [confirmar,  setConfirmar]  = useState(false)
  const [erro,       setErro]       = useState<string | null>(null)

  const [nome,        setNome]        = useState('')
  const [contato,     setContato]     = useState('')
  const [titulo,      setTitulo]      = useState('')
  const [vinculo,     setVinculo]     = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [localizacao, setLocalizacao] = useState<LocalizacaoRegistro>({
    cidade: '', zona: '', secao: '', secao_id: null, local_votacao: null, manual: false,
  })
  const [locErros, setLocErros] = useState<LocalizacaoErrors>({})

  const ehAdmin  = profile?.role === 'admin'
  const ehDono   = !!user && registro?.created_by === user.id
  const podeEditar = ehAdmin || ehDono

  // Recarrega o formulário sempre que abre outro registro
  useEffect(() => {
    if (!registro) return
    setEditando(false)
    setConfirmar(false)
    setErro(null)
    setNome(registro.nome ?? '')
    setContato(registro.contato ?? '')
    setTitulo(registro.titulo ?? '')
    setVinculo(registro.vinculo ?? '')
    setObservacoes(registro.observacoes ?? '')
    setLocalizacao({
      cidade:        registro.cidade ?? '',
      zona:          registro.zona ?? '',
      secao:         registro.secao ?? '',
      secao_id:      registro.secao_id ?? null,
      local_votacao: registro.local_votacao ?? null,
      // Sem vínculo com a base oficial, o registro nasceu manual
      manual:        registro.secao_id === null,
    })
  }, [registro])

  if (!registro) return null

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
      cidade:      localizacao.cidade.trim(),
      zona:        localizacao.zona.trim(),
      secao:       localizacao.secao.trim(),
      secao_id:    localizacao.secao_id,
      observacoes: observacoes.trim() || null,
    }

    const { error } = await supabase.from('registros').update(patch).eq('id', registro.id!)
    setSalvando(false)

    if (error) { setErro(error.message); return }

    onSalvar({
      ...registro,
      ...patch,
      local_votacao:        localizacao.local_votacao,
      localizacao_validada: localizacao.secao_id !== null,
      updated_at:           new Date().toISOString(),
    })
  }

  // ── Excluir ──────────────────────────────────────────────────────────

  async function excluir() {
    if (!registro) return
    setExcluindo(true)
    const { error } = await supabase.from('registros').delete().eq('id', registro.id!)
    setExcluindo(false)
    if (error) { setErro(error.message); setConfirmar(false); return }
    onExcluir(registro.id!)
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="xl"
      title={editando ? 'Editar registro' : registro.nome ?? 'Registro'}
    >
      {erro && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl
                        bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {erro}
        </div>
      )}

      {editando ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome"    value={nome}    onChange={e => setNome(e.target.value)} />
            <Input label="Contato" value={contato} onChange={e => setContato(e.target.value)} />
            <Input label="Título"  value={titulo}  onChange={e => setTitulo(e.target.value)} />
            <Input label="Vínculo" value={vinculo} onChange={e => setVinculo(e.target.value)} />
          </div>

          <LocalizacaoFields
            value={localizacao}
            onChange={setLocalizacao}
            errors={locErros}
          />

          <Textarea
            label="Observações"
            rows={4}
            maxLength={2000}
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
          />

          <div className="flex gap-3">
            <Button onClick={salvar} loading={salvando} className="flex-1">
              Salvar alterações
            </Button>
            <Button variant="ghost" onClick={() => setEditando(false)} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo icon={<User size={15} />} label="Nome">{registro.nome}</Campo>
            <Campo icon={<Phone size={15} />} label="Contato">{registro.contato}</Campo>
            <Campo icon={<UserCircle2 size={15} />} label="Título">{registro.titulo}</Campo>
            <Campo icon={<Link2 size={15} />} label="Vínculo">{registro.vinculo}</Campo>
          </div>

          <Campo icon={<MapPin size={15} />} label="Localização">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {registro.cidade} · Zona {registro.zona} · Seção {registro.secao}
              {registro.localizacao_validada ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={12} /> validada no TRE-PI
                </span>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  digitada manualmente
                </span>
              )}
            </span>
            {registro.local_votacao && (
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {registro.local_votacao}
              </span>
            )}
          </Campo>

          {registro.observacoes && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium mb-1">
                Observações
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap
                            rounded-xl bg-white/50 dark:bg-white/5 p-3">
                {registro.observacoes}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4
                          border-t border-white/40 dark:border-white/10">
            <Campo icon={<UserCircle2 size={15} />} label="Registrado por">
              {registro.agente_nome ?? 'Não identificado'}
            </Campo>
            <Campo icon={<Calendar size={15} />} label="Data do registro">
              {formatarData(registro.created_at)}
            </Campo>
          </div>

          {podeEditar && (
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                variant="secondary"
                icon={<Pencil size={15} />}
                onClick={() => setEditando(true)}
              >
                Editar
              </Button>

              {ehAdmin && (
                confirmar ? (
                  <div className="flex items-center gap-2">
                    <Button variant="danger" loading={excluindo} onClick={excluir}>
                      Confirmar exclusão
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmar(false)} disabled={excluindo}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    icon={<Trash2 size={15} />}
                    onClick={() => setConfirmar(true)}
                    className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  >
                    Excluir
                  </Button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
