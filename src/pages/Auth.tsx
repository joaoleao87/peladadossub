import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'

export function AuthPage() { const { session }=useAuth(); const [mode,setMode]=useState<'login'|'reset'>('login'); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); if(session)return <Navigate to="/" replace/>;
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');const f=new FormData(e.currentTarget),email=String(f.get('email')),password=String(f.get('password')||'');try{if(mode==='login'){const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error}else{const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/perfil`});if(error)throw error;setMessage('Enviamos o link de recuperação.')}}catch(err){setMessage(err instanceof Error?err.message:'Não foi possível continuar.')}finally{setBusy(false)}}
  return <div className="auth-page"><div className="auth-mark">SUB</div><h1>PELADA<br/><em>DOS SUB</em></h1><p>Acesso exclusivo para jogadores cadastrados.</p><form onSubmit={submit}><label>E-mail<input name="email" type="email" required autoComplete="email"/></label>{mode==='login'&&<label>Senha<input name="password" type="password" minLength={6} required autoComplete="current-password"/></label>}<button disabled={busy}>{busy?'AGUARDE…':mode==='login'?'ENTRAR':'ENVIAR LINK'}</button>{message&&<div className="form-message">{message}</div>}</form><div className="auth-links">{mode==='reset'?<button onClick={()=>setMode('login')}>Voltar ao login</button>:<button onClick={()=>setMode('reset')}>Esqueci a senha</button>}</div></div>
}
