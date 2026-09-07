import {FinanceCenter} from '../components/FinanceCenter'
import {MyPayments} from '../components/MyPayments'
import {useAuth} from '../auth/AuthContext'
export function Finance(){const{profile}=useAuth(),admin=profile?.role==='admin'||profile?.role==='superadmin';return <section><p className="eyebrow">{admin?'DIRETORIA':'MEUS PAGAMENTOS'}</p><h1>Financeiro</h1>{admin?<FinanceCenter/>:<MyPayments/>}</section>}
