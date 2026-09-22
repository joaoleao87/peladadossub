import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { attributeMatchGoal, controllablePeladas, initializeMatchControl, matchControlSnapshot, registerMatchDevice, serverClockOffset } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useLoad } from "../hooks/useLoad";
import { supabase } from "../lib/supabase";
import { nativeMatchControls } from "../lib/nativeMatchControls";
import { enqueueMatchCommand, flushMatchCommands, matchDeviceId, pendingMatchCommands } from "../lib/matchOffline";
import type { ControlledMatchEvent, MatchControlSnapshot, Participant } from "../lib/database.types";
import { Empty, ErrorState, Spinner, Toast } from "../components/Ui";
import { RecordingGallery } from "../components/RecordingGallery";
import coinHeads from "../../docs/cara.png";
import coinTails from "../../docs/coroa.png";
import "./match-control.css";

const pad = (value:number) => String(value).padStart(2,"0");
const formatClock = (ms:number) => `${pad(Math.floor(ms/60000))}:${pad(Math.floor(ms%60000/1000))}`;
const playerName = (snapshot:MatchControlSnapshot,id:string) => {
  const item=snapshot.participants.find(row=>row.jogador_id===id);
  return item?.player?.apelido||item?.player?.nome||"Jogador";
};
const playerLabel = (player:Participant) => `${player.player?.apelido||player.player?.nome||"Jogador"}${player.categoria==="goleiro"?" (goleiro)":""}`;

function GoalDetails({event,players,teamName,onSaved}:{event:ControlledMatchEvent;players:Participant[];teamName:string;onSaved:(eventId:string,playerId:string,assistId:string|null)=>Promise<void>}) {
  const [scorer,setScorer]=useState(event.player_id??""),[assist,setAssist]=useState(event.assist_player_id??""),[busy,setBusy]=useState(false);
  async function save(){if(!scorer)return;setBusy(true);try{await onSaved(event.id,scorer,assist||null)}finally{setBusy(false)}}
  return <article className={`goal-details ${event.status==="CANCELLED"?"cancelled":""}`}>
    <b>GOL • {teamName}</b>
    {event.status==="CANCELLED"?<small>Gol desfeito</small>:<div>
      <label>Quem marcou?<select aria-label={`Autor do gol do ${teamName}`} value={scorer} onChange={item=>setScorer(item.target.value)}><option value="">Selecione o jogador</option>{players.map(player=><option key={player.jogador_id} value={player.jogador_id}>{playerLabel(player)}</option>)}</select></label>
      <label>Assistência (opcional)<select aria-label={`Assistência do gol do ${teamName}`} value={assist} onChange={item=>setAssist(item.target.value)}><option value="">Sem assistência</option>{players.filter(player=>player.jogador_id!==scorer).map(player=><option key={player.jogador_id} value={player.jogador_id}>{playerLabel(player)}</option>)}</select></label>
      <button className="mini" type="button" disabled={!scorer||busy} onClick={()=>void save()}>{busy?"SALVANDO…":"SALVAR"}</button>
    </div>}
  </article>
}

function MatchEvents({snapshot,onSaved}:{snapshot:MatchControlSnapshot;onSaved:(eventId:string,playerId:string,assistId:string|null)=>Promise<void>}) {
  const goals=snapshot.events.filter(event=>event.type==="GOAL");
  return <section className="match-events panel"><h3>Gols e assistências</h3><p>Escolha qualquer participante da pelada, inclusive goleiros.</p>{goals.length?goals.map(event=><GoalDetails event={event} players={snapshot.participants} teamName={event.team_id===event.match?.team_home?"TIME A":"TIME B"} onSaved={onSaved} key={event.id}/>):<small>Nenhum gol registrado.</small>}</section>;
}

function CoinToss() {
  const [result,setResult]=useState<"cara"|"coroa"|null>(null),[face,setFace]=useState<"cara"|"coroa">("cara"),[tossing,setTossing]=useState(false),[roll,setRoll]=useState(0);
  function toss(){setResult(null);setRoll(value=>value+1);setTossing(true);const next=Math.random()<.5?"cara":"coroa",flip=window.setInterval(()=>setFace(value=>value==="cara"?"coroa":"cara"),120);setTimeout(()=>{clearInterval(flip);setFace(next);setResult(next);setTossing(false)},1200)}
  return <><div className={`coin ${tossing?"spinning":""}`} key={roll}><img src={face==="coroa"?coinTails:coinHeads} alt={result??"Moeda"}/></div>{result!==null&&<strong className="coin-result">RESULTADO: {result.toUpperCase()}</strong>}<button className="secondary" disabled={tossing} onClick={toss}>CARA OU COROA</button></>;
}

function MatchController({peladaId,onBack,showEvents=true}:{peladaId:string;onBack?:()=>void;showEvents?:boolean}) {
  const state=useLoad(()=>matchControlSnapshot(peladaId),peladaId);
  const[offset,setOffset]=useState(0),[tick,setTick]=useState(0),[toast,setToast]=useState(""),[busy,setBusy]=useState(false),[pending,setPending]=useState(0),[outId,setOutId]=useState(""),[inId,setInId]=useState(""),[twoGoalTeam,setTwoGoalTeam]=useState<string|null>(null);
  const alarmed=useRef(""),offsetRef=useRef(0),nativeStarted=useRef(false);
  const reload=state.reload;
  useEffect(()=>{let cancelled=false;void (async()=>{const samples=[];for(let i=0;i<3;i++)samples.push(await serverClockOffset());const best=samples.sort((a,b)=>Math.abs(a)-Math.abs(b))[0]??0;if(cancelled)return;offsetRef.current=best;setOffset(best);await registerMatchDevice(peladaId,matchDeviceId(),best)})().catch(()=>setToast("Modo offline: o dispositivo será sincronizado quando a conexão voltar."));const heartbeat=setInterval(()=>void registerMatchDevice(peladaId,matchDeviceId(),offsetRef.current).catch(()=>undefined),20000);return()=>{cancelled=true;clearInterval(heartbeat)}},[peladaId]);
  useEffect(()=>{const timer=setInterval(()=>setTick(value=>value+1),250);return()=>clearInterval(timer)},[]);
  useEffect(()=>{const sync=async()=>{await flushMatchCommands();setPending((await pendingMatchCommands()).length);await reload()};void pendingMatchCommands().then(rows=>setPending(rows.length));addEventListener("online",sync);return()=>removeEventListener("online",sync)},[reload]);
  useEffect(()=>{const channel=supabase.channel(`controle-${peladaId}`).on("postgres_changes",{event:"*",schema:"public",table:"pelada_partidas",filter:`pelada_id=eq.${peladaId}`},()=>void reload()).on("postgres_changes",{event:"*",schema:"public",table:"pelada_eventos_partida",filter:`pelada_id=eq.${peladaId}`},()=>void reload()).subscribe();return()=>{void supabase.removeChannel(channel)}},[peladaId,reload]);
  const snapshot=state.data,match=snapshot?.match;
  const clock=useMemo(()=>{void tick;if(!match)return 600000;if(match.status!=="RUNNING"||!match.started_at)return match.status==="FINISHED"?0:match.duration_ms;return Math.max(0,match.duration_ms-((Date.now()+offset)-new Date(match.started_at).getTime()))},[match,tick,offset]);
  const nativeSecond=Math.floor(clock/1000);
  useEffect(()=>{if(match?.status==="RUNNING"&&clock===0&&alarmed.current!==match.id){alarmed.current=match.id;navigator.vibrate?.([300,150,500]);setToast("Tempo encerrado. Finalize a partida manualmente.");setTimeout(()=>setToast(""),5000)}},[clock,match]);
  const correctedNow=useCallback(()=>new Date(Date.now()+offset).toISOString(),[offset]);
  const run=useCallback(async(rpc:string,args:Record<string,unknown>,success:string,optimistic?:()=>void)=>{
    setBusy(true);
    try{const{error}=await supabase.rpc(rpc,args);if(error)throw error;setToast(success);await reload();return true}
    catch(error){if(!navigator.onLine||/fetch|network/i.test(error instanceof Error?error.message:String(error))){await enqueueMatchCommand({id:String(args.p_client_event_id||crypto.randomUUID()),rpc,args,createdAt:String(args.p_occurred_at||new Date().toISOString())});optimistic?.();setPending((await pendingMatchCommands()).length);setToast("Salvo neste aparelho. Será sincronizado automaticamente.");return true}else{setToast(error instanceof Error?error.message:"Não foi possível concluir.");return false}}
    finally{setBusy(false);setTimeout(()=>setToast(""),3500)}
  },[reload]);
  const addEvent=useCallback((type:"GOAL"|"HIGHLIGHT",team:number|null)=>{
    if(!match)return;const id=crypto.randomUUID(),occurred=correctedNow(),secondGoal=type==="GOAL"&&team!==null&&(team===match.team_home?match.score_home+1:match.score_away+1)===2;
    return run("registrar_evento_partida",{p_match_id:match.id,p_client_event_id:id,p_type:type,p_team_id:team,p_occurred_at:occurred,p_match_clock_ms:0,p_metadata:{}},type==="GOAL"?"Gol registrado.":"Lance importante marcado.",()=>{if(type==="GOAL"){if(team===match.team_home)match.score_home++;else match.score_away++}void reload()}).then(saved=>{if(saved&&secondGoal)setTwoGoalTeam(team===match.team_home?"A":"B")});
  },[match,run,reload,correctedNow]);
  useEffect(()=>{if(!match||!nativeMatchControls.available)return;const nativeState={title:"Time A × Time B",score:match.score_home+" × "+match.score_away,subtitle:"Partida "+match.sequence_number,remainingMs:nativeSecond*1000,running:match.status==="RUNNING"};const action=nativeStarted.current?nativeMatchControls.update(nativeState):nativeMatchControls.start(nativeState);nativeStarted.current=true;void action.catch(error=>setToast(error instanceof Error?error.message:"Não foi possível ativar os controles nativos."))},[match,nativeSecond]);
  useEffect(()=>()=>{if(nativeMatchControls.available)void nativeMatchControls.stop().catch(()=>undefined)},[]);
  useEffect(()=>{if(!match||!nativeMatchControls.available)return;let handle:{remove:()=>Promise<void>}|undefined;void nativeMatchControls.onAction(action=>{if(action==="GOAL_HOME")void addEvent("GOAL",match.team_home);if(action==="GOAL_AWAY")void addEvent("GOAL",match.team_away);if(action==="HIGHLIGHT")void addEvent("HIGHLIGHT",null);if(action==="UNDO")void run("desfazer_evento_partida",{p_match_id:match.id},"Último evento desfeito.")}).then(value=>handle=value);return()=>{void handle?.remove()}},[match,addEvent,run]);
  useEffect(()=>{if(!match||!("mediaSession" in navigator))return;const media=navigator.mediaSession;media.metadata=new MediaMetadata({title:`Time A ${match.score_home} x ${match.score_away} Time B`,artist:`Partida ${match.sequence_number} • ${formatClock(clock)}`,album:"Pelada dos Sub",artwork:[{src:"/icon-512.png",sizes:"512x512",type:"image/png"}]});media.playbackState=match.status==="RUNNING"?"playing":"paused";const handlers:[MediaSessionAction,()=>void][]=[["previoustrack",()=>void addEvent("GOAL",match.team_home)],["nexttrack",()=>void addEvent("GOAL",match.team_away)],["seekforward",()=>void addEvent("HIGHLIGHT",null)],["seekbackward",()=>void run("desfazer_evento_partida",{p_match_id:match.id},"Último evento desfeito.")]];handlers.forEach(([action,handler])=>{try{media.setActionHandler(action,handler)}catch{/* navegador sem essa ação */}});return()=>handlers.forEach(([action])=>{try{media.setActionHandler(action,null)}catch{/* sem suporte */}})},[match,clock,addEvent,run]);
  useEffect(()=>{if(match?.status!=="RUNNING"||!("wakeLock" in navigator))return;let lock:{release:()=>Promise<void>}|undefined;void (navigator as Navigator&{wakeLock:{request:(type:"screen")=>Promise<{release:()=>Promise<void>}>}}).wakeLock.request("screen").then(value=>lock=value).catch(()=>undefined);return()=>{void lock?.release()}},[match?.status]);
  if(state.loading)return <Spinner/>;
  if(state.error)return <ErrorState message={state.error} retry={state.reload}/>;
  if(!snapshot||!match)return <Empty title="Controle não inicializado"/>;
  const activeTeams=new Set([match.team_home,match.team_away]),outPlayers=snapshot.teams.filter(member=>activeTeams.has(member.time)),incoming=snapshot.participants.filter(item=>["confirmado","presente"].includes(item.status)&&item.jogador_id!==outId);
  const matchId=match.id;
  function finish(){void run("finalizar_partida_controlada",{p_match_id:matchId,p_client_event_id:crypto.randomUUID(),p_occurred_at:correctedNow(),p_match_clock_ms:0},"Partida finalizada. Pronta para recomeçar.").then(done=>{if(done)setTwoGoalTeam(null)})}
  function togglePause(){if(!match)return;const pause=match.status==="RUNNING";void run("pausar_partida_controlada",{p_match_id:matchId,p_pause:pause,p_occurred_at:correctedNow()},pause?"Partida pausada.":"Partida retomada.",()=>{match.status=pause?"PAUSED":"RUNNING";match.started_at=pause?null:correctedNow();setTick(value=>value+1)})}
  async function substitute(){if(!outId||!inId)return;await run("substituir_jogador_partida",{p_match_id:matchId,p_jogador_sai:outId,p_jogador_entra:inId,p_client_event_id:crypto.randomUUID(),p_occurred_at:correctedNow(),p_match_clock_ms:0},"Substituição registrada.");setOutId("");setInId("")}
  async function saveGoal(eventId:string,playerId:string,assistId:string|null){setBusy(true);try{await attributeMatchGoal(eventId,playerId,assistId);setToast("Gol atribuído ao jogador.");await reload()}catch(error){setToast(error instanceof Error?error.message:"Não foi possível atribuir o gol.")}finally{setBusy(false);setTimeout(()=>setToast(""),3500)}}
  return <section className="match-control">
    <header>{onBack&&<button type="button" className="link" onClick={onBack}>← VOLTAR</button>}<span className={snapshot.control.device_camera_online?"camera-online":"camera-offline"}>{snapshot.control.device_camera_online?"● CÂMERA GRAVANDO":"○ CÂMERA DESCONECTADA"}</span></header>
    <p className="eyebrow">FUTSAL • PARTIDA {match.sequence_number}</p>
    <div className={`match-clock ${clock===0?"expired":""}`}>{formatClock(clock)}</div>
    <div className="match-score"><span>TIME A</span><strong>{match.score_home} <i>×</i> {match.score_away}</strong><span>TIME B</span></div>
    {twoGoalTeam!==null&&match.status==="RUNNING"&&<section className="match-finish-confirm panel"><b>TIME {twoGoalTeam} FEZ 2 GOLS</b><p>O segundo gol foi marcado. Encerrar esta partida agora?</p><div><button className="secondary" disabled={busy} onClick={()=>void run("desfazer_evento_partida",{p_match_id:match.id},"Gol desfeito.").then(done=>{if(done)setTwoGoalTeam(null)})}>↶ DESFAZER GOL</button><button disabled={busy} onClick={()=>finish()}>ENCERRAR PARTIDA</button><button type="button" className="link" disabled={busy} onClick={()=>setTwoGoalTeam(null)}>CONTINUAR PARTIDA</button></div></section>}
    {match.status==="CREATED"?<button className="match-start" disabled={busy} onClick={()=>{const id=crypto.randomUUID(),occurred=correctedNow();void run("iniciar_partida_controlada",{p_match_id:match.id,p_client_event_id:id,p_occurred_at:occurred},"Partida iniciada.",()=>{match.status="RUNNING";match.started_at=occurred;setTick(value=>value+1)})}}>▶ INICIAR PARTIDA</button>:match.status==="PAUSED"?<button className="match-start" disabled={busy} onClick={togglePause}>▶ RETOMAR PARTIDA</button>:<><div className="match-actions">
      <button disabled={busy} onClick={()=>void addEvent("GOAL",match.team_home)}>⚽ GOL TIME A</button>
      <button disabled={busy} onClick={()=>void addEvent("GOAL",match.team_away)}>⚽ GOL TIME B</button>
    </div><div className="match-time-actions"><button className="secondary" disabled={busy} onClick={togglePause}>❚❚ PAUSAR TEMPO</button><button className="link" disabled={busy} onClick={()=>void run("desfazer_evento_partida",{p_match_id:match.id},"Último evento desfeito.")}>↶ DESFAZER ÚLTIMO</button></div></>}
    <details className="match-more panel"><summary>Mais opções</summary><details className="match-coin"><summary>CARA OU COROA</summary><CoinToss/></details><button className="secondary" disabled={busy||match.status!=="RUNNING"} onClick={()=>void addEvent("HIGHLIGHT",null)}>★ LANCE IMPORTANTE</button><button className="danger" disabled={busy||match.status!=="RUNNING"} onClick={()=>confirm("Finalizar esta partida? O próximo jogo será Time A × Time B.")&&finish()}>■ FINALIZAR PARTIDA</button><details className="match-substitution"><summary>Substituir jogadores</summary><p>Pode ser usado antes ou durante a partida.</p><div><label>Sai<select value={outId} onChange={event=>setOutId(event.target.value)}><option value="">Selecione</option>{outPlayers.map(member=><option value={member.jogador_id} key={member.jogador_id}>{member.time===match.team_home?"Time A":"Time B"} • {member.player?.apelido||member.player?.nome}</option>)}</select></label><label>Entra<select value={inId} onChange={event=>setInId(event.target.value)}><option value="">Selecione</option>{incoming.map(item=><option value={item.jogador_id} key={item.jogador_id}>{playerName(snapshot,item.jogador_id)}</option>)}</select></label><button disabled={!outId||!inId||busy} onClick={()=>void substitute()}>CONFIRMAR TROCA</button></div></details></details>
    {showEvents&&<MatchEvents snapshot={snapshot} onSaved={saveGoal}/>}
    <footer><span>{navigator.onLine?"● ONLINE":"○ OFFLINE"}{nativeMatchControls.available?" • CONTROLES NATIVOS ATIVOS":""}</span>{pending>0&&<b>{pending} pendente{pending===1?"":"s"}</b>}<small>Na tela bloqueada: anterior = gol esquerdo, próximo = gol direito, avançar = lance e voltar = desfazer.</small></footer>
    <Toast message={toast}/>
  </section>
}

export function DashboardMatchControls({peladaId}:{peladaId:string}) { return <MatchController peladaId={peladaId} showEvents={false}/> }

export function CoinTossPage() { return <section className="match-control"><header><Link className="link" to="/">← VOLTAR</Link></header><section className="match-finish-confirm panel"><b>CARA OU COROA</b><p>Faça o sorteio quando quiser.</p><CoinToss/></section></section> }

export function MatchControlPage({embedded=false}:{embedded?:boolean}) {
  const [searchParams]=useSearchParams();
  const {realProfile}=useAuth(),state=useLoad(controllablePeladas),[selected,setSelected]=useState(""),[active,setActive]=useState(""),[toast,setToast]=useState("");
  if(state.loading)return <Spinner/>;
  if(state.error)return <ErrorState message="Você não possui partidas disponíveis para controlar." retry={state.reload}/>;
  const games=state.data??[],requestedPelada=searchParams.get("pelada")??"",peladaId=selected||(games.some(game=>game.id===requestedPelada)?requestedPelada:"")||games[0]?.id||"";
  if(active)return <MatchController peladaId={active} onBack={()=>setActive("")}/>;
  return <section className={embedded?"match-control-hub embedded":"match-control-hub"}><p className="eyebrow">CONTROLE DA PARTIDA</p>{!embedded&&<h1>Partida e marcação</h1>}<p>Placar, cronômetro, rodízio e marcação de lances.</p>{games.length?<><label>Pelada<select value={peladaId} onChange={event=>setSelected(event.target.value)}>{games.map(game=><option value={game.id} key={game.id}>{new Date(`${game.data}T12:00`).toLocaleDateString("pt-BR")} • {game.local}</option>)}</select></label><button onClick={()=>void initializeMatchControl(peladaId).then(()=>setActive(peladaId)).catch(error=>{setToast(error instanceof Error?error.message:"Não foi possível iniciar o controle.");setTimeout(()=>setToast(""),3500)})}>ABRIR CONTROLE</button>{realProfile?.role==="superadmin"&&<button className="secondary" onClick={()=>{location.href="/controle-partida/"+peladaId+"/camera"}}>MODO CÂMERA</button>}<RecordingGallery peladaId={peladaId}/></>:<Empty title="Nenhuma pelada disponível"/>}<Toast message={toast}/></section>
}
