# ETAPA 4: Registro e Listagem de Ocorrências (Agente)

## Objetivo
Permitir que os agentes (e usuários anônimos) registrem incidentes vinculados a uma seção eleitoral e visualizem seu histórico.

## Interface: Nova Ocorrência (`/ocorrencias/nova`)

1. Formulário (Card Glassmorphism):
   - Localização: Exibir Card com resumo da localização (Mun, Zona, Local, Seção, Urna) capturada no MD.03. Permitir "Alterar Localização".
   - Categoria (Select Moderno): Irregularidade administrativa, Problema com urna, Fila/aglomeração, Acessibilidade, Conduta suspeita, Outro.
   - Descrição (Textarea Moderno): Max 1000 caracteres, validação de no mínimo 20.
   - Upload de Foto: Área de *dropzone* profissional com preview da imagem.

2. Localização Automática:
   - Botão "Obter minha localização atual" (Geolocation API).

3. Envio:
   - Inserir na tabela `ocorrencias` e upload de foto para o bucket `incidents/`.

## Interface: Minhas Ocorrências (`/ocorrencias`)
- Página visível apenas para usuários logados.
- Lista ou Grid de cards Glassmorphism.
- Exibir status (badge colorido com efeito de brilho sutil), data e categoria.

## Ação Esperada do Claude Code
Implemente o formulário completo com validação (Zod/React Hook Form), o upload de arquivos para o Supabase Storage e a visualização em lista com paginação.