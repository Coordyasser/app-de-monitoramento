# ETAPA 2: UI Base, Glassmorphism e Fluxo de Autenticação

## Objetivo
Criar a base visual da aplicação web com layout profissional, aplicando a estética Glassmorphism, e implementar o fluxo completo de usuários.

## Stack & Estética
- React + TypeScript + Tailwind CSS
- Ícones: Lucide React
- **Estética:** Layouts baseados em cards flutuantes com `backdrop-blur-lg`, `bg-white/10` (no dark) ou `bg-white/60` (no light), borders finas e sombras suaves. Efeitos de hover sutis.

## Rotas e Interfaces

1. Layout Principal (AppShell):
   - Sidebar ou Topbar de navegação com efeito de vidro.

2. Cadastro (`/register`) e Login (`/login`):
   - Forms centralizados em cards Glassmorphism flutuantes sobre um fundo gradiente sutil.
   - Campos de input modernos e focados.
   - Checkbox LGPD no cadastro.

3. Perfil e Configurações (`/settings`):
   - Card Glassmorphism para editar dados pessoais (nome, telefone).
   - Seção LGPD: Botões profissionais para "Exportar meus dados" e "Solicitar exclusão de conta" (com modal de confirmação).

## Ação Esperada do Claude Code
Configure o React Router e a estrutura de pastas. Implemente os componentes de UI base (Button, Input, Card, Modal) com as classes Tailwind para Glassmorphism. Crie as páginas de auth e settings integradas ao Supabase Auth.