import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, MapPin, ClipboardList, LayoutDashboard, Lock, Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ── Rotas auxiliares ───────────────────────────────────────────────────────
// Ainda não implementadas — links preparados para quando as páginas existirem.
const ROTA_RECUPERAR_SENHA = '/recuperar-senha'
const ROTA_TERMOS          = '/termos'
const ROTA_PRIVACIDADE     = '/privacidade'
const ROTA_SUPORTE         = '/suporte'

// Destino após autenticar (mesmo usado pela LoginPage)
const DESTINO_POS_LOGIN = '/dashboard'

// ── Conteúdo do painel ─────────────────────────────────────────────────────

const recursos = [
  {
    icon:  ClipboardList,
    title: 'Registro padronizado',
    desc:  'Nome, contato, título, vínculo e observações em um formulário só.',
  },
  {
    icon:  MapPin,
    title: 'Localização conferida',
    desc:  'Cidade, zona e seção validadas contra a base oficial do TRE-PI.',
  },
  {
    icon:  LayoutDashboard,
    title: 'Consolidação em tempo real',
    desc:  'Volume, alcance territorial e qualidade dos dados em um painel.',
  },
]

// ── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormValues = z.infer<typeof schema>

// ── Estilos compartilhados ─────────────────────────────────────────────────

const inputClass = [
  'w-full h-12 rounded-[10px] px-3.5 text-[15px]',
  'bg-white text-[#16141F] placeholder:text-[#9B97AD]',
  'border border-[#D4D0E2] transition-colors duration-150',
  'focus:outline-none focus-visible:outline-none',
  'focus:border-[#5B3FD9] focus:ring-2 focus:ring-[#5B3FD9]/35',
].join(' ')

const labelClass = 'text-[14px] font-medium text-[#16141F]'

const linkClass = [
  'font-semibold text-[#4B32C8] hover:text-[#3A25A3] transition-colors duration-150',
  'rounded focus-visible:outline-none focus-visible:ring-2',
  'focus-visible:ring-[#5B3FD9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F5FA]',
].join(' ')

// ── Página ─────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email:    values.email,
      password: values.password,
    })
    if (error) {
      setServerError('Não foi possível entrar. Verifique o e-mail e a senha informados.')
      return
    }
    navigate(DESTINO_POS_LOGIN)
  }

  // Aguarda a resolução da sessão antes de decidir o que renderizar
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F5FA]">
        <Loader2 size={32} className="animate-spin text-[#5B3FD9]" />
      </div>
    )
  }

  // Já autenticado: segue direto para a área logada
  if (session) {
    return <Navigate to={DESTINO_POS_LOGIN} replace />
  }

  const ano = new Date().getFullYear()

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-dm bg-[#17142B]">

      {/* ── Painel escuro ──────────────────────────────────────────────── */}
      <aside
        className="flex flex-col px-6 pt-7 pb-10
                   lg:w-[600px] lg:shrink-0 lg:justify-between lg:px-16 lg:py-12"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-7 lg:mb-0">
          <span className="flex items-center justify-center w-8 h-8 lg:w-9 lg:h-9 rounded-[10px] bg-[#5B3FD9]">
            <ShieldCheck size={19} className="text-white" />
          </span>
          <span className="font-sora font-bold text-[18px] text-white">Concept Plan</span>
        </div>

        {/* Bloco central */}
        <div>
          <p className="text-[13px] font-semibold tracking-[0.12em] text-[#B7A8FF]">
            GESTÃO DE EQUIPES EM CAMPO
          </p>

          <h1
            className="mt-4 font-sora font-bold text-white text-[28px] lg:text-[44px]
                       leading-[1.12] tracking-[-0.025em]"
          >
            Informação de campo, organizada e em tempo real.
          </h1>

          <p className="hidden lg:block mt-5 text-[17px] leading-relaxed text-[#C4BFDD] max-w-[430px]">
            Central única para consolidar, conferir e acompanhar os registros feitos em campo.
          </p>

          <ul className="hidden lg:block mt-10 border-t border-b border-white/[0.12] divide-y divide-white/[0.12]">
            {recursos.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-4 py-[18px]">
                <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-[9px] bg-[#B7A8FF]/[0.14]">
                  <Icon size={18} className="text-[#B7A8FF]" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-white">{title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-[#C4BFDD]">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Rodapé do painel */}
        <p className="hidden lg:flex items-center gap-2 text-[13px] text-[#A9A3C7]">
          <Lock size={14} className="shrink-0" />
          Ambiente restrito · © {ano} Concept Plan
        </p>
      </aside>

      {/* ── Painel claro ───────────────────────────────────────────────── */}
      <main
        className="relative z-10 flex-1 flex flex-col bg-[#F6F5FA]
                   -mt-4 rounded-t-[22px] px-6 pt-8 pb-5
                   lg:mt-0 lg:rounded-none lg:px-16 lg:py-12"
      >
        {/* Topo: solicitar cadastro (desktop) */}
        <p className="hidden lg:block text-right text-[14px] text-[#4F4C63]">
          Não tem acesso?{' '}
          <Link to="/register" className={linkClass}>Solicitar cadastro</Link>
        </p>

        {/* Bloco de login */}
        <div className="flex-1 flex flex-col lg:justify-center lg:items-center">
          <div className="w-full lg:w-[400px]">
            <h2 className="font-sora font-bold text-[22px] lg:text-[28px] text-[#16141F]">
              Entrar na plataforma
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[#4F4C63]">
              Use as credenciais fornecidas pela sua coordenação.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 flex flex-col gap-5">
              {/* E-mail */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-email" className={labelClass}>E-mail</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nome@exemplo.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  className={inputClass}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="login-email-error" className="text-[13px] text-[#B4231F]">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Senha */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="login-password" className={labelClass}>Senha</label>
                  <Link to={ROTA_RECUPERAR_SENHA} className={`${linkClass} text-[13px]`}>
                    Esqueci minha senha
                  </Link>
                </div>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  className={inputClass}
                  {...register('password')}
                />
                {errors.password && (
                  <p id="login-password-error" className="text-[13px] text-[#B4231F]">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 inline-flex items-center justify-center gap-2 w-full h-[50px]
                           rounded-[10px] bg-[#5B3FD9] text-white text-[15px] font-semibold
                           transition-colors duration-150
                           hover:bg-[#4E35BE] disabled:bg-[#8C79E4] disabled:cursor-not-allowed
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FD9]
                           focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F5FA]"
              >
                {isSubmitting && <Loader2 size={17} className="animate-spin" />}
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </button>

              {serverError && (
                <p
                  role="alert"
                  className="rounded-[10px] bg-[#FDECEC] px-4 py-3 text-[14px] text-[#B4231F]"
                >
                  {serverError}
                </p>
              )}
            </form>

            {/* Solicitar cadastro (mobile) */}
            <p className="lg:hidden mt-8 text-center text-[14px] text-[#4F4C63]">
              Não tem acesso?{' '}
              <Link to="/register" className={linkClass}>Solicitar cadastro</Link>
            </p>
          </div>
        </div>

        {/* Rodapé claro */}
        <p className="hidden lg:flex items-center justify-center gap-5 text-[13px] text-[#5E5B72]">
          <Link to={ROTA_TERMOS}      className="hover:text-[#16141F] transition-colors">Termos de uso</Link>
          <Link to={ROTA_PRIVACIDADE} className="hover:text-[#16141F] transition-colors">Privacidade</Link>
          <Link to={ROTA_SUPORTE}     className="hover:text-[#16141F] transition-colors">Suporte</Link>
        </p>

        <p className="lg:hidden mt-5 text-center text-[13px] text-[#5E5B72]">
          Ambiente restrito · © {ano} Concept Plan
        </p>
      </main>
    </div>
  )
}
