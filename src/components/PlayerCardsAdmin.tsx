import { useState, type FormEvent } from "react";
import { allPlayerCards, savePlayerCard } from "../lib/api";
import { useLoad } from "../hooks/useLoad";
import type { PlayerCardData, PlayerCardPosition, PlayerCardType, PlayerWithCard } from "../lib/database.types";
import { calculatePlayerCardOverall, cardStats, CARD_POSITIONS, PLAYER_CARD_STATUS_LABEL, playerCardStatus } from "../lib/playerCard";
import { Badge, Empty, ErrorState, Spinner, Toast } from "./Ui";
import { PlayerCard } from "./PlayerCard";
import "./player-cards-admin.css";

type Filter = "all" | PlayerCardType | ReturnType<typeof playerCardStatus>;
const emptyCard = (player: PlayerWithCard): PlayerCardData => ({ player_id: player.id, display_name: player.apelido || player.nome, position: null, overall: null, pace: null, shooting: null, passing: null, dribbling: null, defending: null, physical: null, card_type: "normal", photo_url: null, photo_scale: 1, photo_position_x: 0, photo_position_y: 0, resolved_photo_url: player.profile?.foto_url || null });

export function PlayerCardsAdmin() {
  const [query, setQuery] = useState(""), [filter, setFilter] = useState<Filter>("all"), [selectedId, setSelectedId] = useState(""), [draft, setDraft] = useState<PlayerCardData | null>(null), [busy, setBusy] = useState(false), [toast, setToast] = useState("");
  const state = useLoad(allPlayerCards);
  const players = state.data ?? [];
  const filtered = players.filter(player => {
    const cardStatus = playerCardStatus(player.card), name = (player.apelido || player.nome).toLocaleLowerCase("pt-BR");
    return name.includes(query.trim().toLocaleLowerCase("pt-BR")) && (filter === "all" || filter === player.card?.card_type || filter === cardStatus);
  }).sort((a,b)=>(a.apelido||a.nome).localeCompare(b.apelido||b.nome,"pt-BR",{sensitivity:"base"}));
  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorState message="Não foi possível carregar as cartinhas." retry={state.reload} />;
  const selected = players.find(player => player.id === selectedId);
  function edit(player: PlayerWithCard) { setSelectedId(player.id); setDraft({ ...(player.card || emptyCard(player)), resolved_photo_url: player.card?.resolved_photo_url || player.profile?.foto_url || null }); }
  function number(value: FormDataEntryValue | null) { return value === null || value === "" ? null : Number(value); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft) return; const form = new FormData(event.currentTarget);
    const card: PlayerCardData = { ...draft, display_name: String(form.get("display_name") || "") || null, position: String(form.get("position") || "") as PlayerCardPosition || null, pace: number(form.get("pace")), shooting: number(form.get("shooting")), passing: number(form.get("passing")), dribbling: number(form.get("dribbling")), defending: number(form.get("defending")), physical: number(form.get("physical")) };
    card.overall = calculatePlayerCardOverall(card);
    setBusy(true);
    try { await savePlayerCard(card); setToast("Configurações salvas com sucesso."); setSelectedId(""); setDraft(null); await state.reload(); }
    catch (reason) { setToast(reason instanceof Error && !reason.message.toLowerCase().includes("function") ? reason.message : "Não foi possível salvar a cartinha."); }
    finally { setBusy(false); setTimeout(() => setToast(""), 3500); }
  }
  if (selected && draft) return <section className="player-card-editor">
    <button type="button" className="link card-editor-back" onClick={() => { setSelectedId(""); setDraft(null); }}>← VOLTAR ÀS CARTINHAS</button>
    <p className="eyebrow">CARTINHAS DOS JOGADORES</p><h2>Editar cartinha</h2>
    <div className="card-editor-layout"><PlayerCard player={draft} cardType={draft.card_type} mode="admin" />
      <form className="card-editor-form" onSubmit={submit} onChange={event => {
        const form = new FormData(event.currentTarget), key = (event.target as HTMLInputElement).name;
        if (!key) return; const value = form.get(key);
        setDraft(old => {
          if (!old) return old; const next = { ...old, [key]: ["pace","shooting","passing","dribbling","defending","physical"].includes(key) ? number(value) : value } as PlayerCardData;
          return { ...next, overall: calculatePlayerCardOverall(next) };
        });
      }}>
        <label className="wide">Nome exibido<input name="display_name" maxLength={24} defaultValue={draft.display_name || ""} /></label>
        <label>Posição<select name="position" defaultValue={draft.position || ""}><option value="">Selecione</option>{CARD_POSITIONS.map(position => <option value={position} key={position}>{position === "PIVO" ? "PIVÔ" : position}</option>)}</select></label>
        <label>Overall calculado<output className="card-overall-output">{calculatePlayerCardOverall(draft) ?? "—"}</output></label>
        {cardStats(draft.position).map(([key,label]) => <label key={key}>{label}<input name={key} type="number" min="1" max="99" step="1" defaultValue={draft[key] ?? ""} /></label>)}
        <fieldset className="wide card-type-field"><legend>Tipo de carta</legend><div>{(["normal","legendary"] as PlayerCardType[]).map(type => <label className={draft.card_type === type ? "active" : ""} key={type}><input type="radio" name="card_type" value={type} checked={draft.card_type === type} onChange={() => setDraft(old => old ? { ...old, card_type: type } : old)} />{type === "normal" ? "NORMAL" : "LENDÁRIA"}</label>)}</div></fieldset>
        <button className="wide" disabled={busy}>{busy ? "SALVANDO…" : "SALVAR CONFIGURAÇÕES"}</button>
      </form>
    </div><Toast message={toast} />
  </section>;
  return <section className="player-cards-admin"><p className="eyebrow">CARTINHAS DOS JOGADORES</p><h2>Cartinhas dos jogadores</h2><p>Configure posição, tipo de carta e atributos. O overall é calculado automaticamente.</p>
    <div className="card-admin-filters"><input type="search" placeholder="Buscar jogador…" value={query} onChange={event => setQuery(event.target.value)} /><select value={filter} onChange={event => setFilter(event.target.value as Filter)}><option value="all">Todas</option><option value="normal">Normais</option><option value="legendary">Lendárias</option><option value="not_configured">Não configuradas</option><option value="incomplete">Incompletas</option><option value="ready">Prontas</option></select></div>
    <div className="card-admin-list">{filtered.length ? filtered.map(player => { const status = playerCardStatus(player.card); return <article key={player.id}><span className="card-admin-avatar">{player.card?.resolved_photo_url || player.profile?.foto_url ? <img src={player.card?.resolved_photo_url || player.profile?.foto_url || ""} alt="" /> : (player.apelido || player.nome)[0]}</span><span><b>{player.apelido || player.nome}</b><small>{player.card?.overall ? `${player.card.overall} • ${player.card.position || "SEM POSIÇÃO"}` : "Sem overall"} • {player.card?.card_type === "legendary" ? "LENDÁRIA" : "NORMAL"}</small></span><Badge tone={status === "ready" ? "green" : status === "incomplete" ? "yellow" : "gray"}>{PLAYER_CARD_STATUS_LABEL[status]}</Badge><button type="button" className="mini secondary" onClick={() => edit(player)}>EDITAR</button></article>; }) : <Empty title="Nenhum jogador encontrado" />}</div>
    <Toast message={toast} />
  </section>;
}
