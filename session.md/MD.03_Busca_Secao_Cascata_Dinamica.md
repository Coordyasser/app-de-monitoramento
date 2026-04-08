# ETAPA 3: Fluxo de Localização Dinâmico (Cascata TRE-PI)

## Objetivo
Implementar o fluxo de seleção de local de votação através de *Selects* encadeados (cascata), consumindo os dados oficiais (Município -> Zona -> Local -> Seção -> Urna) da nossa tabela sincronizada com o CKAN.

## Interface e Lógica de Cascata (`/buscar-secao`)

O frontend deve apresentar 5 componentes `<Select>` (estilo Glassmorphism) independentes. Cada select só é habilitado quando o anterior for preenchido, e as opções do select atual devem ser filtradas com base nas escolhas anteriores.

1. Município:
   - Query: `SELECT DISTINCT municipio FROM secoes_eleitorais_pi ORDER BY municipio`

2. Zona Eleitoral:
   - Habilitado após Município. Filtra zonas por município.

3. Local de Votação:
   - Habilitado após Zona. Filtra locais por município E zona.

4. Seção Eleitoral:
   - Habilitado após Local. Filtra seções por mun, zona E local.

5. Urna:
   - Habilitado após Seção. Retorna a urna específica atrelada.

## Tratamento de UI/UX
- Indicadores de loading profissionais nos Selects.
- Reset automático e desabilitação dos selects inferiores se o superior for alterado.
- Botão primário "Confirmar Localização e Registrar Ocorrência" liberado apenas após os 5 campos estarem preenchidos.

## Ação Esperada do Claude Code
Implemente a página usando React Hook Form para gerenciar o estado dependente. Crie hooks customizados que usem o Supabase SDK para buscar as opções dinamicamente no banco, garantindo resposta imediata.