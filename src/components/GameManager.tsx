import { useState, type FormEvent } from "react";
import {
  adminAddPlayer,
  adminParticipantById,
  allPlayers,
  importWhatsAppList,
  participants,
  peladasHistory,
  savePlayer,
} from "../lib/api";
import { useLoad } from "../hooks/useLoad";
import type { Participant } from "../lib/database.types";
import { Empty, ErrorState, Spinner, Toast } from "./Ui";
import { parseWhatsAppList } from "../lib/whatsapp";
import "./game-manager.css";

const labels: Record<string, string> = {
  aguardando_resposta: "Aguardando resposta",
  confirmado: "Confirmado",
  presente: "Presente",
  espera: "Suplente",
  faltou: "Faltou",
  recusado: "Não vai",
};
export function GameManager() {
  const [selected, setSelected] = useState(""),
    [toast, setToast] = useState(""),
    [importText, setImportText] = useState(""),
    [pending, setPending] = useState<{ nome: string; grupo: string }[] | null>(null),
    [resolutions, setResolutions] = useState<Record<string, string>>({});
  const state = useLoad(async () => {
    const [games, players] = await Promise.all([
        peladasHistory(),
        allPlayers(),
      ]),
      lists = Object.fromEntries(
        await Promise.all(
          games.map(
            async (game) => [game.id, await participants(game.id)] as const,
          ),
        ),
      );
    return { games, players, lists };
  });
  if (state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const { games, players, lists } = state.data!,
    gameId = selected || games[0]?.id || "",
    game = games.find((item) => item.id === gameId),
    active = (lists[gameId] || []).filter(
      (item) => item.status !== "cancelado",
    ),
    line = active.filter(
      (item) => item.categoria === "linha" && ["confirmado", "presente"].includes(item.status),
    ),
    waiting = active.filter((item) => item.status === "espera"),
    keepers = active.filter((item) => item.categoria === "goleiro" && ["confirmado", "presente"].includes(item.status)),
    awaiting = active.filter((item) => item.status === "aguardando_resposta"),
    declined = active.filter((item) => ["recusado", "faltou"].includes(item.status));
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
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      id = String(new FormData(form).get("jogador_id"));
    if (id && gameId) {
      await run(() => adminAddPlayer(gameId, id), "Jogador adicionado.");
      form.reset();
    }
  }
  const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  async function importList(){const items=parseWhatsAppList(importText);if(!items.length){setToast("Nenhum nome numerado foi encontrado.");return}const unknown=items.filter(item=>!players.some(player=>[player.nome,player.apelido||""].some(name=>normalize(name)===normalize(item.nome))));if(unknown.length){setPending(items);setResolutions({});return}await run(()=>importWhatsAppList(gameId,items),`${items.length} nomes importados.`);setImportText("")}
  async function confirmImport(){if(!pending)return;try{const resolved=[];for(const item of pending){const existing=players.find(player=>[player.nome,player.apelido||""].some(name=>normalize(name)===normalize(item.nome)));if(existing){resolved.push(item);continue}const choice=resolutions[item.nome];if(!choice)throw new Error(`Escolha o que fazer com ${item.nome}.`);if(choice==="new"){await savePlayer({nome:item.nome,tipo:"avulso",posicao:item.grupo==="goleiro"?"goleiro":"linha"});resolved.push(item)}else{const player=players.find(p=>p.id===choice);if(!player)throw new Error("Jogador não encontrado.");resolved.push({...item,nome:player.apelido||player.nome})}}await importWhatsAppList(gameId,resolved);setPending(null);setImportText("");setToast(`${resolved.length} nomes importados.`);await state.reload()}catch(err){setToast(err instanceof Error?err.message:"Não foi possível importar.")}}
  const group = (title: string, items: Participant[]) => (
    <section className="roster-group">
      <header>
        <h3>{title}</h3>
        <span>{items.length}</span>
      </header>
      {items.length ? (
        <ol className="roster-list">
          {items.map((item, index) => {
            const account = item.player?.profile,
              name =
              account?.apelido?.trim() ||
              account?.nome ||
              item.player?.apelido ||
              item.player?.nome ||
              item.profile?.apelido ||
              item.profile?.nome ||
              "?";
            return (
              <li key={item.id}>
                <span className="roster-number">{index + 1}</span>
                <span className="roster-avatar">
                  {account?.foto_url ? <img src={account.foto_url} alt="" /> : name[0]}
                </span>
                <span className="roster-player">
                  <b>{name}</b>
                  <small>{item.player?.nome && item.player.nome !== name ? `${item.player.nome} • ` : ""}{labels[item.status] || item.status}</small>
                </span>
                <nav
                  className="roster-actions"
                  aria-label={`Ações para ${name}`}
                >
                  {["aguardando_resposta", "recusado", "faltou"].includes(item.status) && (
                    <button
                      onClick={() =>
                        run(
                          () => adminParticipantById(item.id, "promote"),
                          "Jogador confirmado.",
                        )
                      }
                    >
                      Confirmar
                    </button>
                  )}
                  {item.status === "espera" && item.player?.tipo === "avulso" && game?.fase_lista !== "geral" ? (
                    <button disabled>Aguarda avulsos</button>
                  ) : item.status === "espera" && (
                    <button
                      onClick={() =>
                        run(
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
                      className="secondary"
                      onClick={() =>
                        run(
                          () => adminParticipantById(item.id, "demote"),
                          "Jogador movido para suplentes.",
                        )
                      }
                    >
                      Suplente
                    </button>
                  )}
                  <button
                    className="danger"
                    aria-label={`Remover ${name}`}
                    onClick={() =>
                      confirm(`Remover ${name} desta lista?`) &&
                      run(
                        () => adminParticipantById(item.id, "remove"),
                        "Jogador removido.",
                      )
                    }
                  >
                    Remover
                  </button>
                </nav>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="roster-empty">Nenhum jogador neste grupo.</p>
      )}
    </section>
  );
  return (
    <section className="roster-panel">
      <header className="roster-heading">
        <span>
          <small>ADMINISTRAÇÃO</small>
          <h2>Lista da pelada</h2>
        </span>
        {games.length > 0 && (
          <select
            aria-label="Selecionar pelada"
            value={gameId}
            onChange={(e) => setSelected(e.target.value)}
          >
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {new Date(`${game.data}T12:00`).toLocaleDateString("pt-BR")} •{" "}
                {game.local}
              </option>
            ))}
          </select>
        )}
      </header>
      {games.length ? (
        <>
          <details className="roster-add">
            <summary>Adicionar membro</summary>
            <form onSubmit={add}>
              <select name="jogador_id" defaultValue="" required>
                <option value="" disabled>
                  Escolha um jogador…
                </option>
                {players.map((player) => {
                  const entry = active.find((item) => item.jogador_id === player.id);
                  return (
                    <option key={player.id} value={player.id} disabled={Boolean(entry)}>
                      {player.apelido || player.nome} • {player.tipo === "mensalista" ? "Mensalista" : "Avulso"}{entry ? ` • ${labels[entry.status] || entry.status}` : ""}
                    </option>
                  );
                })}
              </select>
              <button>Adicionar</button>
            </form>
          </details>
          <details className="roster-add">
            <summary>Importar lista do WhatsApp</summary>
            <form className="roster-import" onSubmit={e=>{e.preventDefault();void importList()}}>
              <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={'1- Vinicius\n2- Guilherme\n\nSuplentes\n1- Diego\n\nGoleiros\n1- Alê'}/>
              <button>Conferir lista</button>
            </form>
          </details>
          {group("Confirmados", line)}
          {group("Suplentes", waiting)}
          {group("Goleiros", keepers)}
          {group("Aguardando resposta", awaiting)}
          {declined.length > 0 && group("Não vão", declined)}
        </>
      ) : (
        <Empty title="Nenhuma pelada cadastrada" />
      )}
      <Toast message={toast} />
      {pending&&<aside className="roster-modal" role="dialog" aria-modal="true"><section><h2>Confirmar nomes</h2><p>Vincule cada nome desconhecido ou autorize um novo cadastro.</p>{pending.filter(item=>!players.some(player=>[player.nome,player.apelido||""].some(name=>normalize(name)===normalize(item.nome)))).map(item=><label key={item.nome}><b>{item.nome}</b><select value={resolutions[item.nome]||""} onChange={e=>setResolutions(old=>({...old,[item.nome]:e.target.value}))}><option value="">Escolha…</option><option value="new">Cadastrar novo jogador</option>{players.map(player=><option value={player.id} key={player.id}>Usar {player.apelido||player.nome}</option>)}</select></label>)}<footer><button className="secondary" onClick={()=>setPending(null)}>Cancelar</button><button onClick={confirmImport}>Confirmar</button></footer></section></aside>}
    </section>
  );
}
