import {Navigate,Route,Routes} from 'react-router-dom'
import {useAuth} from './auth/AuthContext'
import {Layout} from './components/Layout'
import {Spinner} from './components/Ui'
import {configured} from './lib/supabase'
import {Admin} from './pages/Admin'
import {AuthPage} from './pages/Auth'
import {Dashboard} from './pages/Dashboard'
import {Finance} from './pages/Finance'
import {ListPage} from './pages/ListPage'
import {Install} from './pages/Install'
import {MyCard} from './pages/MyCard'
import {MatchControlPage} from './pages/MatchControl'
import {ControlInvite} from './pages/ControlInvite'
import {RecordingCamera} from "./pages/RecordingCamera"
import {ProfilePage} from './pages/ProfilePage'
import {Ranking} from './pages/Ranking'
import {SuperAdmin} from './pages/SuperAdmin'

function Protected(){const {session,loading}=useAuth();if(loading)return <Spinner/>;return session?<Layout/>:<Navigate to="/auth" replace/>}
function RecordingRoute(){const {realProfile}=useAuth();return realProfile?.role==="superadmin"?<RecordingCamera/>:<Navigate to="/" replace/>}
function AdminRoute(){const {profile}=useAuth();return profile?.role==='admin'||profile?.role==='superadmin'?<Admin/>:<Navigate to="/" replace/>}
function SuperAdminRoute(){const {realProfile}=useAuth();return realProfile?.role==='superadmin'?<SuperAdmin/>:<Navigate to="/" replace/>}
export function App(){if(!configured)return <div className="setup"><div className="auth-mark">SUB</div><h1>Conecte o Supabase</h1><p>Preencha as variáveis do Supabase e execute as migrations.</p></div>;return <Routes><Route path="/instalar" element={<Install/>}/><Route path="/auth" element={<AuthPage/>}/><Route path="/controle-partida/convite/:token" element={<ControlInvite/>}/><Route element={<Protected/>}><Route index element={<Dashboard/>}/><Route path="lista" element={<ListPage/>}/><Route path="cartinha" element={<MyCard/>}/><Route path="ranking" element={<Ranking/>}/><Route path="perfil" element={<ProfilePage/>}/><Route path="financeiro" element={<Finance/>}/><Route path="controle-partida" element={<MatchControlPage/>}/><Route path="controle-partida/:peladaId/camera" element={<RecordingRoute/>}/><Route path="admin" element={<AdminRoute/>}/><Route path="superadmin" element={<SuperAdminRoute/>}/></Route><Route path="*" element={<Navigate to="/"/>}/></Routes>}
