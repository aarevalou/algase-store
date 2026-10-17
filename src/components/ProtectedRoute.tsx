import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Protege la navegación local como ayuda de UX; no es una frontera de seguridad. */
export default function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const { user, isAdmin, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <p>Cargando…</p>
  if (!user) return <Navigate to="/ingresar" state={{ from: loc.pathname }} replace />
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
