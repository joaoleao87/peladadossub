import { useState, type FormEvent } from "react";
import { useLoad } from "../hooks/useLoad";
import {
  activeSeries,
  expenses,
  generateCasualCharges,
  generateMonthlyCharges,
  payments,
  peladasHistory,
  receiptUrl,
  refreshLatePayments,
  saveFinanceConfig,
  settleMonthlyCharges,
  updatePayment,
} from "../lib/api";
import type { Payment } from "../lib/database.types";
import { ExpensePanel } from "./ExpensePanel";
import { calculateFinanceSummary } from "../lib/finance";
import { Badge, Empty, ErrorState, Spinner, Toast } from "./Ui";

type Tab = "resumo" | "mensalidades" | "avulsos" | "despesas" | "configuracoes";
const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }),
  nextMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d.toISOString().slice(0, 7);
  };
export function FinanceCenter() {
  const [tab, setTab] = useState<Tab>("resumo"),
    [month, setMonth] = useState(nextMonth()),
    [gameId, setGameId] = useState(""),
    [toast, setToast] = useState("");
  const state = useLoad(async () => {
    await refreshLatePayments();
    const [series, items, games, costs] = await Promise.all([
      activeSeries(),
      payments(),
      peladasHistory(),
      expenses(),
    ]);
    return { series, items, games, costs };
  });
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const { series, items, games, costs } = state.data!,
    summary = calculateFinanceSummary(items, costs),
    selectedGame = gameId || games[0]?.id || "",
    monthly = items.filter(
      (x) => x.tipo === "mensalidade" && x.competencia?.slice(0, 7) === month,
    ),
    casual = items.filter(
      (x) => x.tipo === "avulso" && x.pelada_id === selectedGame,
    ),
    receivables = items.filter((item) => ["pendente", "atrasado"].includes(item.status)).sort((a,b)=>(a.data_vencimento??"9999").localeCompare(b.data_vencimento??"9999")).slice(0,5),
    payables = costs.flatMap((cost)=>cost.parcelas.filter((installment)=>!installment.paga).map((installment)=>({...installment,descricao:cost.descricao}))).sort((a,b)=>a.data_vencimento.localeCompare(b.data_vencimento)).slice(0,5),
    date = (value:string|null|undefined) => value ? new Date(`${value}T12:00`).toLocaleDateString("pt-BR") : "Sem vencimento";
  const feedback = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  };
  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      feedback(message);
      await state.reload();
    } catch (err) {
      feedback(
        err instanceof Error ? err.message : "Não foi possível concluir.",
      );
    }
  }
  async function config(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!series) return;
    const f = new FormData(e.currentTarget);
    await run(
      () =>
        saveFinanceConfig(series.id, {
          valor_mensalista: Number(f.get("mensal")),
          valor_avulso: Number(f.get("avulso")),
          dia_vencimento: Number(f.get("vencimento")),
          chave_pix: String(f.get("pix")),
        }),
      "Configuração atualizada.",
    );
  }
  async function proof(payment: Payment) {
    if (!payment.comprovante_path) return;
    open(
      await receiptUrl(payment.comprovante_path),
      "_blank",
      "noopener,noreferrer",
    );
  }
  const rows = (list: Payment[]) => (
    <div className="panel">
      <h2>Lançamentos</h2>
      {list.length ? (
        list.map((p) => (
          <div className="payment-row" key={p.id}>
            <div>
              <b>
                {p.player?.apelido ||
                  p.player?.nome ||
                  p.profile?.apelido ||
                  p.profile?.nome}
              </b>
              <small>
                {p.referencia || p.tipo} • {money.format(Number(p.valor))}
                {p.data_vencimento
                  ? ` • vence ${new Date(`${p.data_vencimento}T12:00`).toLocaleDateString("pt-BR")}`
                  : ""}
              </small>
            </div>
            <div>
              <Badge
                tone={
                  p.status === "pago"
                    ? "green"
                    : p.status === "atrasado"
                      ? "red"
                      : p.status === "isento"
                        ? "gray"
                        : "yellow"
                }
              >
                {p.status}
              </Badge>
              {p.comprovante_path &&
                ["pendente", "atrasado"].includes(p.status) && (
                  <button className="mini secondary" onClick={() => proof(p)}>
                    COMPROVANTE
                  </button>
                )}
              {["pendente", "atrasado"].includes(p.status) && (
                <button
                  className="mini"
                  onClick={() =>
                    run(
                      () => updatePayment(p.id, "pago", "pix"),
                      "Pagamento quitado.",
                    )
                  }
                >
                  QUITAR
                </button>
              )}
            </div>
          </div>
        ))
      ) : (
        <Empty title="Nenhum lançamento nesta seleção" />
      )}
    </div>
  );
  return (
    <div>
      <div className="tabs finance-tabs">
        {(
          [
            "resumo",
            "mensalidades",
            "avulsos",
            "despesas",
            "configuracoes",
          ] as Tab[]
        ).map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x === "configuracoes" ? "Config." : x === "avulsos" ? "diaristas" : x}
          </button>
        ))}
      </div>
      {tab === "resumo" && (
        <>
          <div className="finance-kpis">
            <div>
              <span>Em caixa</span>
              <b>{money.format(summary.balance)}</b>
            </div>
            <div className={summary.expectedBalance < 0 ? "negative" : ""}>
              <span>Resultado previsto</span>
              <b>{money.format(summary.expectedBalance)}</b>
            </div>
            <div>
              <span>Pendências</span>
              <b>{money.format(summary.pendingIncome)}</b>
              <small>{summary.pendingCount} cobrança{summary.pendingCount===1?"":"s"} em aberto</small>
            </div>
          </div>
          <div className="finance-explanation">
            <b>Por que o previsto pode ficar negativo?</b>
            <span>{money.format(summary.balance)} em caixa + {money.format(summary.pendingIncome)} a receber − {money.format(summary.futureCosts)} a pagar = <strong>{money.format(summary.expectedBalance)}</strong>.</span>
          </div>
          <div className="finance-schedule">
            <section className="panel">
              <h2>Próximos recebimentos</h2>
              {receivables.length ? receivables.map((payment)=><div className="schedule-row" key={payment.id}><span><b>{payment.player?.apelido||payment.player?.nome||payment.profile?.apelido||payment.profile?.nome||"Jogador"}</b><small>{payment.referencia||payment.tipo} • {date(payment.data_vencimento)}</small></span><strong>{money.format(Number(payment.valor))}</strong></div>) : <Empty title="Nada a receber"/>}
            </section>
            <section className="panel">
              <h2>Próximos pagamentos</h2>
              {payables.length ? payables.map((installment)=><div className="schedule-row" key={installment.id}><span><b>{installment.descricao}</b><small>Parcela {installment.numero} • {date(installment.data_vencimento)}</small></span><strong>{money.format(Number(installment.valor))}</strong></div>) : <Empty title="Nada a pagar"/>}
            </section>
          </div>
        </>
      )}
      {tab === "mensalidades" && (
        <>
          {!series ? (
            <Empty title="Configure a recorrência primeiro" />
          ) : (
            <>
              <div className="panel form-grid">
                <h2>Mensalidades por mês</h2>
                <label className="wide">
                  Competência
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </label>
                <button
                  onClick={() =>
                    run(
                      () => generateMonthlyCharges(series.id, `${month}-01`),
                      "Cobranças do mês geradas.",
                    )
                  }
                >
                  GERAR COBRANÇAS
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    confirm(
                      "Quitar todas as mensalidades pendentes deste mês?",
                    ) &&
                    run(
                      () => settleMonthlyCharges(`${month}-01`),
                      "Mensalidades do mês quitadas.",
                    )
                  }
                >
                  QUITAR MÊS
                </button>
                <small className="wide">
                  Gerar cria uma cobrança para cada mensalista não isento.
                  Repetir não duplica.
                </small>
              </div>
              {rows(monthly)}
            </>
          )}
        </>
      )}
      {tab === "avulsos" && (
        <>
          {!series ? (
            <Empty title="Configure a recorrência primeiro" />
          ) : (
            <>
              <div className="panel form-grid">
                <h2>Cobrança por pelada</h2>
                <label className="wide">
                  Pelada
                  <select
                    value={selectedGame}
                    onChange={(e) => setGameId(e.target.value)}
                  >
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {new Date(`${g.data}T12:00`).toLocaleDateString(
                          "pt-BR",
                        )}{" "}
                        • {g.local}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="wide"
                  disabled={!selectedGame}
                  onClick={() =>
                    run(
                      () => generateCasualCharges(selectedGame, series.id),
                      "Diaristas desta pelada cobrados.",
                    )
                  }
                >
                  GERAR COBRANÇAS DOS DIARISTAS
                </button>
                <small className="wide">
                  Cria cobrança somente para diaristas confirmados ou presentes
                  nesta pelada.
                </small>
              </div>
              {rows(casual)}
            </>
          )}
        </>
      )}
      {tab === "despesas" && <ExpensePanel />}
      {tab === "configuracoes" && series && (
        <form className="panel form-grid" onSubmit={config}>
          <h2>Configurações</h2>
          <label>
            Mensalidade
            <input
              name="mensal"
              type="number"
              min="0"
              step="0.01"
              defaultValue={series.valor_mensalista}
            />
          </label>
          <label>
            Diarista/pelada
            <input
              name="avulso"
              type="number"
              min="0"
              step="0.01"
              defaultValue={series.valor_avulso}
            />
          </label>
          <label>
            Dia do vencimento
            <input
              name="vencimento"
              type="number"
              min="1"
              max="28"
              defaultValue={series.dia_vencimento}
            />
          </label>
          <label className="wide">
            Chave PIX
            <input name="pix" defaultValue={series.chave_pix} />
          </label>
          <button className="wide">SALVAR CONFIGURAÇÃO</button>
        </form>
      )}
      <Toast message={toast} />
    </div>
  );
}
