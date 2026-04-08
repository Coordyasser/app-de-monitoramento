import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, LogIn, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Card, Input, Button } from '@/components/ui'

const schema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
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
    if (error) { setServerError(error.message); return }
    navigate('/buscar-secao')
  }

  return (
    <AuthLayout>
      <Card padding="lg" className="animate-slide-up">
        {/* Cabeçalho com voltar */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => navigate('/')}
            aria-label="Voltar"
            className="mt-0.5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600
                       hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/10
                       transition-all duration-200 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Entrar na plataforma
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Acesse com suas credenciais de agente
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
            placeholder="••••••••"
            icon={<Lock size={16} />}
            error={errors.password?.message}
            {...register('password')}
          />

          {serverError && (
            <p className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-4 py-3">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            icon={<LogIn size={18} />}
            className="mt-2 w-full"
          >
            Entrar
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Não tem conta?{' '}
          <Link
            to="/register"
            className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Cadastre-se
          </Link>
        </p>
      </Card>
    </AuthLayout>
  )
}
