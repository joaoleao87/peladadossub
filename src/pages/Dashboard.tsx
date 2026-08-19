import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ArrowRight, MapPin, Users } from "../components/Icons";
import { Badge, Empty, ErrorState, Spinner, Toast } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import {
  allPlayers,
  homeStats,
  leavePelada,
  myLinkRequest,
  myPlayer,
  nextPelada,
  pendingLinkRequests,
  participants,
  requestPlayerLink,
  respondPelada,
  reviewLinkRequest,
} from "../lib/api";
import "./dashboard.css";

function HomeTutorial({
  isAdmin,
  isSuperAdmin,
  linked,
}: {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  linked: boolean;
}) {
  return (
    <section className="home-tutorial" aria-labelledby="tutorial-title">
      <p className="eyebrow">GUIA RÁPIDO</p>
      <h2 id="tutorial-title">Como usar o app</h2>
      <p className={`tutorial-status ${linked ? "linked" : ""}`}>
        {linked
          ? "Sua conta está vinculada: você já pode participar das peladas."
          : isAdmin
            ? "Seu acesso administrativo está ativo, mas vincule um jogador à sua conta para entrar na lista e votar."
            : "Sua conta ainda não está vinculada: por enquanto você pode ver a lista, o sorteio e o ranking."}
      </p>
      <details className="tutorial-card" open={!isAdmin}>
        <summary>
          <span>Tutorial do jogador</span>
          <small>Lista, votação, ranking e pagamentos</small>
        </summary>
        <ol>
          <li>
            <b>Entre na lista.</b> Mensalistas confirmam quando a fase deles
            abrir. Diaristas entram quando o admin liberar a lista geral.
          </li>
          <li>
            <b>Acompanhe sua posição.</b> Veja confirmados, goleiros e
            suplentes. Se alguém sair, o primeiro suplente é promovido.
          </li>
          <li>
            <b>Veja os times.</b> O sorteio aparece na Lista depois que o admin
            liberar o resultado.
          </li>
          <li>
            <b>Vote depois do jogo.</b> Quem participou escolhe o destaque, a
            surpresa e quem quebrou mais na última pelada.
          </li>
          <li>
            <b>Consulte seus dados.</b> Ranking mostra resultados agrupados; no
            Perfil ficam estatísticas, cobranças e envio de comprovante.
          </li>
          <li>
            <b>Instale como aplicativo.</b> No Android, abra o menu do Chrome e
            toque em “Instalar app”. No iPhone, abra pelo Safari, toque em
            Compartilhar e depois em “Adicionar à Tela de Início”.
          </li>
        </ol>
        <nav className="tutorial-links" aria-label="Atalhos do jogador">
          <Link to="/lista">Abrir lista</Link>
          <Link to="/ranking">Ver ranking</Link>
          <Link to="/perfil">Perfil e pagamentos</Link>
        </nav>
      </details>
      {isAdmin && (
        <details className="tutorial-card admin-tutorial" open>
          <summary>
            <span>Tutorial do admin</span>
            <small>Pelada, jogadores, sorteio e financeiro</small>
          </summary>
          <ol>
            <li>
              <b>Prepare a pelada.</b> No Admin, configure a recorrência, gere a
              próxima ocorrência e revise data, horário e local.
            </li>
            <li>
              <b>Organize os jogadores.</b> Vincule contas, defina mensalista ou
              diarista, posição e isenção na aba Jogadores.
            </li>
            <li>
              <b>Controle a lista.</b> Na Lista, libere mensalistas ou diaristas,
              adicione nomes e mova jogadores entre confirmados e suplentes.
            </li>
            <li>
              <b>Monte os times.</b> Ajuste a nota de equilíbrio, gere o sorteio,
              revise os times e só então libere para os jogadores.
            </li>
            <li>
              <b>Feche o jogo.</b> Depois da pelada, registre os gols. No
              Financeiro, gere cobranças por mês ou por pelada e controle
              comprovantes e despesas.
            </li>
            {isSuperAdmin && (
              <li>
                <b>Gerencie acessos.</b> Em Usuários, altere os níveis de
                permissão e vincule logins aos jogadores.
              </li>
            )}
          </ol>
          <nav className="tutorial-links" aria-label="Atalhos do admin">
            <Link to="/admin">Abrir Admin</Link>
            <Link to="/lista">Controlar lista</Link>
            <Link to="/financeiro">Abrir financeiro</Link>
            {isSuperAdmin && <Link to="/superadmin">Gerenciar usuários</Link>}
          </nav>
        </details>
      )}
    </section>
  );
}

export function Dashboard() {
  const { profile, preview } = useAuth(),
    isAdmin = profile?.role === "admin" || profile?.role === "superadmin",
    state = useLoad(async () => {
      const [game, loadedPlayer, stats] = await Promise.all([nextPelada(), myPlayer(),homeStats(profile!.id)]),
        player=preview==='sem_vinculo'?null:loadedPlayer,
        [list, players, request, requests] = await Promise.all([
          game ? participants(game.id) : [],
          player ? Promise.resolve([]) : allPlayers(),
          player ? Promise.resolve(null) : myLinkRequest(),
          isAdmin ? pendingLinkRequests() : Promise.resolve([]),
        ]);
      return {
        game,
        list,
        player,
        players: players.filter((item) => !item.user_id),
        request,
        requests,
        stats,
      };
    }, [profile?.id, profile?.role, preview]),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [linkChoice, setLinkChoice] = useState("new");
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const game = state.data?.game,
    player = state.data?.player,
    tutorial = (
      <HomeTutorial
        isAdmin={isAdmin}
        isSuperAdmin={profile?.role === "superadmin"}
        linked={Boolean(player)}
      />
    );
  async function linkAction(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      setToast(message);
      await state.reload();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
      setTimeout(() => setToast(""), 3500);
    }
  }
  const linkPanel = !player && (
    <section className="panel link-request-panel">
      <h2>Vincular minha conta</h2>
      {state.data?.request ? (
        <p>Seu pedido está aguardando a análise de um administrador.</p>
      ) : (
        <>
          <p>Escolha seu nome na lista ou solicite a criação de um jogador.</p>
          <select value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}>
            <option value="new">Criar novo jogador (diarista • linha)</option>
            {state.data?.players.map((item) => (
              <option value={item.id} key={item.id}>{item.apelido || item.nome}</option>
            ))}
          </select>
          <button disabled={busy} onClick={() => void linkAction(
            () => requestPlayerLink(linkChoice === "new" ? null : linkChoice),
            "Solicitação enviada.",
          )}>SOLICITAR VÍNCULO</button>
        </>
      )}
    </section>
  );
  const adminRequests = isAdmin && Boolean(state.data?.requests.length) && (
    <section className="panel link-request-panel">
      <h2>Pedidos de vínculo</h2>
      {state.data!.requests.map((request) => (
        <div className="link-request-row" key={request.id}>
          <span>
            <b>{request.profile?.apelido || request.profile?.nome}</b>
            <small>{request.player ? `Vincular a ${request.player.apelido || request.player.nome}` : "Criar jogador diarista • linha"}</small>
          </span>
          <div>
            <button className="mini" disabled={busy} onClick={() => void linkAction(() => reviewLinkRequest(request.id, true), "Solicitação aprovada.")}>Aprovar</button>
            <button className="mini danger" disabled={busy} onClick={() => void linkAction(() => reviewLinkRequest(request.id, false), "Solicitação rejeitada.")}>Rejeitar</button>
          </div>
        </div>
      ))}
    </section>
  );
  if (!game)
    return (
      <section>
        <p className="eyebrow">
          BEM-VINDO, {profile?.apelido || profile?.nome}
        </p>
        <h1>Próxima pelada</h1>
        <div className="stats home-stats"><div><strong>{state.data?.stats.peladas??0}</strong><span>Peladas</span></div><div><strong>{state.data?.stats.gols??0}</strong><span>Gols</span></div><div><strong>{state.data?.stats.destaques??0}</strong><span>Destaques</span></div></div>
        {linkPanel}
        {adminRequests}
        <Empty title="Nenhuma pelada marcada">
          O admin precisa gerar a próxima ocorrência semanal.
        </Empty>
        {tutorial}
      </section>
    );
  const gameId = game.id,
    list = state.data?.list ?? [],
    confirmed = list.filter(
      (p) =>
        ["confirmado", "presente"].includes(p.status) &&
        p.categoria !== "goleiro",
    ),
    mine = list.find(
      (p) =>
        p.jogador_id === player?.id ||
        p.user_id === profile?.id ||
        p.player?.user_id === profile?.id,
    ),
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
  const action = !player ? (
    <div className="opening-card">
      <b>Conta aguardando vínculo</b>
      <span>Você pode acompanhar a lista enquanto um administrador vincula seu jogador.</span>
    </div>
  ) : mine?.status === "aguardando_resposta" ? (
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
      <div className="stats home-stats"><div><strong>{state.data?.stats.peladas??0}</strong><span>Peladas</span></div><div><strong>{state.data?.stats.gols??0}</strong><span>Gols</span></div><div><strong>{state.data?.stats.destaques??0}</strong><span>Destaques</span></div></div>
      {linkPanel}
      {adminRequests}
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
      <Link className="section-link vote-shortcut" to="/ranking#votacao">
        <span>Avaliar a última pelada</span>
        <ArrowRight />
      </Link>
      {tutorial}
      <Toast message={toast} />
    </section>
  );
}
