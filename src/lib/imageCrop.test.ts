import{describe,expect,it}from'vitest'
import{cropGeometry}from'./imageCrop'
describe('corte de avatar',()=>{it('impede arrastar a imagem para fora da área de corte',()=>{const result=cropGeometry(600,400,1,999,-999);expect(result.offsetX).toBe(75);expect(result.offsetY).toBeCloseTo(0);expect(result.sourceSize).toBe(400);expect(result.sourceX).toBeCloseTo(0);expect(result.sourceY).toBeCloseTo(0)})})
