import { useEffect, useState } from "react";
import {
  deleteMatchCardImage, drawTeams, generateMatchCard, matchAwards, matchCardImageUrl,
  matchCards, participants, peladasHistory, updateMatchCard, uploadMatchCardImage,
} from "../lib/api";
import { useLoad } from "../hooks/useLoad";
import type { CardCategory, MatchCard, Participant, Pelada } from "../lib/database.types";
import { ErrorState, Spinner, Toast } from "./Ui";
import "./match-cards.css";

const categories: [CardCategory, string][] = [
  ["destaque", "Destaque"], ["surpresa", "Surpresa"],
  ["negativo", "Quem quebrou mais"], ["artilheiro", "Artilheiro"], ["time_destaque", "Time Destaque"],
];

export function MatchAwardCard({ card, game }: { card: MatchCard; game?: Pelada }) {
  return <article className={`match-card match-card-${card.categoria}`}>
    {card.categoria === "time_destaque" ? <div className="match-card-team-photos">{card.snapshot_membros.map(member => member.foto_url ? <img src={member.foto_url} alt={member.nome} key={member.nome} /> : <span key={member.nome}>{member.nome[0]}</span>)}</div> : card.snapshot_foto_url ? <img src={card.snapshot_foto_url} alt="" /> : <div className="match-card-avatar">{card.snapshot_nome[0]}</div>}
    <small>PELADA DOS SUB</small><h2>{card.titulo}</h2><strong>{card.snapshot_nome}</strong>
    <span>{card.snapshot_time || "Companheiros não informados"}{card.categoria !== "time_destaque" && <> • {card.snapshot_gols} {card.snapshot_gols === 1 ? "gol" : "gols"}</>}</span>
    {game && <time>{new Date(`${game.data}T12:00`).toLocaleDateString("pt-BR")} • {game.local}</time>}
  </article>;
}

export function MatchCardsManager() {
  const [gameId, setGameId] = useState(""),
    [choices, setChoices] = useState<Partial<Record<CardCategory, string>>>({}),
    [toast, setToast] = useState("");
  const state = useLoad(async () => {
    const games = await peladasHistory(), id = gameId || games[0]?.id || "";
    if (!id) return { games, list: [], awards: [], cards: [], teams: [] };
    const [list, awards, cards, teams] = await Promise.all([participants(id), matchAwards(id), matchCards(id), drawTeams(id)]);
    return { games, list, awards, cards, teams };
  }, gameId);
  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorState message={state.error} retry={state.reload} />;
  const { games, list, awards, cards, teams = [] } = state.data!, id = gameId || games[0]?.id || "", game = games.find(item => item.id === id),
    name = (item: Participant) => item.player?.profile?.apelido || item.player?.apelido || item.player?.nome || "?",
    participantsInGame = list.filter(item => item.status !== "cancelado" && item.status !== "faltou").sort((a, b) => name(a).localeCompare(name(b), "pt-BR"));
  async function run(action: () => Promise<unknown>, message: string) {
    try { await action(); setToast(message); await state.reload(); }
    catch (error) { setToast(error && typeof error === "object" && "message" in error ? String(error.message) : "Não foi possível concluir."); }
    finally { setTimeout(() => setToast(""), 3500); }
  }
  return <section className="cards-manager"><header><span><p className="eyebrow">CARDS DA PELADA</p><h2>Gerar e publicar</h2></span>
    <select value={id} onChange={event => setGameId(event.target.value)}>{games.map(item => <option value={item.id} key={item.id}>{new Date(`${item.data}T12:00`).toLocaleDateString("pt-BR")} • {item.local}</option>)}</select>
  </header>{categories.map(([category, title]) => {
    const voteResults = awards.filter(item => item.categoria === category).sort((a, b) => b.votos - a.votos), teamWins = Math.max(0, ...teams.map(item => item.vitorias ?? 0)),
      featuredTeams = [...new Set(teams.filter(item => (item.vitorias ?? 0) === teamWins && teamWins > 0).map(item => item.time))],
      teamChoices = featuredTeams.map(team => { const members = teams.filter(item => item.time === team); return { jogador_id: members[0]?.jogador_id ?? "", nome: members.map(item => item.player?.profile?.apelido || item.player?.apelido || item.player?.nome || "?").join(" • ") }; }),
      top = category === "artilheiro" ? Math.max(0, ...participantsInGame.map(item => item.gols ?? 0)) : category === "time_destaque" ? teamWins : voteResults[0]?.votos ?? 0,
      winners = category === "time_destaque" ? teamChoices : category === "artilheiro"
        ? participantsInGame.filter(item => (item.gols ?? 0) === top && top > 0).map(item => ({ jogador_id: item.jogador_id, nome: name(item) }))
        : voteResults.filter(item => item.votos === top && top > 0).map(item => ({ jogador_id: item.jogador_id, nome: item.apelido || item.nome })),
      choice = choices[category] || winners[0]?.jogador_id || "", card = cards.find(item => item.categoria === category),
      unit = category === "artilheiro" ? (top === 1 ? "gol" : "gols") : category === "time_destaque" ? (top === 1 ? "vitória" : "vitórias") : (top === 1 ? "voto" : "votos");
    return <article className="card-manager-row" key={category}><div><h3>{title}</h3>
      {!winners.length ? <small>{category === "artilheiro" ? "Sem gols registrados nesta pelada." : category === "time_destaque" ? "Registre as vitórias dos times primeiro." : "Sem votos. Escolha um participante."}</small>
        : winners.length > 1 ? <small>Empate com {top} {unit}. Escolha o vencedor.</small>
          : <small>{winners[0].nome} • {top} {unit}</small>}
      <select value={choice} onChange={event => setChoices(old => ({ ...old, [category]: event.target.value }))}><option value="">Escolha…</option>
        {((category === "artilheiro" || category === "time_destaque") && winners.length ? winners : category === "time_destaque" ? [] : participantsInGame.map(item => ({ jogador_id: item.jogador_id, nome: name(item) }))).map(item => <option value={item.jogador_id} key={item.jogador_id}>{item.nome}</option>)}
      </select><button disabled={!choice} onClick={() => void run(async () => { await generateMatchCard(id, category, choice); if (card?.imagem_path) await deleteMatchCardImage(card.imagem_path); }, "Card gerado como rascunho.")}>Gerar rascunho</button></div>
      {card && <div className="card-manager-preview">{card.imagem_path ? <img src={matchCardImageUrl(card.imagem_path)} alt={card.titulo} /> : <MatchAwardCard card={card} game={game} />}
        <nav><label className="upload-card">Substituir imagem<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void run(async () => { const old = card.imagem_path, path = await uploadMatchCardImage(card, file); await updateMatchCard(card, false, path); if (old) await deleteMatchCardImage(old); }, "Imagem substituída em rascunho."); }} /></label>
          {card.imagem_path && <button className="secondary" onClick={() => void run(async () => { await updateMatchCard(card, false, null); await deleteMatchCardImage(card.imagem_path!); }, "Card gerado restaurado.")}>Usar card gerado</button>}
          <button onClick={() => void run(() => updateMatchCard(card, !card.liberado), card.liberado ? "Card ocultado." : "Card liberado.")}>{card.liberado ? "Ocultar" : "Liberar"}</button></nav>
        <b className={card.liberado ? "published" : "draft"}>{card.liberado ? "LIBERADO" : "RASCUNHO"}</b></div>}
    </article>;
  })}<Toast message={toast} /></section>;
}

export function MatchCardsGallery({ game }: { game?: Pelada }) {
  const [open, setOpen] = useState<MatchCard | null>(null), state = useLoad(() => game ? matchCards(game.id) : Promise.resolve([]), game?.id);
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); }; addEventListener("keydown", close); history.pushState({ card: true }, ""); const pop = () => setOpen(null); addEventListener("popstate", pop, { once: true }); return () => removeEventListener("keydown", close); }, [open]);
  if (state.loading) return null; const cards = (state.data ?? []).filter(card => card.liberado); if (!cards.length) return null;
  return <section className="cards-gallery"><p className="eyebrow">CARDS DA PELADA</p><h2>Veja os vencedores</h2><div>{cards.map(card => <button key={card.id} onClick={() => setOpen(card)}>{card.titulo}<small>Visualizar card</small></button>)}</div>
    {open && <aside className="card-viewer" role="dialog" aria-modal="true"><button className="card-viewer-close" aria-label="Fechar" onClick={() => { history.back(); setOpen(null); }}>×</button>{open.imagem_path ? <img src={matchCardImageUrl(open.imagem_path)} alt={open.titulo} /> : <MatchAwardCard card={open} game={game} />}<footer><button onClick={() => { history.back(); setOpen(null); }}>VOLTAR</button></footer></aside>}
  </section>;
}

export function LatestMatchCardsGallery() {
  const state = useLoad(async () => { const [games, cards] = await Promise.all([peladasHistory(), matchCards()]); return games.find(game => cards.some(card => card.pelada_id === game.id)); });
  if (state.loading || state.error || !state.data) return null; return <MatchCardsGallery game={state.data} />;
}
