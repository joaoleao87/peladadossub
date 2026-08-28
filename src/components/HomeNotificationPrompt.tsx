import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { notificationPreference, recordNotificationPreference } from "../lib/api";
import { usePwaInstall } from "../hooks/usePwaInstall";

export function HomeNotificationPrompt() {
  const { state: installState } = usePwaInstall(), [answered, setAnswered] = useState<boolean | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { notificationPreference().then(value => setAnswered(Boolean(value))).catch(() => setAnswered(false)); }, []);
  if (answered !== false) return null;
  const iosNeedsInstall = installState === "ios";
  async function activate() {
    setBusy(true); setMessage("");
    try {
      const supported = "Notification" in window,
        permission = supported ? await Notification.requestPermission() : "unsupported",
        status = permission === "granted" ? "ativada" : permission === "denied" ? "negada" : "indisponivel";
      await recordNotificationPreference(status);
      setAnswered(true);
      if (permission === "granted") {
        const registration = await navigator.serviceWorker?.ready;
        await registration?.showNotification("Notificações ativadas", { body: "Você receberá os lembretes da Pelada dos Sub neste aparelho.", icon: "/icon-192.png", badge: "/icon-192.png", tag: "notificacoes-ativadas" });
      }
    } catch { setMessage("Não foi possível registrar sua escolha. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <section className="home-notification-prompt"><span><b>Ative as notificações</b><small>Receba avisos da lista e da próxima pelada.</small></span>{iosNeedsInstall ? <Link to="/instalar">INSTALAR PARA ATIVAR</Link> : <button type="button" disabled={busy} onClick={() => void activate()}>{busy ? "ATIVANDO…" : "ATIVAR NOTIFICAÇÕES"}</button>}{message && <em>{message}</em>}</section>;
}
