import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Phone, UserPlus, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Card, Input, Button } from '@/components/ui'

const schema = z.object({
  full_name:     z.string().min(3, 'Nome completo obrigatório'),
  phone:         z.string().optional(),
  email:         z.string().email('E-mail inválido'),
  password:      z.string().min(6, 'Mínimo 6 caracteres'),
  lgpd_consent:  z.literal(true, {
    errorMap: () => ({ message: 'Você precisa aceitar os termos LGPD para continuar' }),
  }),
})
type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const { error } = await supabase.auth.signUp({
      email:    values.email,
      password: values.password,
      options: {
        data: {
          full_name:    values.full_name,
          phone:        values.phone ?? null,
          lgpd_consent: true,
        },
      },
    })
    if (error) { setServerError(error.message); return }
    navigate('/buscar-secao')
  }

  return (
    <AuthLayout>
      <Card padding="lg" className="animate-slide-up">
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => navigate('/login')}
            aria-label="Voltar para login"
            className="mt-0.5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600
                       hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/10
                       transition-all duration-200 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Criar conta de agente
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Preencha seus dados para se cadastrar
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Nome completo"
            placeholder="João da Silva"
            icon={<User size={16} />}
            error={errors.full_name?.message}
            {...register('full_name')}
          />
          <Input
            label="Telefone (opcional)"
            type="tel"
            placeholder="(86) 9 0000-0000"
            icon={<Phone size={16} />}
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            icon={<Mail size={16} />}
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Senha"
            type="password"
            placeholder="Mínimo 6 caracteres"
            icon={<Lock size={16} />}
            error={errors.password?.message}
            hint="Use letras e números para maior segurança"
            {...register('password')}
          />

          {/* LGPD */}
          <div className="rounded-xl bg-indigo-50/60 dark:bg-indigo-900/20 border border-indigo-200/60 dark:border-indigo-500/20 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                {...register('lgpd_consent')}
              />
              <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Li e concordo com o tratamento dos meus dados pessoais conforme a{' '}
                <strong>Lei Geral de Proteção de Dados (LGPD)</strong>, e compreendo que
                posso solicitar a exportação ou exclusão dos meus dados a qualquer momento.
              </span>
            </label>
            {errors.lgpd_consent && (
              <p className="mt-2 text-xs text-rose-500">{errors.lgpd_consent.message}</p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-4 py-3">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            icon={<UserPlus size={18} />}
            className="mt-2 w-full"
          >
            Criar conta
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Já tem conta?{' '}
          <Link
            to="/login"
            className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </Card>
    </AuthLayout>
  )
}
