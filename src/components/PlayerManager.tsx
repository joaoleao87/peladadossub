import { useState, type FormEvent } from "react";
import {
  allPlayers,
  allProfiles,
  deletePlayer,
  mergePlayers,
  rankingStats,
  ratePlayer,
  savePlayer,
  setMonthlyExemption,
} from "../lib/api";
import { useLoad } from "../hooks/useLoad";
import type { ListPosition, Player, PlayerType } from "../lib/database.types";
import { ErrorState, Spinner, Toast } from "./Ui";
import "./player-manager.css";

export function PlayerManager() {
  const state = useLoad(async () => {
      const [players, profiles, ranking] = await Promise.all([
        allPlayers(),
        allProfiles(),
        rankingStats(),
      ]);
      return { players, profiles, ranking };
    }),
    [toast, setToast] = useState(""),
    [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const { players, profiles, ranking } = state.data!;
  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      setToast(message);
      await state.reload();
      return true;
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Não foi possível salvar.");
      return false;
    } finally {
      setTimeout(() => setToast(""), 3500);
    }
  }
  const update = (
    player: Player,
    changes: Partial<Pick<Player, "tipo" | "posicao" | "user_id">>,
    message: string,
  ) =>
    run(
      () =>
        savePlayer({
          id: player.id,
          nome: player.nome,
          tipo: changes.tipo ?? player.tipo,
          posicao: changes.posicao ?? player.posicao,
          user_id:
            changes.user_id === undefined ? player.user_id : changes.user_id,
        }),
      message,
    );
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    const saved = await run(
      () =>
        savePlayer({
          nome: String(f.get("nome")),
          tipo: String(f.get("tipo")) as PlayerType,
          posicao: String(f.get("posicao")) as ListPosition,
          user_id: String(f.get("user_id")) || null,
        }),
      "Jogador cadastrado.",
    );
    if (saved) form.reset();
  }
  return (
    <section className="players-panel">
      <header>
        <small>ENTENDA OS CAMPOS</small>
        <p>
          <b>Conta de acesso</b> liga o jogador ao login dele.{" "}
          <b>Tipo de cobrança</b> define mensalista ou avulso. <b>Posição</b>{" "}
          define linha ou goleiro. <b>Equilíbrio</b> é a nota do admin para o
          sorteio; <b>desempenho</b> é a média dos votos após as peladas.
        </p>
      </header>
      <details className="player-create">
        <summary>Cadastrar novo jogador</summary>
        <form onSubmit={create}>
          <label>
            Nome
            <input name="nome" minLength={2} required />
          </label>
          <fieldset className="player-choice">
            <legend>Tipo de cobrança</legend>
            <div>
              <label>
                <input type="radio" name="tipo" value="avulso" defaultChecked />
                Avulso
              </label>
              <label>
                <input type="radio" name="tipo" value="mensalista" />
                Mensalista
              </label>
            </div>
          </fieldset>
          <fieldset className="player-choice">
            <legend>Posição</legend>
            <div>
              <label>
                <input
                  type="radio"
                  name="posicao"
                  value="linha"
                  defaultChecked
                />
                Linha
              </label>
              <label>
                <input type="radio" name="posicao" value="goleiro" />
                Goleiro
              </label>
            </div>
          </fieldset>
          <label>
            Conta de acesso (opcional)
            <select name="user_id">
              <option value="">Sem conta</option>
              {profiles
                .filter(
                  (profile) =>
                    !players.some((player) => player.user_id === profile.id),
                )
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.apelido || profile.nome}
                  </option>
                ))}
            </select>
          </label>
          <button>Cadastrar</button>
        </form>
      </details>
      <ul className="players-list">
        {players.map((player) => {
          const performance = ranking.find(
            (item) => item.jogador_id === player.id,
          );
          return (
            <li className="player-card" key={player.id}>
              <details>
              <summary>
                <span>
                  <b>{player.apelido || player.nome}</b>
                  <small>
                    {player.user_id ? "Conta vinculada" : "Sem conta"}
                  </small>
                </span>
                <span className="player-tags">
                  <em>{player.tipo}</em>
                  <em>{player.posicao}</em>
                  <em>equilíbrio {player.nota_equilibrio ?? 3}</em>
                  {performance?.media_nota !== null &&
                    performance?.media_nota !== undefined && (
                      <em>
                        desempenho{" "}
                        {performance.media_nota.toLocaleString("pt-BR")}
                      </em>
                    )}
                  {player.isento_mensalidade && <em>isento</em>}
                </span>
              </summary>
              <section className="player-fields player-card-fields">
                <label className="player-account">
                  Conta de acesso
                  <select
                    value={player.user_id || ""}
                    onChange={(e) =>
                      void update(
                        player,
                        { user_id: e.target.value || null },
                        e.target.value
                          ? "Conta vinculada."
                          : "Conta desvinculada.",
                      )
                    }
                  >
                    <option value="">Sem conta vinculada</option>
                    {profiles
                      .filter(
                        (profile) =>
                          profile.id === player.user_id ||
                          !players.some((item) => item.user_id === profile.id),
                      )
                      .map((profile) => (
                        <option value={profile.id} key={profile.id}>
                          {profile.apelido || profile.nome}
                        </option>
                      ))}
                  </select>
                  <small>
                    Login usado para confirmar presença e consultar pagamentos.
                  </small>
                </label>
                <fieldset className="player-choice">
                  <legend>Tipo de cobrança</legend>
                  <div>
                    {(["mensalista", "avulso"] as PlayerType[]).map((tipo) => (
                      <label
                        className={player.tipo === tipo ? "selected" : ""}
                        key={tipo}
                      >
                        <input
                          type="radio"
                          name={`tipo-${player.id}`}
                          value={tipo}
                          checked={player.tipo === tipo}
                          onChange={() =>
                            void update(
                              player,
                              { tipo },
                              "Tipo de cobrança atualizado.",
                            )
                          }
                        />
                        {tipo === "mensalista" ? "Mensalista" : "Avulso"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="player-choice">
                  <legend>Posição</legend>
                  <div>
                    {(["linha", "goleiro"] as ListPosition[]).map((posicao) => (
                      <label
                        className={player.posicao === posicao ? "selected" : ""}
                        key={posicao}
                      >
                        <input
                          type="radio"
                          name={`posicao-${player.id}`}
                          value={posicao}
                          checked={player.posicao === posicao}
                          onChange={() =>
                            void update(
                              player,
                              { posicao },
                              "Posição atualizada.",
                            )
                          }
                        />
                        {posicao === "linha" ? "Linha" : "Goleiro"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="player-balance-rating">
                  <legend>Nota de equilíbrio</legend>
                  <small>Usada somente para montar times equilibrados.</small>
                  <div>
                    {[1, 2, 3, 4, 5].map((note) => (
                      <button
                        type="button"
                        className={
                          (player.nota_equilibrio ?? 3) === note ? "active" : ""
                        }
                        aria-pressed={(player.nota_equilibrio ?? 3) === note}
                        onClick={() =>
                          void run(
                            () => ratePlayer(player.id, note),
                            "Nota de equilíbrio atualizada.",
                          )
                        }
                        key={note}
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="player-performance-summary">
                  <span>
                    <b>Média de desempenho</b>
                    <small>Nota dada pelos participantes depois do jogo.</small>
                  </span>
                  <strong>
                    {performance?.media_nota?.toLocaleString("pt-BR") ?? "—"}
                  </strong>
                </div>
                {player.tipo === "mensalista" && (
                  <div className="player-exemption">
                    <span>
                      <b>Isenção mensal</b>
                      <small>Isentos não recebem cobranças mensais.</small>
                    </span>
                    <label className="player-switch">
                      <input
                        type="checkbox"
                        checked={player.isento_mensalidade}
                        onChange={() =>
                          run(
                            () =>
                              setMonthlyExemption(
                                player.id,
                                !player.isento_mensalidade,
                              ),
                            player.isento_mensalidade
                              ? "Isenção removida."
                              : "Mensalista isento.",
                          )
                        }
                      />
                      <i aria-hidden="true" />
                      <b>{player.isento_mensalidade ? "Isento" : "Cobrar"}</b>
                    </label>
                  </div>
                )}
                <footer>
                  <select
                    aria-label={`Conciliar ${player.nome} com outro jogador`}
                    value={mergeTargets[player.id] || ""}
                    onChange={(e) =>
                      setMergeTargets((old) => ({ ...old, [player.id]: e.target.value }))
                    }
                  >
                    <option value="">Conciliar com…</option>
                    {players.filter((item) => item.id !== player.id).map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.apelido || item.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!mergeTargets[player.id]}
                    onClick={() => {
                      const target = players.find((item) => item.id === mergeTargets[player.id]);
                      if (target && confirm(`Juntar ${player.nome} em ${target.apelido || target.nome}? Todo o histórico ficará em ${target.apelido || target.nome}.`))
                        void run(() => mergePlayers(player.id, target.id), "Jogadores conciliados.");
                    }}
                  >
                    Conciliar
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      confirm(
                        `Excluir ${player.nome}? O histórico será mantido.`,
                      ) &&
                      run(() => deletePlayer(player.id), "Jogador excluído.")
                    }
                  >
                    Excluir jogador
                  </button>
                </footer>
              </section>
              </details>
            </li>
          );
        })}
      </ul>
      <Toast message={toast} />
    </section>
  );
}
