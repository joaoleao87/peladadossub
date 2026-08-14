import { useAuth } from '../auth/AuthContext'
import { Empty,ErrorState,Spinner } from '../components/Ui'
import { useLoad } from '../hooks/useLoad'
import { nextPelada,participants } from '../lib/api'
import type { Participant } from '../lib/database.types'

export function ListPage(){const {profile}=useAuth();const state=useLoad(async()=>{const game=await nextPelada();return{game,list:game?await participants(game.id):[]}});if(state.loading)return <Spinner/>;if(state.error)return <ErrorState message={state.error} retry={state.reload}/>;if(!state.data?.game)return <section><h1>Lista</h1><Empty title="Sem pelada marcada"/></section>;const active=state.data.list.filter(p=>['confirmado','presente'].includes(p.status)),line=active.filter(p=>p.categoria!=='goleiro'),waiting=state.data.list.filter(p=>p.status==='espera'),keepers=active.filter(p=>p.categoria==='goleiro');
  const group=(title:string,items:Participant[])=><div className="list-group"><div className="list-heading"><h2>{title}</h2><span>{items.length}</span></div>{items.length?items.map((p,i)=>{const name=p.player?.apelido||p.player?.nome||p.profile?.apelido||p.profile?.nome||'?';return <div className={`player ${p.user_id===profile?.id?'me':''}`} key={p.id}><b>{i+1}</b><div className="avatar">{p.profile?.foto_url?<img src={p.profile.foto_url} alt=""/>:name[0]}</div><span>{name}{p.user_id===profile?.id&&<small> VOCÊ</small>}</span></div>}):<Empty title="Ninguém por aqui"/>}</div>
  return <section><p className="eyebrow">{new Date(`${state.data.game.data}T12:00`).toLocaleDateString('pt-BR')} • {state.data.game.horario.slice(0,5)}</p><h1>Lista da pelada</h1>{group('Confirmados',line)}{group('Suplentes',waiting)}{group('Goleiros',keepers)}</section>}
