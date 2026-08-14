import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { Spinner } from './components/Ui'
import { configured } from './lib/supabase'
import { AuthPage } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { ListPage } from './pages/ListPage'
import { Ranking } from './pages/Ranking'
import { ProfilePage } from './pages/ProfilePage'
import { Admin } from './pages/Admin'

function Protected() { const { session, loading } = useAuth(); if (loading) return <Spinner/>; return session ? <Layout/> : <Navigate to="/auth" replace /> }
function AdminRoute() { const { profile } = useAuth(); return profile?.role === 'admin' ? <Admin/> : <Navigate to="/" replace /> }
export function App() { if (!configured) return <div className="setup"><div className="auth-mark">SUB</div><h1>Conecte o Supabase</h1><p>Copie <code>.env.example</code> para <code>.env.local</code>, preencha a URL e a chave anônima, e execute a migration.</p></div>; return <Routes><Route path="/auth" element={<AuthPage/>}/><Route element={<Protected/>}><Route index element={<Dashboard/>}/><Route path="lista" element={<ListPage/>}/><Route path="ranking" element={<Ranking/>}/><Route path="perfil" element={<ProfilePage/>}/><Route path="admin" element={<AdminRoute/>}/></Route><Route path="*" element={<Navigate to="/"/>}/></Routes> }
