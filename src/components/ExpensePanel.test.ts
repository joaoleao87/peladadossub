import {describe,expect,it} from 'vitest'
import {calculateFinanceSummary,currentCompetence} from '../lib/finance'
import type {Expense,Payment} from '../lib/database.types'

describe('resumo financeiro',()=>{it('separa o que está em caixa, pendente e a pagar',()=>{const income=[{status:'pago',valor:100},{status:'pendente',valor:50},{status:'atrasado',valor:10},{status:'isento',valor:20}] as Payment[],costs=[{parcelas:[{paga:true,valor:30},{paga:false,valor:40}]}] as Expense[];expect(calculateFinanceSummary(income,costs)).toEqual({balance:70,expectedBalance:90,pendingIncome:60,pendingCount:2,futureCosts:40})})})
describe('competência financeira',()=>{it('usa o mês local atual sem avançar para o próximo',()=>{expect(currentCompetence(new Date(2026,8,30,23,59))).toBe('2026-09')})})
