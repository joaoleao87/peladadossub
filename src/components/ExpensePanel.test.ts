import {describe,expect,it} from 'vitest'
import {calculateFinanceSummary} from './ExpensePanel'
import type {Expense,Payment} from '../lib/database.types'

describe('resumo financeiro',()=>{it('desconta gastos pagos do saldo e parcelas futuras da previsão',()=>{const income=[{status:'pago',valor:100},{status:'pendente',valor:50},{status:'isento',valor:20}] as Payment[],costs=[{parcelas:[{paga:true,valor:30},{paga:false,valor:40}]}] as Expense[];expect(calculateFinanceSummary(income,costs)).toEqual({balance:70,expectedBalance:80,futureCosts:40})})})
