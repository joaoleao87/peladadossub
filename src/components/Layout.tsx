import { CalendarDays, Home, ListOrdered, Shield, Trophy, UserRound } from './Icons'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const links = [{ to: '/', label: 'Início', icon: Home }, { to: '/lista', label: 'Lista', icon: ListOrdered }, { to: '/ranking', label: 'Ranking', icon: Trophy }, { to: '/perfil', label: 'Perfil', icon: UserRound }]
export function Layout() { const { profile } = useAuth(); return <><header><div className="brand"><span>SUB</span><div>PELADA<br/><b>DOS SUB</b></div></div><CalendarDays width={22}/></header><main><Outlet /></main><nav className="bottom-nav">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}><Icon/><span>{label}</span></NavLink>)}{profile?.role === 'admin' && <NavLink to="/admin"><Shield/><span>Admin</span></NavLink>}</nav></> }
