import { useState } from "react";
import { Link } from "react-router-dom";
import { usePwaInstall } from "../hooks/usePwaInstall";

function currentPermission(): NotificationPermission | "unsupported" {
  return "Notification" in window ? Notification.permission : "unsupported";
}

async function showActivationNotification() {
  const registration = await navigator.serviceWorker?.ready;
  const options: NotificationOptions = {
    body: "As notificações estão funcionando neste aparelho.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "teste-notificacoes",
  };
  if (registration) await registration.showNotification("Pelada dos Sub", options);
  else new Notification("Pelada dos Sub", options);
}

export function NotificationSettings() {
  const { state: installState } = usePwaInstall(),
    [permission, setPermission] = useState(currentPermission),
    [message, setMessage] = useState("");
  const installed = installState === "installed";

  async function enable() {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await showActivationNotification();
        setMessage("Notificações ativadas.");
      } else setMessage("A permissão não foi concedida.");
    } catch {
      setMessage("Este navegador não permitiu ativar as notificações.");
    }
  }


  return <section className="panel notification-settings">
    <div><h2>Notificações</h2>
      {!installed && <p>No iPhone, instale o aplicativo na Tela de Início e abra pelo ícone para ativar notificações.</p>}
      {installed && permission === "default" && <p>Ative para receber os lembretes da lista neste aparelho.</p>}
      {installed && permission === "denied" && <p>As notificações estão bloqueadas. Libere em Ajustes → Notificações → Pelada dos Sub.</p>}
      {installed && permission === "granted" && <p>Notificações permitidas neste aparelho.</p>}
      {installed && permission === "unsupported" && <p>Este navegador não oferece notificações para o aplicativo.</p>}
    </div>
    {!installed && <Link to="/instalar">VER COMO INSTALAR</Link>}
    {installed && permission === "default" && <button type="button" onClick={() => void enable()}>ATIVAR NOTIFICAÇÕES</button>}
    {message && <small>{message}</small>}
  </section>;
}
