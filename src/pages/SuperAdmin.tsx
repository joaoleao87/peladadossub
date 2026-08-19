import { useState, type FormEvent } from "react";
import { Badge, Empty, ErrorState, Spinner, Toast } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import {
  allPlayers,
  allProfiles,
  createPlayerForUser,
  createUser,
  manageUser,
  resetUserPassword,
} from "../lib/api";
import type {
  ListPosition,
  PlayerType,
  Profile,
  Role,
} from "../lib/database.types";
import "./super-admin.css";

const roles: { value: Role; label: string }[] = [
  { value: "user", label: "Usuário" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Superadmin" },
];

export function SuperAdmin() {
  const state = useLoad(async () => {
      const [profiles, players] = await Promise.all([
        allProfiles(),
        allPlayers(),
      ]);
      return { profiles, players };
    }),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false);
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
  async function changePassword(userId: string) {
    const password = prompt("Nova senha (mínimo 8 caracteres):");
    if (!password) return;
    await run(() => resetUserPassword(userId, password), "Senha alterada.");
  }
  const linkedPlayer = (profile: Profile) =>
    players.find((player) => player.user_id === profile.id);

  return (
    <section>
      <p className="eyebrow">CONTROLE DE ACESSO</p>
      <h1>Superadmin</h1>
      <form className="panel form-grid" onSubmit={submit}>
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
            <option value="avulso">Avulso</option>
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
        {profiles.length ? (
          profiles.map((profile) => {
            const player = linkedPlayer(profile);
            return (
              <details className="user-card" key={profile.id}>
                <summary>
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
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          () => createPlayerForUser(profile.id),
                          "Jogador avulso de linha criado e vinculado.",
                        )
                      }
                    >
                      Criar jogador para esta conta
                    </button>
                  )}
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
          <Empty title="Nenhum usuário" />
        )}
      </section>
      <Toast message={toast} />
    </section>
  );
}
