// Formas devolvidas pelas RPCs geográficas (migrations 013 e 014).
//
// Viviam dentro do GeografiaCard, que o redesenho dissolveu em dois cartões.
// Os tipos sobreviveram ao componente porque descrevem a resposta do banco,
// não a tela.

export interface Bairro    { bairro: string;    total: number; secoes: number }
export interface Municipio { municipio: string; total: number; secoes: number; validados: number }

export interface CoberturaGeografica {
  total:               number
  sem_localizacao:     number
  /** Planilha traz NÃO CONSTA em zona e seção — dado nunca coletado */
  sem_zona_secao:      number
  /** Zona e seção preenchidas, mas o par não existe na base do TRE-PI */
  secao_sem_base:      number
  capital:             number
  interior:            number
  municipios:          number
  municipios_interior: number
}

export interface CoberturaBairro {
  total:      number
  com_bairro: number
  bairros:    number
}
