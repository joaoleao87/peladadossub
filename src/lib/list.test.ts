import { describe, expect, it } from 'vitest'

function statusFor(confirmed: number, limit: number) { return confirmed < limit ? 'confirmado' : 'espera' }

describe('regra visual da lista', () => {
  it('reflete a regra transacional do banco na última vaga', () => {
    expect(statusFor(19, 20)).toBe('confirmado')
    expect(statusFor(20, 20)).toBe('espera')
  })
})
