import { lazy, Suspense, useState, type FormEvent } from "react";
import { Empty, ErrorState, Spinner, Toast } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import {
  activeSeries,
  adminAddPlayer,
  adminParticipantById,
  adminSummary,
  allPlayers,
  allProfiles,
  createMonthlyInvite,
  deletePlayer,
  generateNextPelada,
  importWhatsAppList,
  savePelada,
  savePlayer,
  saveSeries,
  setListPhase,
} from "../lib/api";
import type {
  ListPhase,
  ListPosition,
  Pelada,
  PlayerType,
} from "../lib/database.types";
import { formatWhatsAppList, parseWhatsAppList } from "../lib/whatsapp";

const FinancePanel = lazy(() =>
  import("../components/FinancePanel").then((module) => ({
    default: module.FinancePanel,
  })),
);

export function Admin() {
  const [tab, setTab] = useState<"pelada" | "jogadores" | "financeiro">(
      "pelada",
    ),
    [toast, setToast] = useState(""),
    [importText, setImportText] = useState("");
  const state = useLoad(async () => {
    const [summary, players, profiles, series] = await Promise.all([
      adminSummary(),
      allPlayers(),
      allProfiles(),
      activeSeries(),
    ]);
    return { summary, players, profiles, series };
  });
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const { summary, players, profiles, series } = state.data!;
  const feedback = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  };
  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      feedback(success);
      await state.reload();
    } catch (err) {
      feedback(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }
  async function recurrenceSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(
      () =>
        saveSeries({
          id: series?.id,
          nome: "Pelada semanal",
          dia_semana: Number(f.get("dia")),
          horario: String(f.get("horario")),
          local: String(f.get("local")),
          limite_jogadores: 20,
          antecedencia_mensalistas_horas: 48,
          antecedencia_geral_horas: 48,
          antecedencia_saida_horas: 3,
          valor_mensalista: series?.valor_mensalista ?? 0,
          valor_avulso: series?.valor_avulso ?? 0,
          dia_vencimento: series?.dia_vencimento ?? 10,
          chave_pix: series?.chave_pix ?? "Peladadossub@gmail.com",
          ativa: true,
        }),
      "Recorrência salva.",
    );
  }
  async function gameSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(
      () =>
        savePelada({
          id: summary.pelada?.id,
          data: String(f.get("data")),
          horario: String(f.get("horario")),
          local: String(f.get("local")),
          limite_jogadores: 20,
          status: String(f.get("status")) as Pelada["status"],
          lista_aberta: false,
          fase_lista: summary.pelada?.fase_lista ?? "fechada",
        }),
      "Pelada salva.",
    );
  }
  async function playerSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    await run(
      () =>
        savePlayer({
          nome: String(f.get("nome")),
          tipo: String(f.get("tipo")) as PlayerType,
          posicao: String(f.get("posicao")) as ListPosition,
          user_id: String(f.get("user_id")) || null,
        }),
      "Jogador cadastrado.",
    );
    form.reset();
  }
  function name(p: (typeof summary.list)[number]) {
    return (
      p.player?.apelido ||
      p.player?.nome ||
      p.profile?.apelido ||
      p.profile?.nome ||
      ""
    );
  }
  function copyList() {
    if (!summary.pelada) return;
    const active = summary.list.filter((p) =>
        ["confirmado", "presente"].includes(p.status),
      ),
      line = active
        .filter((p) => p.categoria !== "goleiro")
        .slice(0, 20)
        .map(name),
      keepers = active.filter((p) => p.categoria === "goleiro").map(name),
      waiting = summary.list.filter((p) => p.status === "espera").map(name),
      date = new Date(`${summary.pelada.data}T12:00`),
      when =
        date.toDateString() === new Date(Date.now() + 86400000).toDateString()
          ? "amanhã"
          : date.toLocaleDateString("pt-BR");
    void navigator.clipboard
      .writeText(
        formatWhatsAppList(
          `Pelada ${when} ${summary.pelada.horario.slice(0, 5)}`,
          line,
          waiting,
          keepers,
        ),
      )
      .then(() => feedback("Lista copiada com as 20 vagas."));
  }
  async function importList() {
    if (!summary.pelada) return;
    const items = parseWhatsAppList(importText);
    if (!items.length) {
      feedback("Nenhum nome numerado foi encontrado.");
      return;
    }
    await run(
      () => importWhatsAppList(summary.pelada!.id, items),
      `${items.length} nomes importados.`,
    );
    setImportText("");
  }
  async function addToList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!summary.pelada) return;
    const jogadorId = String(new FormData(e.currentTarget).get("jogador_id"));
    if (jogadorId) await run(() => adminAddPlayer(summary.pelada!.id, jogadorId), "Jogador adicionado.");
  }
  async function copyInvite() {
    try {
      const token = await createMonthlyInvite(),
        url = `${location.origin}/cadastro-mensalista?token=${token}`;
      await navigator.clipboard.writeText(url);
      feedback(
        "Link de mensalista copiado. Válido por 7 dias e para um cadastro.",
      );
    } catch (err) {
      feedback(
        err instanceof Error
          ? err.message
          : "Não foi possível criar o convite.",
      );
    }
  }
  async function removePlayer(id: string, nome: string) {
    if (
      !confirm(
        `Excluir ${nome} da lista de jogadores? O histórico será mantido.`,
      )
    )
      return;
    await run(() => deletePlayer(id), "Jogador excluído.");
  }
  return (
    <section>
      <p className="eyebrow">DIRETORIA</p>
      <h1>Admin</h1>
      <div className="admin-metrics">
        <div>
          <b>
            {
              summary.list.filter(
                (p) => p.status === "confirmado" && p.categoria !== "goleiro",
              ).length
            }
          </b>
          <span>Confirmados</span>
        </div>
        <div>
          <b>{summary.list.filter((p) => p.status === "espera").length}</b>
          <span>Suplentes</span>
        </div>
        <div>
          <b>
            {
              summary.list.filter(
                (p) => p.status === "confirmado" && p.categoria === "goleiro",
              ).length
            }
          </b>
          <span>Goleiros</span>
        </div>
        <div>
          <b>{players.filter((p) => p.tipo === "mensalista").length}</b>
          <span>Mensalistas</span>
        </div>
      </div>
      <div className="tabs">
        {(["pelada", "jogadores", "financeiro"] as const).map((x) => (
          <button
            type="button"
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </div>
      {tab === "jogadores" && (
        <button
          type="button"
          className="full invite-button"
          onClick={copyInvite}
        >
          COPIAR LINK PARA NOVO MENSALISTA
        </button>
      )}
      {tab === "pelada" && (
        <>
          <form className="panel form-grid" onSubmit={recurrenceSubmit}>
            <h2>Recorrência semanal</h2>
            <label>
              Dia
              <select name="dia" defaultValue={series?.dia_semana ?? 5}>
                <option value="0">Domingo</option>
                <option value="1">Segunda</option>
                <option value="2">Terça</option>
                <option value="3">Quarta</option>
                <option value="4">Quinta</option>
                <option value="5">Sexta</option>
                <option value="6">Sábado</option>
              </select>
            </label>
            <label>
              Horário
              <input
                name="horario"
                type="time"
                defaultValue={series?.horario?.slice(0, 5) ?? "20:30"}
                required
              />
            </label>
            <label className="wide">
              Local
              <input name="local" defaultValue={series?.local ?? ""} required />
            </label>
            <button className="wide">SALVAR RECORRÊNCIA</button>
            {series && (
              <button
                type="button"
                className="wide secondary"
                onClick={() =>
                  run(
                    () => generateNextPelada(series.id),
                    "Próxima pelada gerada.",
                  )
                }
              >
                GERAR PRÓXIMA PELADA
              </button>
            )}
          </form>
          <form className="panel form-grid" onSubmit={gameSubmit}>
            <h2>{summary.pelada ? "Próxima pelada" : "Ocorrência especial"}</h2>
            <label>
              Data
              <input
                type="date"
                name="data"
                defaultValue={summary.pelada?.data}
                required
              />
            </label>
            <label>
              Horário
              <input
                type="time"
                name="horario"
                defaultValue={summary.pelada?.horario?.slice(0, 5)}
                required
              />
            </label>
            <label className="wide">
              Local
              <input
                name="local"
                defaultValue={summary.pelada?.local}
                required
              />
            </label>
            <label>
              Status
              <select
                name="status"
                defaultValue={summary.pelada?.status ?? "aberta"}
              >
                <option value="aberta">Aberta</option>
                <option value="encerrada">Encerrada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </label>
            <button className="wide">SALVAR OCORRÊNCIA</button>
          </form>
          {summary.pelada && (
            <div className="panel">
              <h2>Lista: {summary.pelada.fase_lista}</h2>
              <div className="phase-actions">
                {(
                  [
                    ["mensalistas", "ABRIR MENSALISTAS"],
                    ["geral", "ABRIR GERAL"],
                    ["fechada", "FECHAR"],
                  ] as [ListPhase, string][]
                ).map(([phase, label]) => (
                  <button
                    className="mini"
                    key={phase}
                    onClick={() =>
                      run(
                        () => setListPhase(summary.pelada!.id, phase),
                        `Lista: ${phase}.`,
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
                <button className="mini" onClick={copyList}>
                  COPIAR WHATSAPP
                </button>
              </div>
              <form className="whatsapp-import" onSubmit={addToList}>
                <label>
                  Adicionar jogador à lista
                  <select name="jogador_id" required defaultValue="">
                    <option value="" disabled>Selecione…</option>
                    {players.filter(player => !summary.list.some(item => item.jogador_id === player.id && item.status !== "cancelado")).map(player => <option key={player.id} value={player.id}>{player.apelido || player.nome}</option>)}
                  </select>
                </label>
                <button>ADICIONAR MEMBRO</button>
              </form>
              <div className="whatsapp-import">
                <label>
                  Importar lista do WhatsApp
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={
                      "1- Vinicius\n2- Guilherme\n\nSuplentes\n1- João\n\nGoleiros\n1- Ale"
                    }
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  onClick={importList}
                >
                  IMPORTAR NOMES
                </button>
              </div>
              {summary.list.length ? (
                summary.list.map((p) => (
                  <div className="admin-row" key={p.id}>
                    <span>
                      <b>{name(p)}</b>
                      <small>
                        {p.categoria} • {p.status}
                        {!p.user_id ? " • sem conta" : ""}
                      </small>
                    </span>
                    <div>
                      {p.status === "espera" && (
                        <button
                          className="mini"
                          onClick={() =>
                            run(
                              () => adminParticipantById(p.id, "promote"),
                              "Promovido.",
                            )
                          }
                        >
                          Promover
                        </button>
                      )}
                      <button
                        className="mini"
                        onClick={() =>
                          run(
                            () => adminParticipantById(p.id, "presente"),
                            "Presença marcada.",
                          )
                        }
                      >
                        Presente
                      </button>
                      <button className="mini secondary" onClick={() => run(() => adminParticipantById(p.id, p.categoria === "goleiro" ? "linha" : "goleiro"), "Posição alterada.")}>
                        {p.categoria === "goleiro" ? "MOVER PARA LINHA" : "MOVER PARA GOL"}
                      </button>
                      <button
                        className="mini danger"
                        onClick={() =>
                          run(
                            () => adminParticipantById(p.id, "remove"),
                            "Removido.",
                          )
                        }
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty title="Lista vazia" />
              )}
            </div>
          )}
        </>
      )}
      {tab === "jogadores" && (
        <>
          <form className="panel form-grid" onSubmit={playerSubmit}>
            <h2>Novo jogador</h2>
            <label className="wide">
              Nome
              <input name="nome" minLength={2} required />
            </label>
            <label>
              Tipo
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
            <label className="wide">
              Vincular conta (opcional)
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
            <button className="wide">CADASTRAR JOGADOR</button>
          </form>
          <div className="panel">
            <h2>Jogadores</h2>
            {players.map((p) => (
              <div className="admin-row" key={p.id}>
                <span>
                  <b>{p.apelido || p.nome}</b>
                  <small>
                    {p.tipo} • {p.posicao} •{" "}
                    {p.user_id ? "conta vinculada" : "sem conta"}
                  </small>
                  {!p.user_id && (
                    <select
                      aria-label={`Vincular conta a ${p.nome}`}
                      defaultValue=""
                      onChange={(e) =>
                        e.target.value &&
                        run(
                          () =>
                            savePlayer({
                              id: p.id,
                              nome: p.nome,
                              tipo: p.tipo,
                              posicao: p.posicao,
                              user_id: e.target.value,
                            }),
                          "Conta vinculada.",
                        )
                      }
                    >
                      <option value="">Vincular conta…</option>
                      {profiles
                        .filter(
                          (profile) =>
                            !players.some(
                              (player) => player.user_id === profile.id,
                            ),
                        )
                        .map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.apelido || profile.nome}
                          </option>
                        ))}
                    </select>
                  )}
                </span>
                <div>
                  <button
                    className="mini"
                    onClick={() =>
                      run(
                        () =>
                          savePlayer({
                            id: p.id,
                            nome: p.nome,
                            tipo:
                              p.tipo === "mensalista" ? "avulso" : "mensalista",
                            posicao: p.posicao,
                            user_id: p.user_id,
                          }),
                        "Tipo atualizado.",
                      )
                    }
                  >
                    Mensalista/Avulso
                  </button>
                  <button
                    className="mini"
                    onClick={() =>
                      run(
                        () =>
                          savePlayer({
                            id: p.id,
                            nome: p.nome,
                            tipo: p.tipo,
                            posicao:
                              p.posicao === "goleiro" ? "linha" : "goleiro",
                            user_id: p.user_id,
                          }),
                        "Posição atualizada.",
                      )
                    }
                  >
                    Linha/Goleiro
                  </button>
                  <button
                    className="mini danger"
                    onClick={() => removePlayer(p.id, p.apelido || p.nome)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "financeiro" && (
        <Suspense fallback={<Spinner />}>
          <FinancePanel />
        </Suspense>
      )}
      <Toast message={toast} />
    </section>
  );
}
