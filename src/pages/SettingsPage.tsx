import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Download, Trash2, ShieldCheck, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { Card, Input, Button, Modal, PageHeader } from '@/components/ui'

const schema = z.object({
  full_name: z.string().min(3, 'Nome obrigatório'),
  phone:     z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function SettingsPage() {
  const navigate = useNavigate()
  const { profile, user, signOut, refreshProfile } = useAuth()

  const [saved,        setSaved]        = useState(false)
  const [deleteModal,  setDeleteModal]  = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [serverError,  setServerError]  = useState<string | null>(null)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (profile) reset({ full_name: profile.full_name, phone: profile.phone ?? '' })
  }, [profile, reset])

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: values.full_name, phone: values.phone ?? null })
      .eq('id', user!.id)

    if (error) { setServerError(error.message); return }

    await refreshProfile()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleExportData() {
    const data = {
      perfil: {
        nome:         profile?.full_name,
        telefone:     profile?.phone,
        role:         profile?.role,
        cadastro_em:  profile?.created_at,
        lgpd_consent: profile?.lgpd_consent,
      },
      email:       user?.email,
      exportado_em: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'meus_dados_eleitowatch.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setServerError(null)

    // Chama RPC que anonimiza PII e desvincula ocorrências (migration 006)
    const { error } = await supabase.rpc('request_account_deletion')

    if (error) {
      setServerError(error.message)
      setDeleting(false)
      return
    }

    // Faz logout após anonimização
    await signOut()
    navigate('/')
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Configurações"
          subtitle="Gerencie seus dados pessoais e privacidade"
          back="/"
        />

        {/* Dados pessoais */}
        <Card padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
              <User size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Dados pessoais</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Nome completo"
              icon={<User size={16} />}
              error={errors.full_name?.message}
              {...register('full_name')}
            />
            <Input
              label="Telefone (opcional)"
              type="tel"
              icon={<Phone size={16} />}
              error={errors.phone?.message}
              {...register('phone')}
            />

            {serverError && (
              <p className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-4 py-3">
                {serverError}
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={isSubmitting} icon={<Save size={16} />}>
                Salvar alterações
              </Button>
              {saved && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400 animate-fade-in">
                  Dados salvos com sucesso!
                </span>
              )}
            </div>
          </form>
        </Card>

        {/* LGPD */}
        <Card padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40">
              <ShieldCheck size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Privacidade — LGPD</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gerencie seus direitos sobre dados pessoais
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Exportar meus dados
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Baixe todos os seus dados em formato JSON
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Download size={14} />}
                onClick={handleExportData}
              >
                Exportar
              </Button>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-rose-50/60 dark:bg-rose-900/10 border border-rose-200/60 dark:border-rose-800/30">
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
                  Solicitar exclusão de conta
                </p>
                <p className="text-xs text-rose-500/80 dark:text-rose-500/70 mt-0.5">
                  Seus dados pessoais serão anonimizados imediatamente e a conta encerrada
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => setDeleteModal(true)}
              >
                Excluir
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal de confirmação */}
      <Modal
        open={deleteModal}
        onClose={() => !deleting && setDeleteModal(false)}
        title="Excluir minha conta"
        maxWidth="sm"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
          Ao confirmar, as seguintes ações ocorrem <strong>imediatamente</strong>:
        </p>
        <ul className="text-sm text-slate-500 dark:text-slate-400 mb-6 space-y-1 list-disc list-inside">
          <li>Seu nome e telefone são removidos do sistema</li>
          <li>Suas ocorrências são anonimizadas (sem vínculo ao seu perfil)</li>
          <li>Sua sessão é encerrada</li>
          <li>A exclusão total da conta é processada pelo administrador em até 15 dias úteis</li>
        </ul>

        {serverError && (
          <p className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-4 py-3 mb-4">
            {serverError}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={() => setDeleteModal(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            icon={<Trash2 size={16} />}
            onClick={handleDeleteAccount}
          >
            Confirmar exclusão
          </Button>
        </div>
      </Modal>
    </AppShell>
  )
}
