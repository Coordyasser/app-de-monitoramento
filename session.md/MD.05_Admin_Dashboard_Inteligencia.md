# ETAPA 5: Dashboard Administrativo e Análise de Dados

## Objetivo
Criar o painel de controle central para coordenadores monitorarem o Piauí em tempo real, com métricas, análises e estética profissional Admin. Acesso restrito a usuários com `role === 'admin'`.

## Layout e Componentes (`/admin`)

1. Métricas de Topo (Cards Glassmorphism):
   - Total de ocorrências hoje (com indicador de tendência % vs. ontem).
   - Ocorrências Pendentes (com badge Amber).
   - Agentes Ativos (últimas 24h).

2. Análise Visual (Gráficos proprietários):
   - Gráfico de Pizza/Donut: Distribuição de ocorrências por Categoria.
   - Gráfico de Barras: Top 10 Municípios com mais Ocorrências.

3. Tabela de Ocorrências em Tempo Real (Painel Principal):
   - Colunas: ID, Categoria, Município, Zona, Seção, Urna, Data/hora, Status.
   - Ações: Ver detalhes, Alterar Status (dropdown Amber/Rose/Emerald).

4. Gestão de Agentes e Logs LGPD (Aba Separada):
   - Tabela de perfis com opção de revogar credenciais.
   - Visualização dos logs de consentimento.

## Ação Esperada do Claude Code
Crie queries avançadas no Supabase (views/RPCs) para agregar dados dos gráficos. Proteja a rota admin. Implemente a UI do dashboard usando Recharts para os gráficos e componentes de tabela modernos.