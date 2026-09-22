import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ComboboxSelect } from '@/components/ui'
import { ehNaoConsta } from '@/lib/texto'

interface Props {
  /** Nome do vínculo, ou '' para sem vínculo */
  value:    string
  onChange: (nome: string) => void
  error?:   string
  /**
   * Vínculo já gravado no registro. Entra na lista mesmo fora do cadastro —
   * a sincronização da planilha grava nomes que ninguém cadastrou aqui, e
   * abrir o registro não pode apagar o que já estava lá.
   */
  incluir?: string | null
}

/**
 * Campo de vínculo: só escolhe, não digita.
 *
 * Era texto livre, e cada variação de grafia virava um vínculo novo nas
 * agregações. Quem cria e renomeia vínculo agora é o admin, em Configurações.
 */
export function VinculoSelect({ value, onChange, error, incluir }: Props) {
  const [nomes,   setNomes]   = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    supabase
      .from('vinculos')
      .select('nome')
      .order('nome')
      .then(({ data }) => {
        if (!ativo) return
        setNomes((data ?? []).map(v => v.nome))
        setLoading(false)
      })
    return () => { ativo = false }
  }, [])

  const options = useMemo(() => {
    const lista = [...nomes]
    const atual = (incluir ?? '').trim()
    // Fora do cadastro e não é a sentinela de ausência: mantém, sinalizado.
    if (atual && !ehNaoConsta(atual) && !lista.some(n => n === atual)) {
      return [
        { value: atual, label: `${atual} (fora do cadastro)` },
        ...lista.map(n => ({ value: n, label: n })),
      ]
    }
    return lista.map(n => ({ value: n, label: n }))
  }, [nomes, incluir])

  return (
    <ComboboxSelect
      label="Vínculo"
      options={options}
      value={value}
      onChange={onChange}
      loading={loading}
      error={error}
      placeholder="Escolher vínculo..."
    />
  )
}
