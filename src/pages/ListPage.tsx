import {useState} from 'react'
import {useAuth} from '../auth/AuthContext'
import {Empty,ErrorState,Spinner} from '../components/Ui'
import {useLoad} from '../hooks/useLoad'
import {participants,peladasHistory} from '../lib/api'
import type {Participant} from '../lib/database.types'

export function ListPage(){
  const {profile}=useAuth(),[selected,setSelected]=useState('')
  const state=useLoad(async()=>{const games=await peladasHistory();const entries=await Promise.all(games.map(async game=>[game.id,await participants(game.id)] as const));return{games,lists:Object.fromEntries(entries) as Record<string,Participant[]>}})
  if(state.loading)return <Spinner/>;if(state.error)return <ErrorState message={state.error} retry={state.reload}/>
  const games=state.data?.games??[],game=games.find(x=>x.id===(selected||games[0]?.id))
  if(!game)return <section><h1>Peladas</h1><Empty title="Sem peladas registradas"/></section>
  const list:Participant[]=state.data?.lists[game.id]??[],active=list.filter(p=>['confirmado','presente'].includes(p.status)),line=active.filter(p=>p.categoria!=='goleiro'),waiting=list.filter(p=>p.status==='espera'),keepers=active.filter(p=>p.categoria==='goleiro')
  const group=(title:string,items:Participant[])=><div className="list-group"><div className="list-heading"><h2>{title}</h2><span>{items.length}</span></div>{items.length?items.map((p,i)=>{const name=p.player?.apelido||p.player?.nome||p.profile?.apelido||p.profile?.nome||'?';return <div className={`player ${p.user_id===profile?.id?'me':''}`} key={p.id}><b>{i+1}</b><div className="avatar">{p.profile?.foto_url?<img src={p.profile.foto_url} alt=""/>:name[0]}</div><span>{name}{p.user_id===profile?.id&&<small> VOCÊ</small>}</span></div>}):<Empty title="Ninguém por aqui"/>}</div>
  return <section><p className="eyebrow">HISTÓRICO E PRÓXIMAS</p><h1>Peladas</h1><label className="game-picker">Escolha a pelada<select value={game.id} onChange={e=>setSelected(e.target.value)}>{games.map(item=><option value={item.id} key={item.id}>{new Date(`${item.data}T12:00`).toLocaleDateString('pt-BR')} • {item.horario.slice(0,5)} • {item.local}</option>)}</select></label><p className="eyebrow">{new Date(`${game.data}T12:00`).toLocaleDateString('pt-BR')} • {game.horario.slice(0,5)}</p>{group('Confirmados',line)}{group('Suplentes',waiting)}{group('Goleiros',keepers)}</section>
}
