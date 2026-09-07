import { useEffect, useState } from "react";
import type { PlayerCardData } from "../lib/database.types";
import { PlayerCard } from "./PlayerCard";

type Framing = { scale: number; x: number; y: number };
type Props = {
  card: PlayerCardData;
  onCancel: () => void;
  onConfirm: (file: File | null, framing: Framing) => Promise<void>;
};

export function CardPhotoEditor({ card, onCancel, onConfirm }: Props) {
  const [source, setSource] = useState(card.resolved_photo_url || ""),
    [file, setFile] = useState<File | null>(null),
    [framing, setFraming] = useState<Framing>({ scale: Number(card.photo_scale), x: Number(card.photo_position_x), y: Number(card.photo_position_y) }),
    [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => () => { if (source.startsWith("blob:")) URL.revokeObjectURL(source); }, [source]);
  const preview = { ...card, resolved_photo_url: source, photo_scale: framing.scale, photo_position_x: framing.x, photo_position_y: framing.y };
  function choose(next: File | undefined) {
    if (!next) return;
    if (next.size > 5 * 1024 * 1024) { setError("A foto deve ter até 5 MB."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setError("Use uma imagem JPG, PNG ou WEBP."); return; }
    if (source.startsWith("blob:")) URL.revokeObjectURL(source);
    setFile(next); setSource(URL.createObjectURL(next)); setError("");
  }
  async function save() {
    if (!source) { setError("Selecione uma foto."); return; }
    setBusy(true); setError("");
    try { await onConfirm(file, framing); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a foto."); }
    finally { setBusy(false); }
  }
  return <div className="card-photo-modal" role="dialog" aria-modal="true" aria-labelledby="card-photo-title"><section>
    <header><h2 id="card-photo-title">Ajustar foto</h2><button type="button" className="secondary mini" onClick={onCancel}>FECHAR</button></header>
    <PlayerCard player={preview} mode="admin" />
    <label className="card-photo-file">ESCOLHER FOTO<input type="file" accept="image/jpeg,image/png,image/webp" onClick={event => { event.currentTarget.value = ""; }} onChange={event => choose(event.target.files?.[0])} /></label>
    <div className="card-photo-controls">
      <label>Zoom <input type="range" min=".5" max="3" step=".01" value={framing.scale} onChange={event => setFraming(old => ({ ...old, scale: Number(event.target.value) }))} /></label>
      <label>Horizontal <input type="range" min="-40" max="40" step="1" value={framing.x} onChange={event => setFraming(old => ({ ...old, x: Number(event.target.value) }))} /></label>
      <label>Vertical <input type="range" min="-40" max="40" step="1" value={framing.y} onChange={event => setFraming(old => ({ ...old, y: Number(event.target.value) }))} /></label>
    </div>
    <button type="button" className="secondary full" onClick={() => setFraming({ scale: 1, x: 0, y: 0 })}>REDEFINIR ENQUADRAMENTO</button>
    {error && <p className="card-photo-error">{error}</p>}
    <footer><button type="button" className="secondary" disabled={busy} onClick={onCancel}>CANCELAR</button><button type="button" disabled={busy} onClick={() => void save()}>{busy ? "SALVANDO…" : "CONFIRMAR"}</button></footer>
  </section></div>;
}
