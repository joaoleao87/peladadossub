import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { TeamDraw } from "../components/TeamDraw";
import { Empty, ErrorState, Spinner, Toast } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import {
  adminAddPlayer,
  adminParticipantById,
  allPlayers,
  myPlayer,
  myMatchVotes,
  participants,
  peladasHistory,
  setParticipantGoals,
  setListPhase,
  respondPelada,
  voteMatchAward,
} from "../lib/api";
import type { Participant, VoteCategory } from "../lib/database.types";
import { formatWhatsAppList } from "../lib/whatsapp";
import "./list-page.css";

const statusLabel: Record<string, string> = {
  aguardando_resposta: "Aguardando resposta",
  confirmado: "Confirmado",
  presente: "Presente",
  espera: "Suplente",
  recusado: "Não vai",
};

export function ListPage() {
  const { profile } = useAuth(),
    isAdmin = profile?.role === "admin" || profile?.role === "superadmin",
    [selected, setSelected] = useState(""),
    [toast, setToast] = useState("");
  const state = useLoad(async () => {
    const [games, players, ownPlayer] = await Promise.all([
        peladasHistory(),
        isAdmin ? allPlayers() : Promise.resolve([]),
        myPlayer(),
      ]),
      entries = await Promise.all(
        games.map(
          async (game) => [game.id, await participants(game.id)] as const,
        ),
      );
    return {
      games,
      players,
      ownPlayer,
      lists: Object.fromEntries(entries) as Record<string, Participant[]>,
    };
  });
  const activeGameId = selected || state.data?.games[0]?.id || "",
    voting = useLoad(
      () =>
        activeGameId
          ? myMatchVotes(activeGameId)
          : Promise.resolve({
              votes: {} as Partial<Record<VoteCategory, string>>,
            }),
      activeGameId,
    );
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const games = state.data?.games ?? [],
    game = games.find((item) => item.id === activeGameId);
  if (!game)
    return (
      <section>
        <h1>Peladas</h1>
        <Empty title="Sem peladas registradas" />
      </section>
    );
  const gameId = game.id,
    phase = game.fase_lista,
    list = state.data?.lists[gameId] ?? [],
    current = list.filter((item) => item.status !== "cancelado"),
    confirmed = current.filter((item) =>
      ["confirmado", "presente"].includes(item.status),
    ),
    line = confirmed.filter((item) => item.categoria === "linha"),
    waiting = current.filter(
      (item) =>
        item.status === "espera" &&
        (isAdmin || item.player?.tipo !== "avulso" || item.player?.user_id === profile?.id),
    ),
    keepers = confirmed.filter((item) => item.categoria === "goleiro"),
    pending = current.filter((item) => item.status === "aguardando_resposta"),
    isMine = (item: Participant) =>
      item.jogador_id === state.data?.ownPlayer?.id ||
      item.user_id === profile?.id ||
      item.player?.user_id === profile?.id,
    mine = current.find(isMine),
    started =
      new Date(`${game.data}T${game.horario}`).getTime() <= Date.now(),
    canSeeList =
      isAdmin ||
      started ||
      phase === "geral" ||
      (phase === "mensalistas" && profile?.mensalista_ativo),
    canAnswer =
      Boolean(state.data?.ownPlayer) &&
      !started &&
      (phase === "geral" ||
        (phase === "mensalistas" && profile?.mensalista_ativo)),
    canVote =
      started &&
      confirmed.some(isMine),
    voteTargets = confirmed.filter((item) => !isMine(item)),
    myVotes = voting.data ?? { votes: {} };
  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      setToast(message);
      await state.reload();
    } catch (err) {
      setToast(
        err instanceof Error ? err.message : "Não foi possível concluir.",
      );
    } finally {
      setTimeout(() => setToast(""), 3500);
    }
  }
  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      id = String(new FormData(form).get("jogador_id"));
    if (!id) return;
    await run(
      () => adminAddPlayer(gameId, id),
      phase === "geral"
        ? "Jogador adicionado."
        : "Jogador adicionado à espera.",
    );
    form.reset();
  }
  async function vote(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      setToast(message);
      await voting.reload();
    } catch (err) {
      setToast(
        err instanceof Error ? err.message : "Não foi possível registrar.",
      );
    } finally {
      setTimeout(() => setToast(""), 3500);
    }
  }
  async function exportList() {
    const text = formatWhatsAppList(
      `Pelada ${new Date(`${game!.data}T12:00`).toLocaleDateString("pt-BR")} • ${game!.horario.slice(0, 5)} • ${game!.local}`,
      line.map(playerName),
      waiting.map(playerName),
      keepers.map(playerName),
    );
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setToast("Lista copiada. Cole no WhatsApp.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setToast("Não foi possível compartilhar a lista.");
    }
  }
  const gamePicker = (
    <>
      <p className="eyebrow">HISTÓRICO E PRÓXIMAS</p>
      <h1>Peladas</h1>
      <label className="game-picker">
        Escolha a pelada
        <select value={game.id} onChange={(event) => setSelected(event.target.value)}>
          {games.map((item) => (
            <option value={item.id} key={item.id}>
              {new Date(`${item.data}T12:00`).toLocaleDateString("pt-BR")} • {item.horario.slice(0, 5)} • {item.local}
            </option>
          ))}
        </select>
      </label>
    </>
  );
  if (!canSeeList)
    return (
      <section>
        {gamePicker}
        <div className="list-coming-soon">
          <span>EM BREVE</span>
          <h2>A lista ainda não foi liberada para você</h2>
          <p>Volte quando a próxima fase da lista estiver aberta.</p>
        </div>
      </section>
    );
  const playerName = (item: Participant) =>
    item.player?.profile?.apelido?.trim() ||
    item.player?.profile?.nome ||
    item.player?.apelido ||
    item.player?.nome ||
    item.profile?.apelido ||
    item.profile?.nome ||
    "?";
  const group = (title: string, items: Participant[]) => (
    <section className="list-group">
      <header className="list-heading">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </header>
      {items.length ? (
        items.map((item, index) => {
          const name = playerName(item);
          return (
            <div
              className={`player ${
                isAdmin ? "interactive-player" : ""
              } ${
                 isMine(item) ? "me" : ""
              }`}
              key={item.id}
            >
              <b>{index + 1}</b>
              <div className="avatar">
                {item.player?.profile?.foto_url || item.profile?.foto_url ? (
                  <img src={item.player?.profile?.foto_url || item.profile?.foto_url || ""} alt="" />
                ) : (
                  name[0]
                )}
              </div>
              <span className="player-name">
                {name}
                {isAdmin && item.player?.nome && item.player.nome !== name && (
                  <small className="player-record-name">Jogador: {item.player.nome}</small>
                )}
                {isAdmin && (item.player?.user_id || item.user_id) && (
                  <small className="player-linked-account">CONTA VINCULADA</small>
                )}
                {isMine(item) && <small className="player-me">VOCÊ</small>}
              </span>
              {isAdmin && (
                <nav
                  className="list-player-actions"
                  aria-label={`Ações para ${name}`}
                >
                  {isAdmin &&
                    started &&
                    ["confirmado", "presente"].includes(item.status) && (
                      <span className="goal-control">
                        <small>Gols</small>
                        <button
                          type="button"
                          className="mini secondary"
                          disabled={(item.gols ?? 0) === 0}
                          onClick={() =>
                            void run(
                              () =>
                                setParticipantGoals(
                                  item.id,
                                  Math.max(0, (item.gols ?? 0) - 1),
                                ),
                              "Gol removido.",
                            )
                          }
                        >
                          −
                        </button>
                        <b>{item.gols ?? 0}</b>
                        <button
                          type="button"
                          className="mini"
                          onClick={() =>
                            void run(
                              () =>
                                setParticipantGoals(
                                  item.id,
                                  (item.gols ?? 0) + 1,
                                ),
                              "Gol registrado.",
                            )
                          }
                        >
                          +
                        </button>
                      </span>
                    )}
                  {isAdmin && !started && (
                    <>
                      {item.status === "aguardando_resposta" && (
                        <button
                          type="button"
                          className="mini"
                          onClick={() =>
                            void run(
                              () => adminParticipantById(item.id, "promote"),
                              "Jogador confirmado.",
                            )
                          }
                        >
                          Confirmar
                        </button>
                      )}
                      {item.status === "espera" && item.player?.tipo === "avulso" && phase !== "geral" ? (
                        <button type="button" className="mini" disabled>Aguarda avulsos</button>
                      ) : item.status === "espera" && (
                        <button
                          type="button"
                          className="mini"
                          onClick={() =>
                            void run(
                              () => adminParticipantById(item.id, "promote"),
                              "Suplente promovido.",
                            )
                          }
                        >
                          Promover
                        </button>
                      )}
                      {["confirmado", "presente"].includes(item.status) && item.categoria === "linha" && (
                        <button
                          type="button"
                          className="mini secondary"
                          onClick={() =>
                            void run(
                              () => adminParticipantById(item.id, "demote"),
                              "Jogador movido para suplentes.",
                            )
                          }
                        >
                          Suplente
                        </button>
                      )}
                      <button
                        type="button"
                        className="mini danger"
                        onClick={() => confirm(`Remover ${name} desta pelada?`) && void run(() => adminParticipantById(item.id, "remove"), "Jogador removido.")}
                      >
                        Remover
                      </button>
                    </>
                  )}
                </nav>
              )}
            </div>
          );
        })
      ) : (
        <Empty title="Ninguém por aqui" />
      )}
    </section>
  );
  return (
    <section>
      {gamePicker}
      {isAdmin && !["encerrada", "cancelada"].includes(game.status) && (
        <section className="list-admin-panel">
          <header>
            <b>Controle da lista</b>
            <small>
              {game.fase_lista === "geral"
                ? "Avulsos liberados"
                : game.fase_lista === "mensalistas"
                  ? "Somente mensalistas"
                  : "Lista fechada"}
            </small>
          </header>
          <div className="phase-buttons">
            <button
              className={game.fase_lista === "fechada" ? "active" : ""}
              onClick={() =>
                void run(
                  () => setListPhase(game.id, "fechada"),
                  "Lista fechada.",
                )
              }
            >
              Fechar
            </button>
            <button
              className={game.fase_lista === "mensalistas" ? "active" : ""}
              onClick={() =>
                void run(
                  () => setListPhase(game.id, "mensalistas"),
                  "Lista liberada para mensalistas.",
                )
              }
            >
              Mensalistas
            </button>
            <button
              className={game.fase_lista === "geral" ? "active" : ""}
              onClick={() =>
                void run(
                  () => setListPhase(game.id, "geral"),
                  "Lista liberada para avulsos.",
                )
              }
            >
              Avulsos
            </button>
          </div>
          <form className="queue-player" onSubmit={addPlayer}>
            <select name="jogador_id" defaultValue="" required>
              <option value="" disabled>
                Adicionar jogador…
              </option>
              {(state.data?.players ?? []).map((player) => {
                const entry = current.find((item) => item.jogador_id === player.id);
                return (
                  <option key={player.id} value={player.id} disabled={Boolean(entry)}>
                    {player.apelido || player.nome} • {player.tipo === "mensalista" ? "Mensalista" : "Avulso"}{entry ? ` • ${statusLabel[entry.status] || entry.status}` : ""}
                  </option>
                );
              })}
            </select>
            <button>Adicionar</button>
          </form>
          <button type="button" className="secondary export-list" onClick={() => void exportList()}>
            Compartilhar lista no WhatsApp
          </button>
          {game.fase_lista !== "geral" && (
            <small>Avulsos adicionados agora ficam em espera.</small>
          )}
        </section>
      )}
      <p className="eyebrow">
        {new Date(`${game.data}T12:00`).toLocaleDateString("pt-BR")} •{" "}
        {game.horario.slice(0, 5)}
      </p>
      {canAnswer &&
        (!mine || ["aguardando_resposta", "recusado"].includes(mine.status)) && (
          <section className="list-response">
            <span>
              <b>Você vai jogar?</b>
              <small>Confirme sua participação nesta pelada.</small>
            </span>
            <div>
              <button
                type="button"
                onClick={() =>
                  void run(
                    () => respondPelada(gameId, true),
                    "Participação registrada.",
                  )
                }
              >
                {mine ? "Vou" : "Entrar na lista"}
              </button>
              {mine?.status === "aguardando_resposta" && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    void run(
                      () => respondPelada(gameId, false),
                      "Resposta registrada.",
                    )
                  }
                >
                  Não vou
                </button>
              )}
            </div>
          </section>
        )}
      {isAdmin && (
        <div className="list-summary">
          <div><b>{line.length}</b><span>Confirmados</span></div>
          <div><b>{waiting.length}</b><span>Suplentes</span></div>
          <div><b>{keepers.length}</b><span>Goleiros</span></div>
          <div><b>{pending.length}</b><span>Aguardando</span></div>
        </div>
      )}
      {started && canVote && (
        <p className="voting-notice voting-ready">
          <b>Como votar:</b> escolha destaque, surpresa e destaque negativo no
          final da lista.
        </p>
      )}
      {group("Confirmados", line)}
      {group("Suplentes", waiting)}
      {group("Goleiros", keepers)}
      {isAdmin && pending.length > 0 && group("Aguardando resposta", pending)}
      {started && voting.error && (
        <p className="voting-notice">{voting.error}</p>
      )}
      {started && canVote && (
        <section className="match-voting-panel">
          <p className="eyebrow">VOTAÇÃO DA PELADA</p>
          <h2>Escolha os destaques</h2>
          <small>Você pode alterar seus votos quando quiser.</small>
          <div>
            {(
              [
                ["destaque", "Destaque"],
                ["surpresa", "Surpresa"],
                ["negativo", "Destaque negativo"],
              ] as [VoteCategory, string][]
            ).map(([category, label]) => (
              <label key={category}>
                {label}
                <select
                  value={myVotes.votes[category] ?? ""}
                  disabled={voting.loading}
                  onChange={(event) =>
                    void vote(
                      () =>
                        voteMatchAward(
                          game.id,
                          category,
                          event.target.value || null,
                        ),
                      "Voto registrado.",
                    )
                  }
                >
                  <option value="">Não selecionado</option>
                  {voteTargets.map((item) => (
                    <option value={item.jogador_id} key={item.jogador_id}>
                      {playerName(item)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}
      {started && !canVote && (
        <p className="voting-notice">
          {isAdmin
            ? "Para votar: em Admin > Jogadores, vincule sua conta ao jogador correto. Esse jogador também precisa estar entre os confirmados desta pelada. Depois volte aqui para dar as notas e escolher os destaques."
            : "A votação é liberada somente para contas vinculadas aos jogadores que participaram desta pelada."}
        </p>
      )}
      <TeamDraw
        game={game}
        participants={list}
        isAdmin={Boolean(isAdmin)}
        onChanged={state.reload}
      />
      <Toast message={toast} />
    </section>
  );
}
