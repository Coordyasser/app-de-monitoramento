import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle, Check, Link2, Loader2, Pencil, Plus, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button, Card, Input } from '@/components/ui'

interface VinculoCadastrado {
  id:        string
  nome:      string
  registros: number
}

/**
 * Cadastro de vínculos — só admin.
 *
 * Renomear não é um UPDATE na linha do cadastro: o nome também está gravado
 * em cada registro, então a RPC muda os dois na mesma transação. É por isso
 * que a contagem aparece ao lado do nome, antes de confirmar: ela é o
 * tamanho do estrago em caso de engano.
 */
export function VinculosCard() {
  const [vinculos,   setVinculos]   = useState<VinculoCadastrado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro,       setErro]       = useState<string | null>(null)
  const [aviso,      setAviso]      = useState<string | null>(null)
  const [salvando,   setSalvando]   = useState(false)

  // id do vínculo em edição, e o texto do campo
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [rascunho,   setRascunho]   = useState('')

  // formulário de criação, aberto sob demanda
  const [criando, setCriando] = useState(false)
  const [novo,    setNovo]    = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase.rpc('get_vinculos_cadastrados')
    setCarregando(false)
    if (error) { setErro(error.message); return }
    setErro(null)
    setVinculos(data ?? [])
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // O aviso de sucesso some sozinho
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  function abrirEdicao(v: VinculoCadastrado) {
    setEditandoId(v.id)
    setRascunho(v.nome)
    setCriando(false)
    setErro(null)
  }

  function fecharEdicao() {
    setEditandoId(null)
    setRascunho('')
  }

  async function renomear(v: VinculoCadastrado) {
    const nome = rascunho.trim()
    if (nome.length < 2 || nome.length > 80) {
      setErro('O nome precisa ter entre 2 e 80 caracteres.')
      return
    }
    if (nome === v.nome) { fecharEdicao(); return }

    setSalvando(true)
    setErro(null)
    const { data, error } = await supabase.rpc('renomear_vinculo', { p_id: v.id, p_nome: nome })
    setSalvando(false)
    if (error) { setErro(error.message); return }

    const total = (data as { registros?: number } | null)?.registros ?? 0
    setAviso(`"${v.nome}" agora é "${nome}" — ${total} ${total === 1 ? 'registro atualizado' : 'registros atualizados'}.`)
    fecharEdicao()
    carregar()
  }

  async function criar() {
    const nome = novo.trim()
    if (nome.length < 2 || nome.length > 80) {
      setErro('O nome precisa ter entre 2 e 80 caracteres.')
      return
    }

    setSalvando(true)
    setErro(null)
    const { error } = await supabase.from('vinculos').insert({ nome })
    setSalvando(false)
    if (error) {
      // O índice único é sobre a forma normalizada: acento e caixa não
      // fazem vínculo novo, e a mensagem crua do Postgres não diz isso.
      setErro(error.code === '23505'
        ? 'Já existe um vínculo com esse nome.'
        : error.message)
      return
    }

    setAviso(`Vínculo "${nome}" criado. Já aparece no formulário de registro.`)
    setNovo('')
    setCriando(false)
    carregar()
  }

  return (
    <Card padding="lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/40">
          <Link2 size={20} className="text-sky-600 dark:text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Vínculos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O formulário de registro só oferece os vínculos desta lista
          </p>
        </div>
        {!criando && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => { setCriando(true); fecharEdicao(); setErro(null) }}
          >
            Adicionar
          </Button>
        )}
      </div>

      {/* Criação */}
      {criando && (
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4 p-4 rounded-xl
                        bg-slate-50/60 dark:bg-white/5
                        border border-slate-200/60 dark:border-white/10">
          <div className="flex-1">
            <Input
              label="Novo vínculo"
              placeholder="Ex.: Liderança comunitária"
              value={novo}
              autoFocus
              onChange={e => setNovo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criar() } }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" loading={salvando} icon={<Check size={14} />} onClick={criar}>
              Salvar
            </Button>
            <Button
              variant="ghost" size="sm" icon={<X size={14} />}
              onClick={() => { setCriando(false); setNovo(''); setErro(null) }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {erro && (
        <p className="flex items-center gap-2 mb-4 text-sm text-rose-600 dark:text-rose-400
                      bg-rose-50 dark:bg-rose-900/20 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="shrink-0" />
          {erro}
        </p>
      )}

      {aviso && (
        <p className="flex items-center gap-2 mb-4 text-sm text-emerald-700 dark:text-emerald-300
                      bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-3">
          <Check size={15} className="shrink-0" />
          {aviso}
        </p>
      )}

      {/* Lista */}
      {carregando ? (
        <div className="py-10 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-indigo-500" />
        </div>
      ) : vinculos.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Nenhum vínculo cadastrado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200/60 dark:divide-white/10">
          {vinculos.map(v => (
            <li key={v.id} className="py-3 first:pt-0 last:pb-0">
              {editandoId === v.id ? (
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label="Nome do vínculo"
                      value={rascunho}
                      autoFocus
                      onChange={e => setRascunho(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); renomear(v) } }}
                      hint={v.registros > 0
                        ? `Renomear atualiza ${v.registros} ${v.registros === 1 ? 'registro' : 'registros'}`
                        : 'Nenhum registro usa este vínculo'}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" loading={salvando} icon={<Check size={14} />} onClick={() => renomear(v)}>
                      Salvar
                    </Button>
                    <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={fecharEdicao}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {v.nome}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {v.registros} {v.registros === 1 ? 'registro' : 'registros'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil size={14} />}
                    onClick={() => abrirEdicao(v)}
                  >
                    Renomear
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
