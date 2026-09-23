export function somenteDigitos(valor:string){return valor.replace(/\D/g,'').slice(0,12)}

export function formatarTituloEleitor(valor:string){return somenteDigitos(valor).replace(/(\d{4})(?=\d)/g,'$1 ').trim()}

export function tituloEleitorValido(valor:string){
  const titulo=somenteDigitos(valor)
  if(!/^\d{12}$/.test(titulo)||/^(\d)\1{11}$/.test(titulo))return false
  const primeiro=[...titulo.slice(0,8)].reduce((soma,digito,indice)=>soma+Number(digito)*(indice+2),0)%11
  const dv1=primeiro===10?0:primeiro
  let dv2=(Number(titulo[8])*7+Number(titulo[9])*8+dv1*9)%11
  if(dv2===10)dv2=0
  if(dv2===0&&['01','02'].includes(titulo.slice(8,10)))dv2=1
  return Number(titulo[10])===dv1&&Number(titulo[11])===dv2
}
