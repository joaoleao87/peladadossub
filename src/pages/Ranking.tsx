import { Empty, ErrorState, Spinner } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import { rankingStats } from "../lib/api";
import type { RankingStats } from "../lib/database.types";
import "./ranking.css";

export function Ranking() {
  const state = useLoad(rankingStats, []);
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const rows = state.data ?? [];
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
    </section>
  );
}
