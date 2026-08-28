import { useEffect } from "react";
import { markNotificationsDelivered, pendingNotifications } from "../lib/api";

export function NotificationDelivery() {
  useEffect(() => {
    let active = true;
    async function deliver() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        const notifications = await pendingNotifications();
        if (!active || !notifications.length) return;
        const registration = await navigator.serviceWorker.ready;
        await Promise.all(notifications.map(item => registration.showNotification(item.titulo, { body: item.mensagem, icon: "/icon-192.png", badge: "/icon-192.png", tag: `app-${item.id}`, data: { url: item.link } })));
        await markNotificationsDelivered(notifications.map(item => item.id));
      } catch { /* A entrega será repetida no próximo ciclo. */ }
    }
    void deliver();
    const timer = setInterval(() => void deliver(), 60_000);
    const visible = () => { if (document.visibilityState === "visible") void deliver(); };
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, []);
  return null;
}
