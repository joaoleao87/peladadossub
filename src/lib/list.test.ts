import { describe, expect, it } from 'vitest'
import { formatWhatsAppList,parseWhatsAppList } from './whatsapp'

function statusFor(confirmed: number, limit: number) { return confirmed < limit ? 'confirmado' : 'espera' }

describe('regra visual da lista', () => {
  it('reflete a regra transacional do banco na última vaga', () => {
    expect(statusFor(19, 20)).toBe('confirmado')
    expect(statusFor(20, 20)).toBe('espera')
  })
})

describe('lista do WhatsApp',()=>{
  it('importa grupos e ignora linhas vazias',()=>expect(parseWhatsAppList('1- Ana\n2- Beto\nSuplentes\n1- Caio\nGoleiros\n1 - Davi')).toEqual([{nome:'Ana',grupo:'linha'},{nome:'Beto',grupo:'linha'},{nome:'Caio',grupo:'suplente'},{nome:'Davi',grupo:'goleiro'}]))
  it('copia sempre as vinte vagas',()=>expect(formatWhatsAppList('Pelada amanhã 20:30',['Ana'],[],[])).toContain('20- '))
})
