import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { myPlayer, nextPelada, participants } from "../lib/api";

const REMINDER_INTERVAL = 15 * 60 * 1000;
async function notify(gameId: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker?.ready;
  const options: NotificationOptions & { renotify?: boolean } = { body: "Confirme agora se você vai participar da próxima pelada.", icon: "/icon-192.png", badge: "/icon-192.png", tag: `lista-aberta-${gameId}`, renotify: true };
  if (registration) await registration.showNotification("A lista da pelada abriu", options); else new Notification("A lista da pelada abriu", options);
  localStorage.setItem(`list-reminder-${gameId}`, String(Date.now()));
}
export function ListReminder() {
  const { profile } = useAuth(), [openGame, setOpenGame] = useState<string | null>(null), [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => "Notification" in window ? Notification.permission : "unsupported");
  const check = useCallback(async () => {
    try {
      const [game, player] = await Promise.all([nextPelada(), myPlayer()]);
      if (!game || !player || !game.lista_aberta || !["mensalistas", "geral"].includes(game.fase_lista)) return setOpenGame(null);
      if (game.fase_lista === "mensalistas" && !profile?.mensalista_ativo) return setOpenGame(null);
      const mine = (await participants(game.id)).find(item => item.jogador_id === player.id);
      if (mine && mine.status !== "aguardando_resposta") return setOpenGame(null);
      setOpenGame(game.id);
      const last = Number(localStorage.getItem(`list-reminder-${game.id}`) || 0);
      if (Date.now() - last >= REMINDER_INTERVAL) await notify(game.id);
    } catch { /* A navegação continua funcionando se a consulta do lembrete falhar. */ }
  }, [profile?.mensalista_ativo]);
  useEffect(() => { void check(); const timer = setInterval(() => void check(), 60_000); const visible = () => { if (document.visibilityState === "visible") void check(); }; document.addEventListener("visibilitychange", visible); return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); }; }, [check]);
  if (!openGame) return null;
  async function enable() { const result = await Notification.requestPermission(); setPermission(result); if (result === "granted") await notify(openGame!); }
  return <aside className="list-reminder" role="status"><span><b>A lista abriu</b><small>Confirme sua presença na próxima pelada.</small></span><nav>{permission === "default" && <button className="secondary mini" onClick={() => void enable()}>ATIVAR LEMBRETES</button>}<Link to="/lista">CONFIRMAR AGORA</Link></nav></aside>;
}
