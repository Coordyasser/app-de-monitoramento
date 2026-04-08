import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }        from '@/contexts/AuthContext'
import { LocationProvider }    from '@/contexts/LocationContext'
import { RequireAuth }         from '@/components/routing/RequireAuth'

import { HomePage }            from '@/pages/HomePage'
import { LoginPage }           from '@/pages/LoginPage'
import { RegisterPage }        from '@/pages/RegisterPage'
import { SettingsPage }        from '@/pages/SettingsPage'
import { BuscarSecaoPage }     from '@/pages/BuscarSecaoPage'
import { OcorrenciasPage }     from '@/pages/OcorrenciasPage'
import { NovaOcorrenciaPage }  from '@/pages/NovaOcorrenciaPage'
import { AdminPage }           from '@/pages/AdminPage'
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

            {/* ── Semi-pública — denúncia anônima permitida ─────────── */}
            <Route path="/buscar-secao"    element={<BuscarSecaoPage />}   />
            <Route path="/ocorrencias/nova" element={<NovaOcorrenciaPage />} />

            {/* ── Autenticadas ──────────────────────────────────────── */}
            <Route path="/settings" element={
              <RequireAuth><SettingsPage /></RequireAuth>
            } />
            <Route path="/ocorrencias" element={
              <RequireAuth><OcorrenciasPage /></RequireAuth>
            } />

            {/* ── Admin only ────────────────────────────────────────── */}
            <Route path="/admin" element={
              <RequireAuth adminOnly><AdminPage /></RequireAuth>
            } />

            {/* ── Fallback ──────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
