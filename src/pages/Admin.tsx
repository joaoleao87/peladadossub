import { useState, type FormEvent } from "react";
import { ErrorState, Spinner, Toast } from "../components/Ui";
import { PlayerManager } from "../components/PlayerManager";
import { PlayerControlPanel } from "../components/PlayerControlPanel";
import { useLoad } from "../hooks/useLoad";
import {
  activeSeries,
  adminSummary,
  generateNextPelada,
  savePelada,
  saveSeries,
  sendMassNotification,
} from "../lib/api";
import type { Pelada } from "../lib/database.types";

export function Admin() {
  const [tab, setTab] = useState<"pelada" | "jogadores" | "controle" | "notificacoes">("pelada"),
    [toast, setToast] = useState("");
  const state = useLoad(async () => {
    const [summary, series] = await Promise.all([
      adminSummary(),
      activeSeries(),
    ]);
    return { summary, series };
  });
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const { summary, series } = state.data!;
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
  async function notificationSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form=e.currentTarget,f=new FormData(form);
    if(!confirm("Enviar esta notificação para o público selecionado?"))return;
    try { const total=await sendMassNotification(String(f.get("titulo")),String(f.get("mensagem")),String(f.get("link")||"/"),String(f.get("publico")||"todos")); feedback(`Notificação registrada para ${total} conta${total===1?"":"s"}.`); form.reset(); }
    catch(err){feedback(err instanceof Error?err.message:"Não foi possível enviar.");}
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
  return (
    <section>
      <p className="eyebrow">DIRETORIA</p>
      <h1>Admin</h1>
      <div className="tabs">
        {(["pelada", "jogadores", "controle", "notificacoes"] as const).map((x) => (
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
        </>
      )}
      {tab === "notificacoes" && (
        <form className="panel form-grid" onSubmit={notificationSubmit}>
          <h2>Notificação em massa</h2>
          <label className="wide">Título<input name="titulo" maxLength={80} required /></label>
          <label className="wide">Mensagem<textarea name="mensagem" maxLength={300} rows={4} required /></label>
          <label className="wide">Público<select name="publico" defaultValue="todos"><option value="todos">Todas as contas ativas</option><option value="mensalistas">Mensalistas</option><option value="diaristas">Diaristas</option><option value="confirmados">Confirmados na próxima pelada</option><option value="inadimplentes">Pagamentos pendentes</option><option value="admins">Admins e superadmins</option></select></label>
          <label className="wide">Destino<select name="link" defaultValue="/"><option value="/">Tela inicial</option><option value="/lista">Lista</option><option value="/perfil">Perfil</option><option value="/ranking">Ranking</option></select></label>
          <button className="wide">ENVIAR NOTIFICAÇÃO</button>
          <small className="wide">O envio será registrado para o público selecionado.</small>
        </form>
      )}
      {tab === "jogadores" && <PlayerManager />}
      {tab === "controle" && <PlayerControlPanel />}
      <Toast message={toast} />
    </section>
  );
}
