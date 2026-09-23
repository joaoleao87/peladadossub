import {Link} from 'react-router-dom'
import {ErrorState,Spinner} from '../components/Ui'
import {useLoad} from '../hooks/useLoad'
import {titulosEleitorais} from '../lib/api'
import {formatarTituloEleitor} from '../lib/tituloEleitor'

function escaparXml(valor:string){return valor.replace(/[<>&'"]/g,caractere=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[caractere]!))}
function baixarExcel(dados:Awaited<ReturnType<typeof titulosEleitorais>>){
  const linhas=dados.map(item=>`<Row><Cell><Data ss:Type="String">${escaparXml(item.nome_completo)}</Data></Cell><Cell><Data ss:Type="String">${item.titulo_eleitor}</Data></Cell><Cell><Data ss:Type="String">${new Date(item.created_at).toLocaleString('pt-BR')}</Data></Cell></Row>`).join('')
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Títulos"><Table><Row><Cell><Data ss:Type="String">Nome completo</Data></Cell><Cell><Data ss:Type="String">Título de eleitor</Data></Cell><Cell><Data ss:Type="String">Enviado em</Data></Cell></Row>${linhas}</Table></Worksheet></Workbook>`
  const url=URL.createObjectURL(new Blob([xml],{type:'application/vnd.ms-excel'})),link=document.createElement('a')
  link.href=url;link.download='titulos-eleitorais.xls';link.click();URL.revokeObjectURL(url)
}
function baixarPdf(dados:Awaited<ReturnType<typeof titulosEleitorais>>){
  const janela=window.open('','_blank')
  if(!janela)return
  const linhas=dados.map(item=>`<tr><td>${escaparXml(item.nome_completo)}</td><td>${formatarTituloEleitor(item.titulo_eleitor)}</td><td>${new Date(item.created_at).toLocaleString('pt-BR')}</td></tr>`).join('')
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Títulos eleitorais</title><style>body{font:14px Arial;color:#111;margin:32px}h1{font-size:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#eee}</style></head><body><h1>Títulos de eleitor</h1><table><thead><tr><th>Nome completo</th><th>Título</th><th>Enviado em</th></tr></thead><tbody>${linhas}</tbody></table></body></html>`)
  janela.document.close();janela.focus();janela.print()
}
export function AdminTitulosEleitorais(){
  const state=useLoad(titulosEleitorais)
  if(state.loading)return <Spinner/>
  if(state.error)return <ErrorState message={state.error} retry={state.reload}/>
  const dados=state.data!
  return <section><p className="eyebrow">DIRETORIA</p><h1>Títulos de eleitor</h1><div className="admin-actions"><Link className="button-link secondary" to="/admin">VOLTAR AO ADMIN</Link><button onClick={()=>baixarPdf(dados)} disabled={!dados.length}>BAIXAR PDF</button><button onClick={()=>baixarExcel(dados)} disabled={!dados.length}>BAIXAR EXCEL</button></div>{dados.length?<div className="panel tabela-titulos"><table><thead><tr><th>Nome completo</th><th>Título</th><th>Enviado em</th></tr></thead><tbody>{dados.map(item=><tr key={item.id}><td>{item.nome_completo}</td><td>{formatarTituloEleitor(item.titulo_eleitor)}</td><td>{new Date(item.created_at).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div>:<div className="empty"><span>—</span><strong>Nenhum envio ainda</strong><small>Os formulários enviados aparecerão aqui.</small></div>}</section>
}
