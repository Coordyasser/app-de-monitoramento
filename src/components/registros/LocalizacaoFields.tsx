import { useEffect, useRef, useState } from 'react'
import { Keyboard, Loader2, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ComboboxSelect, Input } from '@/components/ui'
import { capitalizarLugar, ehNaoConsta } from '@/lib/texto'

// ── Tipo ───────────────────────────────────────────────────────────────────

export interface LocalizacaoRegistro {
  cidade:        string
  zona:          string
  secao:         string
  /** Preenchido só quando os três níveis vieram da base do TRE-PI */
  secao_id:      string | null
  local_votacao: string | null
  /** true = agente optou por digitar à mão */
  manual:        boolean
}

export const LOCALIZACAO_VAZIA: LocalizacaoRegistro = {
  cidade: '', zona: '', secao: '', secao_id: null, local_votacao: null, manual: false,
}

export interface LocalizacaoErrors {
  cidade?: string
  zona?:   string
  secao?:  string
}

interface Props {
  value:    LocalizacaoRegistro
  onChange: (next: LocalizacaoRegistro) => void
  errors?:  LocalizacaoErrors
}

interface Candidato {
  municipio:     string
  /** Só o par exato amarra a seção oficial; pela zona não há o que amarrar. */
  secao_id:      string | null
  local_votacao: string | null
}

/**
 * De onde veio a lista de candidatos.
 *
 *   par     o par zona+seção existe na base do TRE-PI
 *   zona    o par não existe; os candidatos são os municípios da zona
 *   nenhum  nem a zona existe
 */
type Origem = 'par' | 'zona' | 'nenhum'

const DEBOUNCE = 350

// ── Componente ─────────────────────────────────────────────────────────────

/**
 * Zona e seção primeiro; o município vem delas.
 *
 * A cascata antiga pedia o município no topo, mas em campo ninguém começa por
 * ele: o que está na mão do agente é o comprovante de votação, que traz zona
 * e seção. O par quase sempre identifica um município só — é a mesma dedução
 * que a sincronização da planilha faz — e quando não identifica, quem preenche
 * escolhe entre os candidatos ou digita o nome.
 *
 * Quando o par não existe, ainda há um degrau antes de digitar à mão: a zona
 * sozinha. Seção agregada ou extinta não aparece no dataset de locais de
 * votação — a zona 97 tem 176 números ausentes entre 1 e 645 —, mas a zona
 * continua amarrada aos mesmos municípios. A dedução fica mais grossa e não
 * confirma a seção, e é por isso que o registro segue como não validado.
 */
export function LocalizacaoFields({ value, onChange, errors = {} }: Props) {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [origem,     setOrigem]     = useState<Origem>('nenhum')
  const [buscando,   setBuscando]   = useState(false)
  const [buscou,     setBuscou]     = useState(false)

  const { cidade, zona, secao, manual } = value

  // O efeito da busca não pode depender de `value` inteiro, senão a própria
  // resposta o reinicia. A ref dá acesso ao estado corrente sem virar
  // dependência.
  const valueRef = useRef(value)
  valueRef.current = value

  // Enquanto ninguém mexeu em zona/seção, um registro já salvo não pode ter a
  // cidade trocada por baixo: a dedução aqui só confere, não aplica.
  const tocado = useRef(false)

  function aplicar(patch: Partial<LocalizacaoRegistro>) {
    onChange({ ...valueRef.current, ...patch })
  }

  // ── Dedução do município ─────────────────────────────────────────────

  useEffect(() => {
    const z = zona.trim()
    const s = secao.trim()
    if (!z || !s || ehNaoConsta(z) || ehNaoConsta(s)) {
      setCandidatos([])
      setBuscou(false)
      return
    }

    let ativo = true
    setBuscando(true)

    const t = setTimeout(() => {
      (async () => {
        // 1º: o par exato, que é o único que amarra a seção oficial.
        const { data: porPar } = await supabase
          .rpc('get_municipios_por_zona_secao', { p_zona: z, p_secao: s })
        if (!ativo) return

        let achados = (porPar ?? []) as Candidato[]
        let origemBusca: Origem = achados.length > 0 ? 'par' : 'nenhum'

        // 2º: a zona sozinha. Só quando o par falhou — enquanto houver par,
        // ele manda, inclusive na ambiguidade.
        if (achados.length === 0) {
          const { data: porZona } = await supabase
            .rpc('get_municipios_por_zona', { p_zona: z })
          if (!ativo) return
          const daZona = (porZona ?? []) as { municipio: string }[]
          if (daZona.length > 0) {
            achados = daZona.map(m => ({
              municipio: m.municipio, secao_id: null, local_votacao: null,
            }))
            origemBusca = 'zona'
          }
        }

        setCandidatos(achados)
        setOrigem(origemBusca)
        setBuscando(false)
        setBuscou(true)

        const atual = valueRef.current
        const temCidade = !!atual.cidade.trim() && !ehNaoConsta(atual.cidade)
        // Registro já salvo, aberto para edição: confere e não mexe.
        if (!tocado.current && temCidade) return

        if (achados.length === 1) {
          aplicar({
            cidade:        achados[0].municipio,
            secao_id:      achados[0].secao_id,
            local_votacao: achados[0].local_votacao,
            manual:        false,
          })
        } else {
          // Ambíguo ou desconhecido: o vínculo com a base oficial não
          // existe até alguém decidir qual é o município.
          aplicar({
            cidade:        achados.length > 1 ? '' : atual.cidade,
            secao_id:      null,
            local_votacao: null,
            manual:        achados.length === 0,
          })
        }
      })()
    }, DEBOUNCE)

    return () => { ativo = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona, secao])

  // ── Handlers ─────────────────────────────────────────────────────────

  function setNumero(campo: 'zona' | 'secao', v: string) {
    tocado.current = true
    // Trocar de seção invalida o município deduzido da anterior.
    aplicar({ [campo]: v, secao_id: null, local_votacao: null } as Partial<LocalizacaoRegistro>)
  }

  function escolherCandidato(municipio: string) {
    const achado = candidatos.find(c => c.municipio === municipio)
    if (!achado) return
    aplicar({
      cidade:        achado.municipio,
      secao_id:      achado.secao_id,
      local_votacao: achado.local_votacao,
      manual:        false,
    })
  }

  function digitarCidade() {
    aplicar({ cidade: '', secao_id: null, local_votacao: null, manual: true })
  }

  // ── Render ───────────────────────────────────────────────────────────

  const deduzida = !manual && !!value.secao_id
  const ambiguo  = !manual && buscou && candidatos.length > 1
  const semBase  = buscou && candidatos.length === 0
  // Veio da zona: a cidade está preenchida, mas a seção não foi confirmada.
  const pelaZona = !manual && buscou && origem === 'zona' && !!cidade.trim()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <MapPin size={15} className="text-indigo-500" />
          Localização
        </span>
        {buscando && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 size={13} className="animate-spin" />
            procurando o município...
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Zona"
          placeholder="Ex.: 1"
          inputMode="numeric"
          value={zona}
          error={errors.zona}
          onChange={e => setNumero('zona', e.target.value)}
        />
        <Input
          label="Seção"
          placeholder="Ex.: 185"
          inputMode="numeric"
          value={secao}
          error={errors.secao}
          onChange={e => setNumero('secao', e.target.value)}
        />

        {/* A cidade é o resultado, não a entrada — só vira campo digitável
            quando a base do TRE-PI não resolve. */}
        {manual ? (
          <Input
            label="Cidade"
            placeholder="Ex.: Teresina"
            value={cidade}
            error={errors.cidade}
            onChange={e => aplicar({ cidade: e.target.value })}
          />
        ) : ambiguo ? (
          <ComboboxSelect
            label="Cidade"
            options={candidatos.map(c => ({ value: c.municipio, label: capitalizarLugar(c.municipio) }))}
            value={cidade}
            onChange={escolherCandidato}
            error={errors.cidade}
            placeholder="Escolha o município"
          />
        ) : (
          <Input
            label="Cidade"
            placeholder="Preencha zona e seção"
            value={capitalizarLugar(cidade)}
            error={errors.cidade}
            readOnly
            hint={deduzida ? 'Deduzida da seção' : pelaZona ? 'Deduzida da zona' : undefined}
          />
        )}
      </div>

      {/* Estado da dedução */}
      {deduzida && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <ShieldCheck size={13} className="shrink-0" />
          Seção confirmada na base do TRE-PI
          {value.local_votacao ? ` — ${value.local_votacao}` : ''}
        </p>
      )}

      {ambiguo && origem === 'par' && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <TriangleAlert size={13} className="shrink-0" />
          Zona {zona} / seção {secao} existe em {candidatos.length} municípios — escolha qual.
        </p>
      )}

      {/* Plano B: a seção não está na base, mas a zona está. A cidade entra
          sem conferência da seção, e o texto precisa dizer isso. */}
      {origem === 'zona' && !manual && (ambiguo || pelaZona) && (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <TriangleAlert size={13} className="shrink-0 mt-0.5" />
          <span>
            A seção {secao} não está na base do TRE-PI — costuma ser seção agregada
            ou extinta.{' '}
            {ambiguo
              ? `A zona ${zona} existe em ${candidatos.length} municípios: escolha qual.`
              : `A zona ${zona} só existe em ${capitalizarLugar(cidade)}, então a cidade veio daí.`}
            {' '}A seção fica sem conferência, e o registro não conta como validado.
          </span>
        </p>
      )}

      {semBase && !manual && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <TriangleAlert size={13} className="shrink-0" />
          Nem a zona {zona} existe na base do TRE-PI — confira o número. Digite a
          cidade à mão se estiver certo.
        </p>
      )}

      {manual && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <Keyboard size={13} className="shrink-0" />
          Cidade digitada à mão: não será conferida com a base oficial.
        </p>
      )}

      {/* Saída de emergência: a base do TRE fica defasada quando o TSE
          remaneja seções, e o agente precisa conseguir salvar assim mesmo. */}
      {!manual && (
        <button
          type="button"
          onClick={digitarCidade}
          className="self-start flex items-center gap-1.5 text-xs font-medium
                     text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <Keyboard size={13} /> Digitar a cidade manualmente
        </button>
      )}
    </div>
  )
}
