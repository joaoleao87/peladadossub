import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ArrowRight, MapPin, Users } from "../components/Icons";
import { Badge, Empty, ErrorState, Spinner, Toast } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import {
  leavePelada,
  nextPelada,
  participants,
  respondPelada,
} from "../lib/api";

export function Dashboard() {
  const { profile } = useAuth(),
    state = useLoad(async () => {
      const game = await nextPelada();
      return { game, list: game ? await participants(game.id) : [] };
    }),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false);
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const game = state.data?.game;
  if (!game)
    return (
      <section>
        <p className="eyebrow">
          BEM-VINDO, {profile?.apelido || profile?.nome}
        </p>
        <h1>Próxima pelada</h1>
        <Empty title="Nenhuma pelada marcada">
          O admin precisa gerar a próxima ocorrência semanal.
        </Empty>
      </section>
    );
  const gameId = game.id,
    list = state.data?.list ?? [],
    confirmed = list.filter(
      (p) =>
        ["confirmado", "presente"].includes(p.status) &&
        p.categoria !== "goleiro",
    ),
    mine = list.find((p) => p.user_id === profile?.id),
    waiting = list.filter((p) => p.status === "espera"),
    spots = Math.max(0, 20 - confirmed.length),
    position =
      mine?.status === "espera"
        ? waiting.findIndex((p) => p.id === mine.id) + 1
        : 0,
    canAnswer =
      game.fase_lista === "geral" ||
      (game.fase_lista === "mensalistas" && profile?.mensalista_ativo),
    start = new Date(`${game.data}T${game.horario}`),
    generalOpen = new Date(start.getTime() - 48 * 3600000),
    format = (date: Date) =>
      date.toLocaleString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  async function answer(vai: boolean) {
    setBusy(true);
    try {
      const result = await respondPelada(gameId, vai);
      setToast(
        !vai
          ? "Resposta registrada: você não vai."
          : result === "espera"
            ? "Você entrou nos suplentes."
            : "Você está confirmado!",
      );
      await state.reload();
    } catch (err) {
      setToast(
        err instanceof Error ? err.message : "Não foi possível responder.",
      );
    } finally {
      setBusy(false);
      setTimeout(() => setToast(""), 3500);
    }
  }
  async function leave() {
    setBusy(true);
    try {
      await leavePelada(gameId);
      setToast("Você saiu da lista.");
      await state.reload();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Não foi possível sair.");
    } finally {
      setBusy(false);
    }
  }
  const action =
    mine?.status === "aguardando_resposta" ? (
      <div className="answer-actions">
        <b>VOCÊ VAI JOGAR?</b>
        <button disabled={busy} onClick={() => answer(true)}>
          VOU
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => answer(false)}
        >
          NÃO VOU
        </button>
      </div>
    ) : mine && ["confirmado", "espera"].includes(mine.status) ? (
      <div className="my-status">
        <b>
          {mine.status === "espera"
            ? `Você é o ${position}º suplente`
            : mine.categoria === "goleiro"
              ? "✓ GOLEIRO CONFIRMADO"
              : "✓ VOCÊ ESTÁ CONFIRMADO"}
        </b>
        <button className="secondary" onClick={leave} disabled={busy}>
          SAIR DA LISTA
        </button>
      </div>
    ) : canAnswer ? (
      <div className="answer-actions">
        <button disabled={busy} onClick={() => answer(true)}>
          COLOCAR MEU NOME
        </button>
        {profile?.mensalista_ativo && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => answer(false)}
          >
            NÃO VOU
          </button>
        )}
      </div>
    ) : (
      <div className="opening-card">
        <b>A lista abre automaticamente</b>
        <span>Quarta-feira: {format(generalOpen)}</span>
        <span>Saída permitida até 3 horas antes</span>
        {(profile?.role === "admin" || profile?.role === "superadmin") && (
          <Link to="/admin">Abrir agora pelo Admin →</Link>
        )}
      </div>
    );
  return (
    <section>
      <p className="eyebrow">BEM-VINDO, {profile?.apelido || profile?.nome}</p>
      <h1>Próxima pelada</h1>
      <article className="game-card">
        <div className="game-card-top">
          <Badge>
            {game.fase_lista === "fechada"
              ? "ABRE EM BREVE"
              : game.fase_lista.toUpperCase()}
          </Badge>
          <span>
            {new Date(`${game.data}T12:00`)
              .toLocaleDateString("pt-BR", { weekday: "short" })
              .toUpperCase()}
          </span>
        </div>
        <div className="date">
          <strong>{new Date(`${game.data}T12:00`).getDate()}</strong>
          <div>
            {new Date(`${game.data}T12:00`)
              .toLocaleDateString("pt-BR", { month: "short" })
              .toUpperCase()}
            <small>{game.horario.slice(0, 5)}</small>
          </div>
        </div>
        <p>
          <MapPin /> {game.local}
        </p>
        <div className="progress">
          <span
            style={{
              width: `${Math.min(100, (confirmed.length / 20) * 100)}%`,
            }}
          />
        </div>
        <div className="capacity">
          <span>
            <Users /> <b>{confirmed.length}/20</b> jogadores
          </span>
          <b>{spots ? `${spots} vagas` : "Lotada"}</b>
        </div>
        {action}
      </article>
      <Link className="section-link" to="/lista">
        <span>Ver lista completa</span>
        <ArrowRight />
      </Link>
      <Toast message={toast} />
    </section>
  );
}
