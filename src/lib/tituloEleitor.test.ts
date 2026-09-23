import {describe,expect,it} from 'vitest'
import {formatarTituloEleitor,tituloEleitorValido} from './tituloEleitor'

describe('título de eleitor',()=>{
  it('valida os dígitos verificadores e formata a entrada',()=>{
    expect(tituloEleitorValido('0043 5687 0906')).toBe(true)
    expect(tituloEleitorValido('004356870907')).toBe(false)
    expect(tituloEleitorValido('000000000000')).toBe(false)
    expect(formatarTituloEleitor('004356870906')).toBe('0043 5687 0906')
  })
})
