import { useState, type FormEvent } from "react";
import { useAuth, type PreviewMode } from "../auth/AuthContext";
import { Badge, Empty, ErrorState, Spinner, Toast } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import {
  allManagedPlayers,
  allProfiles,
  createPlayerForUser,
  createUser,
  deleteUser,
  invalidateSuperadminVote,
  manageUser,
  participants,
  peladasHistory,
  resetUserPassword,
  setUserSuspended,
  superadminVotes,
  updateSuperadminVote,
} from "../lib/api";
import type {
  ListPosition,
  Participant,
  PlayerType,
  Profile,
  Role,
  VoteCategory,
} from "../lib/database.types";
import "./super-admin.css";
import { MatchCardsManager } from "../components/MatchCards";

const roles: { value: Role; label: string }[] = [
  { value: "user", label: "Usuário" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Superadmin" },
];
type UserFilter = "todos" | "sem_vinculo" | Role | PlayerType;
type SuperAdminTab = "usuarios" | "votos" | "cards";
const filters: { value: UserFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "sem_vinculo", label: "Sem vínculo" },
  { value: "user", label: "Usuários" },
  { value: "admin", label: "Admins" },
  { value: "superadmin", label: "Superadmins" },
  { value: "mensalista", label: "Mensalistas" },
  { value: "avulso", label: "Diaristas" },
];

export function SuperAdmin() {
  const { preview, setPreview, realProfile } = useAuth(),
    state = useLoad(async () => {
      const [profiles, players] = await Promise.all([
        allProfiles(),
        allManagedPlayers(),
      ]);
      return { profiles, players };
    }),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState<UserFilter>("todos"),
    [search, setSearch] = useState(""),
    [tab, setTab] = useState<SuperAdminTab>("usuarios");
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const { profiles, players } = state.data!;
  const feedback = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };
  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      feedback(message);
      await state.reload();
    } catch (err) {
      feedback(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget,
      values = new FormData(form);
    try {
      await createUser({
        nome: String(values.get("nome")),
        email: String(values.get("email")),
        password: String(values.get("password")),
        role: String(values.get("role")) as Role,
        tipo_jogador: String(values.get("tipo")) as PlayerType,
        posicao_lista: String(values.get("posicao")) as ListPosition,
      });
      feedback("Usuário criado.");
      form.reset();
      await state.reload();
    } catch (err) {
      feedback(err instanceof Error ? err.message : "Falha ao criar usuário.");
    } finally {
      setBusy(false);
    }
  }
  async function removeUser(profile: Profile) {
    const name = profile.apelido || profile.nome;
    if (!confirm(`Excluir permanentemente a conta sem vínculo de ${name}?`)) return;
    setBusy(true);
    try { await deleteUser(profile.id); feedback("Usuário excluído."); await state.reload(); }
    catch (err) { feedback(err instanceof Error ? err.message : "Não foi possível excluir o usuário."); }
    finally { setBusy(false); }
  }
  async function toggleSuspension(profile: Profile) {
    const suspended = !profile.ativo, name = profile.apelido || profile.nome;
    if (!confirm(`${suspended ? "Suspender" : "Reativar"} o acesso de ${name}?`)) return;
    setBusy(true);
    try { await setUserSuspended(profile.id, suspended); feedback(suspended ? "Acesso suspenso." : "Acesso reativado."); await state.reload(); }
    catch (err) { feedback(err instanceof Error ? err.message : "Não foi possível alterar o acesso."); }
    finally { setBusy(false); }
  }
  async function changePassword(userId: string) {
    const password = prompt("Nova senha (mínimo 8 caracteres):");
    if (!password) return;
    await run(() => resetUserPassword(userId, password), "Senha alterada.");
  }
  const linkedPlayer = (profile: Profile) =>
    players.find((player) => player.user_id === profile.id);
  const query = search.trim().toLocaleLowerCase(),
    filteredProfiles = profiles.filter((profile) => {
      const player = linkedPlayer(profile),
        matchesFilter = filter === "todos" ||
          (filter === "sem_vinculo" ? !player : ["user", "admin", "superadmin"].includes(filter) ? profile.role === filter : player?.tipo === filter),
        matchesSearch = !query || [profile.nome, profile.apelido, player?.nome, player?.apelido].some((value) => value?.toLocaleLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });

  return (
    <section>
      <p className="eyebrow">CONTROLE DE ACESSO</p>
      <h1>Superadmin</h1>
      <section className="preview-settings">
        <span><b>Visualização do aplicativo</b><small>Confira a experiência de cada tipo de usuário.</small></span>
        <select value={preview ?? ""} onChange={(event) => setPreview((event.target.value || null) as PreviewMode)}>
          <option value="">Superadmin</option>
          <option value="mensalista">Mensalista</option>
          <option value="diarista">Diarista</option>
          <option value="sem_vinculo">Conta sem vínculo</option>
        </select>
      </section>
      <nav className="superadmin-tabs" aria-label="Seções do Superadmin">
        <button type="button" className={tab === "usuarios" ? "active" : ""} onClick={() => setTab("usuarios")}>Usuários</button>
        <button type="button" className={tab === "votos" ? "active" : ""} onClick={() => setTab("votos")}>Votos</button>
        <button type="button" className={tab === "cards" ? "active" : ""} onClick={() => setTab("cards")}>Cards</button>
      </nav>
      {tab === "usuarios" && <><form className="panel form-grid" onSubmit={submit}>
        <h2>Criar usuário</h2>
        <label>
          Nome
          <input name="nome" minLength={2} required />
        </label>
        <label>
          E-mail de acesso
          <input name="email" type="email" required />
        </label>
        <label>
          Senha inicial
          <input name="password" type="password" minLength={8} required />
        </label>
        <label>
          Permissão
          <select name="role">
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cobrança
          <select name="tipo">
            <option value="avulso">Diarista</option>
            <option value="mensalista">Mensalista</option>
          </select>
        </label>
        <label>
          Posição
          <select name="posicao">
            <option value="linha">Linha</option>
            <option value="goleiro">Goleiro</option>
          </select>
        </label>
        <button className="wide" disabled={busy}>
          {busy ? "CRIANDO…" : "CRIAR USUÁRIO"}
        </button>
      </form>
      <section className="users-panel">
        <h2>Usuários</h2>
        <input className="user-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar usuário ou jogador…" aria-label="Buscar usuário ou jogador" />
        <nav className="user-filters" aria-label="Filtros de usuários">
          {filters.map((item) => <button type="button" className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)} key={item.value}>{item.label}</button>)}
        </nav>
        <small className="filter-result">{filteredProfiles.length} de {profiles.length} contas</small>
        {filteredProfiles.length ? (
          filteredProfiles.map((profile) => {
            const player = linkedPlayer(profile);
            return (
              <details className="user-card" key={profile.id}>
                <summary>
                  <div className="user-avatar" aria-hidden="true">{profile.foto_url?<img src={profile.foto_url} alt=""/>:(profile.apelido||profile.nome).charAt(0).toUpperCase()}</div>
                  <span>
                    <b>{profile.apelido || profile.nome}</b>
                    <small>
                      {player
                        ? `Vinculado a ${player.apelido || player.nome}`
                        : "Sem jogador vinculado"}
                    </small>
                  </span>
                  <Badge
                    tone={
                      profile.role === "superadmin"
                        ? "yellow"
                        : profile.role === "admin"
                          ? "green"
                          : "gray"
                    }
                  >
                    {profile.role.toUpperCase()}
                  </Badge>
                </summary>
                <div className="user-editor">
                  <fieldset>
                    <legend>Nível de permissão</legend>
                    <div className="role-options">
                      {roles.map((role) => (
                        <label
                          className={
                            profile.role === role.value ? "active" : ""
                          }
                          key={role.value}
                        >
                          <input
                            type="radio"
                            name={`role-${profile.id}`}
                            checked={profile.role === role.value}
                            onChange={() =>
                              void run(
                                () =>
                                  manageUser({
                                    user_id: profile.id,
                                    role: role.value,
                                    jogador_id: player?.id ?? null,
                                  }),
                                "Permissão atualizada.",
                              )
                            }
                          />
                          {role.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="user-player-link">
                    Jogador vinculado
                    <select
                      value={player?.id ?? ""}
                      onChange={(e) =>
                        void run(
                          () =>
                            manageUser({
                              user_id: profile.id,
                              role: profile.role,
                              jogador_id: e.target.value || null,
                            }),
                          e.target.value
                            ? "Jogador vinculado."
                            : "Jogador desvinculado.",
                        )
                      }
                    >
                      <option value="">Sem jogador vinculado</option>
                      {players
                        .filter(
                          (item) =>
                            !item.user_id || item.user_id === profile.id,
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.apelido || item.nome}
                          </option>
                        ))}
                    </select>
                    <small>
                      O vínculo sincroniza cobrança e posição com o jogador.
                    </small>
                  </label>
                  {!player && (
                    <button type="button" onClick={() => void run(() => createPlayerForUser(profile.id), "Jogador diarista de linha criado e vinculado.")}>
                      Criar jogador para esta conta
                    </button>
                  )}
                  {player ? (
                    <div className="user-danger-zone">
                      <span><b>{profile.ativo ? "Suspender acesso" : "Acesso suspenso"}</b><small>{profile.ativo ? "Bloqueia o login e a confirmação na lista." : "Reative para liberar o login novamente."}</small></span>
                      <button type="button" className={`mini ${profile.ativo ? "danger" : ""}`} disabled={busy || profile.id === realProfile?.id} onClick={() => void toggleSuspension(profile)}>{profile.ativo ? "SUSPENDER" : "REATIVAR ACESSO"}</button>
                    </div>
                  ) : profile.role === "user" ? (
                    <div className="user-danger-zone">
                      <span><b>Excluir conta</b><small>Disponível apenas para usuário sem jogador vinculado.</small></span>
                      <button type="button" className="mini danger" disabled={busy} onClick={() => void removeUser(profile)}>EXCLUIR USUÁRIO</button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="secondary user-password"
                    onClick={() => changePassword(profile.id)}
                  >
                    Alterar senha
                  </button>
                </div>
              </details>
            );
          })
        ) : (
          <Empty title="Nenhuma conta encontrada">Tente outro nome ou filtro.</Empty>
        )}
      </section>
      </>}
      {tab === "votos" && <VoteAudit />}
      {tab === "cards" && <section id="cards-da-pelada"><MatchCardsManager /></section>}
      <Toast message={toast} />
    </section>
  );
}

const voteLabels: Record<VoteCategory, string> = {
  destaque: "Destaque",
  surpresa: "Surpresa",
  negativo: "Quem quebrou mais",
  goleiro_destaque: "Melhor goleiro",
};

function participantName(item: Participant) {
  return item.player?.profile?.apelido || item.player?.apelido || item.player?.nome || "Jogador";
}

function VoteAudit() {
  const [gameId, setGameId] = useState(""),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    [toast, setToast] = useState(""),
    state = useLoad(async () => {
      const games = await peladasHistory(), id = gameId || games[0]?.id || "";
      if (!id) return { games, id, votes: [], list: [] };
      const [votes, list] = await Promise.all([superadminVotes(id), participants(id)]);
      return { games, id, votes, list };
    }, gameId);
  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorState message={state.error} retry={state.reload} />;
  const { games, id, votes, list } = state.data!;
  async function run(key: string, action: () => Promise<unknown>, message: string) {
    setBusy(key);
    try { await action(); setChoices({}); setToast(message); await state.reload(); }
    catch (error) { setToast(error instanceof Error ? error.message : "Não foi possível atualizar o voto."); }
    finally { setBusy(""); setTimeout(() => setToast(""), 3500); }
  }
  return <section className="votes-panel">
    <header><span><p className="eyebrow">AUDITORIA DE VOTOS</p><h2>Votos da pelada</h2><small>Visão restrita ao Superadmin. Alterações atualizam o resultado da votação.</small></span>
      {games.length > 0 && <select aria-label="Selecionar pelada para visualizar votos" value={id} onChange={event => setGameId(event.target.value)}>{games.map(game => <option key={game.id} value={game.id}>{new Date(`${game.data}T12:00`).toLocaleDateString("pt-BR")} • {game.local}</option>)}</select>}
    </header>
    {!votes.length ? <Empty title="Nenhum voto nesta pelada">Quando os participantes votarem, a relação aparecerá aqui.</Empty> : <div className="vote-audit-list">{votes.map(vote => {
      const key = `${vote.votante_user_id}:${vote.categoria}`,
        selected = choices[key] ?? vote.avaliado_jogador_id,
        voterPlayerId = list.find(item => item.user_id === vote.votante_user_id)?.jogador_id,
        candidates = list.filter(item => ["confirmado", "presente"].includes(item.status) && item.jogador_id !== voterPlayerId && (vote.categoria !== "goleiro_destaque" || item.categoria === "goleiro"));
      return <article className="vote-audit-row" key={key}>
        <span><b>{voteLabels[vote.categoria]}</b><small>{vote.votante_apelido || vote.votante_nome} votou em</small></span>
        <select aria-label={`Corrigir voto de ${vote.votante_apelido || vote.votante_nome}`} value={selected} onChange={event => setChoices(old => ({ ...old, [key]: event.target.value }))}>
          {candidates.map(item => <option value={item.jogador_id} key={item.jogador_id}>{participantName(item)}</option>)}
        </select>
        <small className="vote-audit-date">Atualizado em {new Date(vote.atualizado_em).toLocaleString("pt-BR")}</small>
        <nav><button disabled={busy === key || selected === vote.avaliado_jogador_id} onClick={() => void run(key, () => updateSuperadminVote(id, vote.votante_user_id, vote.categoria, selected), "Voto corrigido.")}>{busy === key ? "SALVANDO…" : "SALVAR CORREÇÃO"}</button><button className="secondary danger" disabled={busy === key} onClick={() => { if (confirm(`Invalidar o voto de ${vote.votante_apelido || vote.votante_nome}?`)) void run(key, () => invalidateSuperadminVote(id, vote.votante_user_id, vote.categoria), "Voto invalidado."); }}>INVALIDAR</button></nav>
      </article>;
    })}</div>}
    <Toast message={toast} />
  </section>;
}
