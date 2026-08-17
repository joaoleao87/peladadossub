import {lazy,Suspense} from 'react'
import {Spinner} from '../components/Ui'
import {ExpensePanel} from '../components/ExpensePanel'

const FinancePanel=lazy(()=>import('../components/FinancePanel').then(module=>({default:module.FinancePanel})))
export function Finance(){return <section><p className="eyebrow">DIRETORIA</p><h1>Financeiro</h1><ExpensePanel/><Suspense fallback={<Spinner/>}><FinancePanel/></Suspense></section>}
