import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }        from '@/contexts/AuthContext'
import { LocationProvider }    from '@/contexts/LocationContext'
import { RequireAuth }         from '@/components/routing/RequireAuth'

import { HomePage }            from '@/pages/HomePage'
import { LoginPage }           from '@/pages/LoginPage'
import { RegisterPage }        from '@/pages/RegisterPage'
import { SettingsPage }        from '@/pages/SettingsPage'
import { DashboardPage }       from '@/pages/DashboardPage'
import { RegistrosPage }       from '@/pages/RegistrosPage'
import { NovoRegistroPage }    from '@/pages/NovoRegistroPage'
import { AcessoRevogadoPage }  from '@/pages/AcessoRevogadoPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
          <Routes>
            {/* ── Públicas ─────────────────────────────────────────── */}
            <Route path="/"         element={<HomePage />}   />
            <Route path="/login"    element={<LoginPage />}  />
            <Route path="/register" element={<RegisterPage />} />

            {/* Informativa — conta revogada */}
            <Route path="/acesso-revogado" element={<AcessoRevogadoPage />} />

            {/* ── Central de registros ──────────────────────────────── */}
            <Route path="/dashboard" element={
              <RequireAuth><DashboardPage /></RequireAuth>
            } />
            <Route path="/registros" element={
              <RequireAuth><RegistrosPage /></RequireAuth>
            } />
            <Route path="/registros/novo" element={
              <RequireAuth><NovoRegistroPage /></RequireAuth>
            } />
            <Route path="/settings" element={
              <RequireAuth><SettingsPage /></RequireAuth>
            } />

            {/* ── Rotas do escopo antigo (ocorrências) ──────────────────
                Saíram da navegação na virada para a central de registros.
                As páginas seguem no repositório; para reativá-las basta
                registrar as rotas de volta aqui.                        */}
            <Route path="/buscar-secao"    element={<Navigate to="/registros/novo" replace />} />
            <Route path="/ocorrencias/nova" element={<Navigate to="/registros/novo" replace />} />
            <Route path="/ocorrencias"     element={<Navigate to="/registros" replace />} />
            <Route path="/admin"           element={<Navigate to="/dashboard" replace />} />

            {/* ── Fallback ──────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
