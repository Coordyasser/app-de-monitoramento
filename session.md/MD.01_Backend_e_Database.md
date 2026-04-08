# ETAPA 1: Setup do Backend, Banco de Dados e Edge Functions (TRE-PI)

## Objetivo
Configurar a fundação do EleitoWatch no Supabase, garantindo segurança (RLS), relacionamentos e a integração oficial com a API CKAN do TRE-PI para os 5 níveis de localização.

## Stack
- Supabase (Database, Auth, Storage, Edge Functions)

## Schema e Tabelas (PostgreSQL)

1. Tabela `profiles`:
   - id (uuid, pk, references auth.users)
   - full_name (text)
   - phone (text)
   - role (text: 'agent' | 'admin') default 'agent'
   - lgpd_consent (boolean)
   - created_at (timestamp)

2. Tabela `secoes_eleitorais_pi` (Cache da API CKAN do TRE-PI):
   - id (uuid, pk)
   - municipio (text)
   - zona (text)
   - local_votacao (text)
   - secao (text)
   - urna (text) - Identificação/Código da Urna
   - last_synced (timestamp)
   - INDEXES nas colunas `municipio`, `zona`, e `local_votacao` para otimizar os filtros em cascata.

3. Tabela `ocorrencias`:
   - id (uuid, pk)
   - user_id (uuid, references profiles.id, nullable)
   - secao_id (uuid, references secoes_eleitorais_pi.id)
   - categoria (text)
   - descricao (text, max 1000 chars)
   - foto_url (text, nullable)
   - latitude (float, nullable)
   - longitude (float, nullable)
   - status (text: 'pendente' | 'em_analise' | 'arquivada') default 'pendente'
   - created_at (timestamp)

## Edge Functions (Integração TRE-PI)
- Criar a Supabase Edge Function `sync-tre-pi-ckan`.
- A função deve consumir a API CKAN (`/api/3/action/datastore_search?resource_id=[ID_RECURSO]`).
- Lógica de sincronização: Fazer GET, parsear os dados e realizar *upsert* na tabela `secoes_eleitorais_pi`.

## Ação Esperada do Claude Code
Gere os scripts SQL para tabelas, RLS policies e bucket `incidents`. Crie o esqueleto TypeScript da Edge Function `sync-tre-pi-ckan`. Configure os tipos do TypeScript do Supabase.