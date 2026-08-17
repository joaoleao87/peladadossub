import { useState } from "react";
import {
  drawTeams,
  generateTeamDraw,
  publishTeamDraw,
  swapTeamPlayers,
} from "../lib/api";
import type { Pelada } from "../lib/database.types";
import { Empty, ErrorState, Spinner, Toast } from "./Ui";
import { useLoad } from "../hooks/useLoad";
import "./team-draw.css";

interface Props {
  game: Pelada;
  isAdmin: boolean;
  onChanged: () => Promise<void>;
}

export function TeamDraw({ game, isAdmin, onChanged }: Props) {
  const state = useLoad(() => drawTeams(game.id), game.id),
    [toast, setToast] = useState(""),
    [first, setFirst] = useState(""),
    [second, setSecond] = useState("");
  if (!isAdmin && !game.sorteio_liberado) return null;
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const members = state.data ?? [],
    teamCount = members.reduce((max, item) => Math.max(max, item.time), 0);
  async function run(
    action: () => Promise<unknown>,
    message: string,
    reloadParent = false,
  ) {
    try {
      await action();
      if (reloadParent) await onChanged();
      await state.reload();
      setToast(message);
    } catch (err) {
      setToast(
        err instanceof Error ? err.message : "Não foi possível concluir.",
      );
    } finally {
      setTimeout(() => setToast(""), 3500);
    }
  }
  return (
    <section className="draw-panel">
      <header>
        <span>
          <small>SORTEIO</small>
          <h2>Times</h2>
        </span>
        {isAdmin && <em>{game.sorteio_liberado ? "Liberado" : "Rascunho"}</em>}
      </header>
      {isAdmin && (
        <div className="draw-actions">
            <button
              type="button"
              onClick={() =>
                void run(
                  () => generateTeamDraw(game.id),
                  "Times sorteados. Revise antes de liberar.",
                  true,
                )
              }
            >
              Gerar sorteio
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!members.length}
              onClick={() =>
                void run(
                  () => publishTeamDraw(game.id, !game.sorteio_liberado),
                  game.sorteio_liberado
                    ? "Sorteio ocultado."
                    : "Sorteio liberado.",
                  true,
                )
              }
            >
              {game.sorteio_liberado
                ? "Ocultar dos jogadores"
                : "Liberar para jogadores"}
            </button>
        </div>
      )}
      {members.length ? (
        <>
          <div className="teams-grid">
            {Array.from({ length: teamCount }, (_, index) => index + 1).map(
              (team) => (
                <section className="team-card" key={team}>
                  <h3>Time {team}</h3>
                  <ol>
                    {members
                      .filter((member) => member.time === team)
                      .map((member) => (
                        <li key={member.jogador_id}>
                          {member.player?.apelido || member.player?.nome}
                          {isAdmin && (
                            <small>
                              Nota {member.player?.nota_equilibrio ?? 3}
                            </small>
                          )}
                        </li>
                      ))}
                  </ol>
                </section>
              ),
            )}
          </div>
          {isAdmin && members.length > 1 && (
            <form
              className="swap-players"
              onSubmit={(event) => {
                event.preventDefault();
                if (first && second && first !== second)
                  void run(
                    () => swapTeamPlayers(game.id, first, second),
                    "Jogadores trocados.",
                  );
              }}
            >
              <b>Editar sorteio</b>
              <select
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                required
              >
                <option value="">Primeiro jogador…</option>
                {members.map((member) => (
                  <option value={member.jogador_id} key={member.jogador_id}>
                    {member.player?.apelido || member.player?.nome}
                  </option>
                ))}
              </select>
              <select
                value={second}
                onChange={(e) => setSecond(e.target.value)}
                required
              >
                <option value="">Trocar com…</option>
                {members
                  .filter((member) => member.jogador_id !== first)
                  .map((member) => (
                    <option value={member.jogador_id} key={member.jogador_id}>
                      {member.player?.apelido || member.player?.nome}
                    </option>
                  ))}
              </select>
              <button>Trocar</button>
            </form>
          )}
        </>
      ) : isAdmin ? (
        <Empty title="Sorteio ainda não gerado">
          Confirme os jogadores de linha e gere os times.
        </Empty>
      ) : null}
      <Toast message={toast} />
    </section>
  );
}
