import {useState,type FormEvent} from 'react'
import {formatarTituloEleitor,somenteDigitos,tituloEleitorValido} from '../lib/tituloEleitor'
import {enviarTituloEleitor} from '../lib/api'

export function TituloEleitor(){
  const [nome,setNome]=useState(''),[titulo,setTitulo]=useState(''),[mensagem,setMensagem]=useState(''),[enviando,setEnviando]=useState(false)
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    const nomeNormalizado=nome.trim().replace(/\s+/g,' '),numero=somenteDigitos(titulo)
    if(nomeNormalizado.split(' ').length<2){setMensagem('Informe seu nome completo.');return}
    if(!tituloEleitorValido(numero)){setMensagem('Informe um título de eleitor válido.');return}
    setEnviando(true);setMensagem('')
    try{await enviarTituloEleitor(nomeNormalizado,numero);setMensagem('Dados enviados com sucesso.');setNome('');setTitulo('')}
    catch(error){setMensagem(error instanceof Error?error.message:'Não foi possível enviar seus dados.')}
    finally{setEnviando(false)}
  }
  return <main className="titulo-eleitor-page"><div className="auth-mark">SUB</div><p className="eyebrow">CADASTRO</p><h1>Título de eleitor</h1><p>Preencha seu nome completo e o número do título.</p><form className="panel titulo-eleitor-form" onSubmit={submit}>
    <label>Nome completo<input value={nome} onChange={event=>setNome(event.target.value)} autoComplete="name" maxLength={100} required /></label>
    <label>Título de eleitor<input value={titulo} onChange={event=>setTitulo(formatarTituloEleitor(event.target.value))} inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000" aria-describedby="titulo-ajuda" required /></label>
    <small id="titulo-ajuda">A validação confere a estrutura e os dígitos do documento.</small>
    {mensagem&&<p className="form-message" role="status">{mensagem}</p>}
    <button disabled={enviando}>{enviando?'ENVIANDO...':'ENVIAR'}</button>
  </form></main>
}
