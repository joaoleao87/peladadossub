import { useState } from "react";
import {
  addTeamPlayer,
  drawTeams,
  generateTeamDraw,
  publishTeamDraw,
  removeTeamPlayer,
} from "../lib/api";
import type { Participant, Pelada } from "../lib/database.types";
import { Shield } from "./Icons";
import { Empty, ErrorState, Spinner, Toast } from "./Ui";
import { useLoad } from "../hooks/useLoad";
import "./team-draw.css";

interface Props {
  game: Pelada;
  participants: Participant[];
  isAdmin: boolean;
  onChanged: () => Promise<void>;
}

export function TeamDraw({ game, participants, isAdmin, onChanged }: Props) {
  const state = useLoad(() => drawTeams(game.id), game.id),
    [toast, setToast] = useState("");
  if (!isAdmin && !game.sorteio_liberado) return null;
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const members = state.data ?? [],
    eligible = participants.filter(
      (item) =>
        item.categoria === "linha" &&
        ["confirmado", "presente"].includes(item.status),
    ),
    candidates = participants.filter(
      (item) =>
        item.categoria === "linha" &&
        (["confirmado", "presente"].includes(item.status) ||
          (item.status === "espera" && item.comparecimento)),
    ),
    unassigned = candidates.filter(
      (item) => !members.some((member) => member.jogador_id === item.jogador_id),
    ),
    teamCount = Math.max(
      Math.ceil(eligible.length / 4),
      ...members.map((member) => member.time),
    );
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
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Não foi possível concluir.",
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
                (!members.length ||
                  confirm(
                    "Sortear novamente? A formação atual será substituída e voltará para rascunho.",
                  )) &&
                void run(
                  () => generateTeamDraw(game.id),
                  members.length
                    ? "Novo sorteio gerado. Revise antes de liberar."
                    : "Times sorteados. Revise antes de liberar.",
                  true,
                )
              }
            >
              {members.length ? "Sortear novamente" : "Gerar sorteio"}
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
      {eligible.length ? (
        <>
          <div className="teams-grid">
            {Array.from({ length: teamCount }, (_, index) => index + 1).map(
              (team) => (
                <section className="team-card" key={team}>
                  <div className="team-card-title">
                    <i>
                      <Shield />
                    </i>
                    <h3>Time {team}</h3>
                    <small>
                      {members.filter((member) => member.time === team).length}/4
                    </small>
                  </div>
                  <ol>
                    {members
                      .filter((member) => member.time === team)
                      .map((member) => (
                        <li key={member.jogador_id}>
                          <div className="team-player">
                            <span>
                              <b>
                                {member.player?.apelido || member.player?.nome}
                              </b>
                              {isAdmin && (
                                <small>
                                  Nota {member.player?.nota_equilibrio ?? 3}
                                </small>
                              )}
                            </span>
                            {isAdmin && (
                              <button
                                type="button"
                                className="mini danger"
                                onClick={() =>
                                  void run(
                                    () =>
                                      removeTeamPlayer(
                                        game.id,
                                        member.jogador_id,
                                      ),
                                    "Jogador removido do time.",
                                    true,
                                  )
                                }
                              >
                                Remover
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                  </ol>
                </section>
              ),
            )}
          </div>
          {isAdmin && unassigned.length > 0 && (
            <section className="team-bench">
              <h3>Fora dos times</h3>
              <p>Adicione cada jogador ao time desejado.</p>
              {unassigned.map((item) => (
                <div className="team-bench-player" key={item.jogador_id}>
                  <span>
                    <b>{item.player?.apelido || item.player?.nome}</b>
                    <small>{item.status === "espera" ? "Suplente presente" : `Nota ${item.player?.nota_equilibrio ?? 3}`}</small>
                  </span>
                  <div>
                    {Array.from(
                      { length: teamCount },
                      (_, index) => index + 1,
                    ).map((team) => (
                      <button
                        type="button"
                        className="mini secondary"
                        disabled={
                          members.filter((member) => member.time === team)
                            .length >= 4
                        }
                        onClick={() =>
                          void run(
                            () =>
                              addTeamPlayer(game.id, item.jogador_id, team),
                            `Jogador adicionado ao Time ${team}.`,
                            true,
                          )
                        }
                        key={team}
                      >
                        Time {team}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
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
