import { useState } from "react";
import { Empty, ErrorState, Spinner, Toast } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import { matchAwards, myMatchVotes, myPlayer, participants, peladasHistory, rankingStats, voteMatchAward } from "../lib/api";
import type { MatchAwardResult, RankingStats, VoteCategory } from "../lib/database.types";
import "./ranking.css";
import { MatchCardsGallery } from "../components/MatchCards";

export function Ranking() {
  const [toast, setToast] = useState("");
  const state = useLoad(async () => {
    const [rows, games, player] = await Promise.all([rankingStats(), peladasHistory(), myPlayer()]);
    const game = games.find((item) => new Date(`${item.data}T${item.horario}`).getTime() <= Date.now());
    const [list, votes, awards] = game
      ? await Promise.all([participants(game.id), myMatchVotes(game.id), matchAwards(game.id)])
      : [[], { votes: {} }, []];
    return { rows, game, player, list, votes, awards };
  }, []);
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const { rows, game, player, list, votes, awards } = state.data!;
  const confirmed = list.filter((item) => ["confirmado", "presente"].includes(item.status));
  const canVote = Boolean(player && confirmed.some((item) => item.jogador_id === player.id));
  const targets = confirmed.filter((item) => item.jogador_id !== player?.id);
  const playerName = (item: (typeof confirmed)[number]) => item.player?.apelido || item.player?.nome || "?";
  async function vote(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      setToast(message);
      await state.reload();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Não foi possível votar.");
    } finally {
      setTimeout(() => setToast(""), 3500);
    }
  }
  const board = (
    title: string,
    metric: (row: RankingStats) => number,
    value: (row: RankingStats) => string,
    detail: (row: RankingStats) => string,
  ) => {
    const ranked = rows
      .filter((row) => metric(row) > 0)
      .sort((a, b) => metric(b) - metric(a));
    return (
      <section className="ranking-card">
        <h2>{title}</h2>
        {ranked.length ? (
          ranked.map((row, index) => (
            <div className="rank performance-rank" key={row.jogador_id}>
              <b>{index + 1}</b>
              <span>
                {row.apelido || row.nome}
                <small>{detail(row)}</small>
              </span>
              <strong>{value(row)}</strong>
            </div>
          ))
        ) : (
          <Empty title="Ainda sem resultados" />
        )}
      </section>
    );
  };
  const awardBoard = (title: string, category: VoteCategory) => {
    const ranked = awards
      .filter((row: MatchAwardResult) => row.categoria === category)
      .sort((a: MatchAwardResult, b: MatchAwardResult) => b.votos - a.votos);
    return (
      <section className="ranking-card">
        <h2>{title}</h2>
        {ranked.length ? ranked.map((row: MatchAwardResult, index: number) => (
          <div className="rank performance-rank" key={row.jogador_id}>
            <b>{index + 1}</b>
            <span>{row.apelido || row.nome}<small>Última pelada</small></span>
            <strong>{row.votos} {row.votos === 1 ? "voto" : "votos"}</strong>
          </div>
        )) : <Empty title="Ainda sem resultado" />}
      </section>
    );
  };
  return (
    <section>
      <p className="eyebrow">DESEMPENHO DAS PELADAS</p>
      <h1>Ranking</h1>
      <MatchCardsGallery game={game} />
      <section className="ranking-vote" id="votacao">
        <p className="eyebrow">ÚLTIMA PELADA</p>
        <h2>Vote por categoria</h2>
        {game && <small>{new Date(`${game.data}T12:00`).toLocaleDateString("pt-BR")} • {game.local}</small>}
        {!game ? <Empty title="Nenhuma pelada realizada" /> : !canVote ? (
          <p className="voting-notice">Sua conta precisa estar vinculada ao jogador que participou desta pelada.</p>
        ) : (
          <>
            <div className="ranking-awards">
              {([['destaque','Destaque'],['surpresa','Surpresa'],['negativo','Quem quebrou mais']] as [VoteCategory,string][]).map(([category,label]) => (
                <label key={category}>{label}<select value={votes.votes[category] ?? ""} onChange={(event) => void vote(() => voteMatchAward(game.id, category, event.target.value || null), "Destaque registrado.")}><option value="">Escolha um jogador</option>{targets.map((item) => <option value={item.jogador_id} key={item.jogador_id}>{playerName(item)}</option>)}</select></label>
              ))}
            </div>
          </>
        )}
      </section>
      <div className="ranking-grid">
        {board(
          "Artilheiro",
          (row) => row.gols,
          (row) => `${row.gols} ${row.gols === 1 ? "gol" : "gols"}`,
          (row) => `${row.jogos} ${row.jogos === 1 ? "pelada" : "peladas"}`,
        )}
        {awardBoard("Destaque", "destaque")}
        {awardBoard("Surpresa", "surpresa")}
        {awardBoard("Quem quebrou mais", "negativo")}
      </div>
      <Toast message={toast} />
    </section>
  );
}
