import { useState } from "react";
import { allManagedPlayers, controlPlayer, participants, peladasHistory } from "../lib/api";
import { useLoad } from "../hooks/useLoad";
import { Empty, ErrorState, Spinner, Toast } from "./Ui";
import type { Participant, Player } from "../lib/database.types";
import "./player-control-panel.css";

const labels:Record<string,string>={aguardando_resposta:"Aguardando resposta",confirmado:"Confirmou",presente:"Foi",faltou:"Faltou",recusado:"Não vai",espera:"Suplente",cancelado:"Fora da lista"};
export function PlayerControlPanel(){
  const [filter,setFilter]=useState<"mensalista"|"avulso">("mensalista"),[gameId,setGameId]=useState(""),[toast,setToast]=useState("");
  const state=useLoad(async()=>{const[players,games]=await Promise.all([allManagedPlayers(),peladasHistory()]),selected=gameId||games[0]?.id||"";return{players,games,list:selected?await participants(selected):[]}},gameId);
  if(state.loading)return <Spinner/>;if(state.error)return <ErrorState message={state.error} retry={state.reload}/>;
  const {players,games,list}=state.data!,selectedId=gameId||games[0]?.id||"",game=games.find(item=>item.id===selectedId),rows=players.filter(player=>player.tipo===filter).sort((a,b)=>(a.apelido||a.nome).localeCompare(b.apelido||b.nome,"pt-BR",{sensitivity:"base"})),filteredList=list.filter(item=>rows.some(player=>player.id===item.jogador_id)),numbers=[
    ["Confirmaram",filteredList.filter(item=>item.status==="confirmado").length],
    ["Presentes",filteredList.filter(item=>item.status==="presente"||item.comparecimento===true).length],
    ["Faltaram",filteredList.filter(item=>item.status==="faltou").length],
    ["Suplentes",filteredList.filter(item=>item.status==="espera").length],
    ["Não vão",filteredList.filter(item=>item.status==="recusado").length],
    ["Sem resposta",filteredList.filter(item=>item.status==="aguardando_resposta").length],
  ] as const;
  async function update(player:Player,changes:Partial<Pick<Player,"tipo"|"ativo"|"confirmacao_bloqueada">>,message:string){try{await controlPlayer(player.id,changes.tipo??player.tipo,changes.ativo??player.ativo,changes.confirmacao_bloqueada??Boolean(player.confirmacao_bloqueada));setToast(message);await state.reload()}catch(error){setToast(error&&typeof error==="object"&&"message" in error?String(error.message):"Não foi possível atualizar.")}finally{setTimeout(()=>setToast(""),3500)}}
  const entry=(player:Player)=>list.find((item:Participant)=>item.jogador_id===player.id);
  return <section className="player-control"><header><span><h2>Disponibilidade dos jogadores</h2><small>{game?`${new Date(`${game.data}T12:00`).toLocaleDateString("pt-BR")} • ${game.local}`:"Sem peladas cadastradas"}</small></span><nav><button className={filter==="mensalista"?"active":""} onClick={()=>setFilter("mensalista")}>Mensalistas</button><button className={filter==="avulso"?"active":""} onClick={()=>setFilter("avulso")}>Diaristas</button></nav></header>{games.length>0&&<label className="control-game-picker">Pelada<select value={selectedId} onChange={event=>setGameId(event.target.value)}>{games.map(item=><option value={item.id} key={item.id}>{new Date(`${item.data}T12:00`).toLocaleDateString("pt-BR")} • {item.local}</option>)}</select></label>}<section className="attendance-numbers">{numbers.map(([label,value])=><div key={label}><b>{value}</b><span>{label}</span></div>)}</section>{rows.length?rows.map(player=>{const item=entry(player),name=player.apelido||player.nome;return <article key={player.id}><span><b>{name}</b><small>{item?labels[item.status]||item.status:"Não estava na lista"}</small></span><div className="control-badges"><em className={player.ativo?"ok":"off"}>{player.ativo?"Cadastro ativo":"Cadastro suspenso"}</em><em className={player.confirmacao_bloqueada?"off":"ok"}>{player.confirmacao_bloqueada?"Confirmação bloqueada":"Pode confirmar"}</em></div><nav><button className="secondary" onClick={()=>void update(player,{confirmacao_bloqueada:!player.confirmacao_bloqueada},player.confirmacao_bloqueada?"Confirmação liberada.":"Confirmação suspensa.")}>{player.confirmacao_bloqueada?"Liberar confirmação":"Suspender confirmação"}</button><button className={player.ativo?"danger":"secondary"} onClick={()=>void update(player,{ativo:!player.ativo},player.ativo?"Cadastro suspenso.":"Cadastro reativado.")}>{player.ativo?"Suspender cadastro":"Reativar cadastro"}</button><button onClick={()=>void update(player,{tipo:player.tipo==="mensalista"?"avulso":"mensalista"},"Tipo atualizado.")}>Tornar {player.tipo==="mensalista"?"diarista":"mensalista"}</button></nav></article>}):<Empty title="Nenhum jogador neste grupo"/>}<Toast message={toast}/></section>
}
