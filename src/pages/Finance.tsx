import {lazy,Suspense} from 'react'
import {Spinner} from '../components/Ui'

const FinancePanel=lazy(()=>import('../components/FinancePanel').then(module=>({default:module.FinancePanel})))
export function Finance(){return <section><p className="eyebrow">DIRETORIA</p><h1>Financeiro</h1><Suspense fallback={<Spinner/>}><FinancePanel/></Suspense></section>}
