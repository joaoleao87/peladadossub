import type {Expense,Payment} from './database.types'
export function calculateFinanceSummary(income:Payment[],costs:Expense[]){const received=income.filter(x=>x.status==='pago').reduce((sum,x)=>sum+Number(x.valor),0),pending=income.filter(x=>['pendente','atrasado'].includes(x.status)),pendingIncome=pending.reduce((sum,x)=>sum+Number(x.valor),0),installments=costs.flatMap(x=>x.parcelas),paidCosts=installments.filter(x=>x.paga).reduce((sum,x)=>sum+Number(x.valor),0),futureCosts=installments.filter(x=>!x.paga).reduce((sum,x)=>sum+Number(x.valor),0);return{balance:received-paidCosts,expectedBalance:received+pendingIncome-paidCosts-futureCosts,pendingIncome,pendingCount:pending.length,futureCosts}}
export function currentCompetence(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}

export type PaymentStatusFilter='todos'|'pago'|'em_aberto'|'isento'

export function paymentPlayerName(payment:Payment){
  return payment.player?.apelido||payment.player?.nome||payment.profile?.apelido||payment.profile?.nome||'Jogador'
}

export function filterAndSortPayments(payments:Payment[],query='',status:PaymentStatusFilter='todos'){
  const normalizedQuery=query.trim().toLocaleLowerCase('pt-BR')
  return payments
    .filter((payment)=>{
      const matchesName=!normalizedQuery||paymentPlayerName(payment).toLocaleLowerCase('pt-BR').includes(normalizedQuery)
      const matchesStatus=status==='todos'
        ||(status==='em_aberto'&&['pendente','atrasado'].includes(payment.status))
        ||payment.status===status
      return matchesName&&matchesStatus
    })
    .sort((a,b)=>{
      const paidOrder=Number(b.status==='pago')-Number(a.status==='pago')
      return paidOrder||paymentPlayerName(a).localeCompare(paymentPlayerName(b),'pt-BR',{sensitivity:'base'})
    })
}
