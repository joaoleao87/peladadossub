import {useState} from 'react'
import {Link} from 'react-router-dom'
import {IOSInstallInstructions} from '../components/InstallAppButton'
import {usePwaInstall} from '../hooks/usePwaInstall'
import './install.css'

export function Install(){const {state,install}=usePwaInstall(),[showIOS,setShowIOS]=useState(false);return <main className="install-page"><img src="/logo.png" alt="Pelada dos Sub"/><p className="eyebrow">SEU FUTEBOL, SEMPRE À MÃO</p><h1>Pelada dos Sub</h1>{state==='installed'?<><p>Pelada dos Sub já está instalado neste dispositivo.</p><Link className="install-link" to="/">Abrir Pelada dos Sub</Link></>:<><p>Lista, times, ranking e financeiro em um toque.</p>{state==='installable'&&<button type="button" onClick={()=>void install()}>Instalar App</button>}{state==='ios'&&<button type="button" onClick={()=>setShowIOS(true)}>Adicionar à Tela de Início</button>}{state==='unsupported'&&<><p className="install-note">A instalação não está disponível neste navegador. Você pode continuar acessando normalmente pelo navegador.</p><Link className="install-link secondary" to="/">Acessar pelo navegador</Link></>}{state==='loading'&&<span className="spinner" aria-label="Verificando instalação"/>}</>}{showIOS&&<IOSInstallInstructions onClose={()=>setShowIOS(false)}/>}</main>}
