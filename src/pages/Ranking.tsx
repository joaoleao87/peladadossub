import { useState } from "react";
import { Empty, ErrorState, Spinner, Toast } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import { myMatchVotes, myPlayer, participants, peladasHistory, rankingStats, rateMatchPerformance, voteMatchAward } from "../lib/api";
import type { RankingStats, VoteCategory } from "../lib/database.types";
import "./ranking.css";

export function Ranking() {
  const [toast, setToast] = useState("");
  const state = useLoad(async () => {
    const [rows, games, player] = await Promise.all([rankingStats(), peladasHistory(), myPlayer()]);
    const game = games.find((item) => new Date(`${item.data}T${item.horario}`).getTime() <= Date.now());
    const list = game ? await participants(game.id) : [];
    const votes = game ? await myMatchVotes(game.id) : { ratings: {}, votes: {} };
    return { rows, game, player, list, votes };
  }, []);
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const { rows, game, player, list, votes } = state.data!;
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
  return (
    <section>
      <p className="eyebrow">DESEMPENHO DAS PELADAS</p>
      <h1>Ranking</h1>
      <section className="ranking-vote" id="votacao">
        <p className="eyebrow">ÚLTIMA PELADA</p>
        <h2>Avalie os jogadores</h2>
        {game && <small>{new Date(`${game.data}T12:00`).toLocaleDateString("pt-BR")} • {game.local}</small>}
        {!game ? <Empty title="Nenhuma pelada realizada" /> : !canVote ? (
          <p className="voting-notice">Sua conta precisa estar vinculada ao jogador que participou desta pelada.</p>
        ) : (
          <>
            <div className="ranking-rating-list">
              {targets.map((item) => (
                <div key={item.jogador_id}>
                  <b>{playerName(item)}</b>
                  <span aria-label={`Nota para ${playerName(item)}`}>
                    {[1, 2, 3, 4, 5].map((note) => (
                      <button type="button" className={votes.ratings[item.jogador_id] === note ? "active" : "secondary"} onClick={() => void vote(() => rateMatchPerformance(game.id, item.jogador_id, note), "Nota registrada.")} key={note}>{note}</button>
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <div className="ranking-awards">
              {([['destaque','Destaque'],['surpresa','Surpresa'],['negativo','Destaque negativo']] as [VoteCategory,string][]).map(([category,label]) => (
                <label key={category}>{label}<select value={votes.votes[category] ?? ""} onChange={(event) => void vote(() => voteMatchAward(game.id, category, event.target.value || null), "Destaque registrado.")}><option value="">Escolha um jogador</option>{targets.map((item) => <option value={item.jogador_id} key={item.jogador_id}>{playerName(item)}</option>)}</select></label>
              ))}
            </div>
          </>
        )}
      </section>
      <div className="ranking-grid">
        {board(
          "Melhores notas",
          (row) => row.media_nota ?? 0,
          (row) => (row.media_nota ?? 0).toLocaleString("pt-BR"),
          (row) => `${row.total_avaliacoes} avaliações`,
        )}
        {board(
          "Artilharia",
          (row) => row.gols,
          (row) => `${row.gols} gols`,
          (row) => `${row.jogos} peladas`,
        )}
        {board(
          "Destaques",
          (row) => row.votos_destaque,
          (row) => `${row.votos_destaque} votos`,
          (row) => `${row.jogos} peladas`,
        )}
        {board(
          "Surpresas",
          (row) => row.votos_surpresa,
          (row) => `${row.votos_surpresa} votos`,
          (row) => `${row.jogos} peladas`,
        )}
        {board(
          "Destaques negativos",
          (row) => row.votos_negativo,
          (row) => `${row.votos_negativo} votos`,
          (row) => `${row.jogos} peladas`,
        )}
      </div>
      <Toast message={toast} />
    </section>
  );
}
