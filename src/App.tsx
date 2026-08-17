import {Navigate,Route,Routes} from 'react-router-dom'
import {useAuth} from './auth/AuthContext'
import {Layout} from './components/Layout'
import {Spinner} from './components/Ui'
import {configured} from './lib/supabase'
import {Admin} from './pages/Admin'
import {AuthPage} from './pages/Auth'
import {Dashboard} from './pages/Dashboard'
import {ListPage} from './pages/ListPage'
import {MonthlySignup} from './pages/MonthlySignup'
import {ProfilePage} from './pages/ProfilePage'
import {Ranking} from './pages/Ranking'
import {SuperAdmin} from './pages/SuperAdmin'

function Protected(){const {session,loading}=useAuth();if(loading)return <Spinner/>;return session?<Layout/>:<Navigate to="/auth" replace/>}
function AdminRoute(){const {profile}=useAuth();return profile?.role==='admin'||profile?.role==='superadmin'?<Admin/>:<Navigate to="/" replace/>}
function SuperAdminRoute(){const {profile}=useAuth();return profile?.role==='superadmin'?<SuperAdmin/>:<Navigate to="/" replace/>}
export function App(){if(!configured)return <div className="setup"><div className="auth-mark">SUB</div><h1>Conecte o Supabase</h1><p>Preencha as variáveis do Supabase e execute as migrations.</p></div>;return <Routes><Route path="/auth" element={<AuthPage/>}/><Route path="/cadastro-mensalista" element={<MonthlySignup/>}/><Route element={<Protected/>}><Route index element={<Dashboard/>}/><Route path="lista" element={<ListPage/>}/><Route path="ranking" element={<Ranking/>}/><Route path="perfil" element={<ProfilePage/>}/><Route path="admin" element={<AdminRoute/>}/><Route path="superadmin" element={<SuperAdminRoute/>}/></Route><Route path="*" element={<Navigate to="/"/>}/></Routes>}
