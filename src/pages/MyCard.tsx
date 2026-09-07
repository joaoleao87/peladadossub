import { useState } from "react";
import { CardPhotoEditor } from "../components/CardPhotoEditor";
import { PlayerCard } from "../components/PlayerCard";
import { ErrorState, Spinner, Toast } from "../components/Ui";
import { useAuth } from "../auth/AuthContext";
import { useLoad } from "../hooks/useLoad";
import { myPlayerCard, saveOwnPlayerCardPhoto, uploadPlayerCardPhoto } from "../lib/api";
import type { PlayerCardData } from "../lib/database.types";
import { downloadPlayerCard, playerCardStatus, renderPlayerCardPng } from "../lib/playerCard";
import "./my-card.css";

export function MyCard() {
  const { profile } = useAuth(), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [toast, setToast] = useState("");
  const state = useLoad(myPlayerCard);
  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorState message="Não foi possível carregar sua cartinha." retry={state.reload} />;
  const { player, card } = state.data!;
  if (!player) return <section className="my-card-page"><p className="eyebrow">MINHA CARTINHA</p><h1>Minha cartinha</h1><div className="card-empty"><h2>Jogador não encontrado</h2><p>Sua conta precisa estar vinculada a um jogador.</p></div></section>;
  const currentPlayer = player;
  const editableCard: PlayerCardData = card || { player_id: currentPlayer.id, display_name: null, position: null, overall: null, pace: null, shooting: null, passing: null, dribbling: null, defending: null, physical: null, card_type: "normal", photo_url: null, photo_scale: 1, photo_position_x: 0, photo_position_y: 0, resolved_photo_url: null };
  const ready = playerCardStatus(card) === "ready";
  function feedback(message: string) { setToast(message); setTimeout(() => setToast(""), 3500); }
  async function download() {
    if (!card) return;
    setBusy(true);
    try { downloadPlayerCard(await renderPlayerCardPng(card), card.display_name || currentPlayer.nome); }
    catch { feedback("Não foi possível baixar a cartinha."); }
    finally { setBusy(false); }
  }
  return <section className="my-card-page">
    <p className="eyebrow">MINHA CARTINHA</p>
    <h1>Minha cartinha</h1>
    <p className="my-card-subtitle">Sua identidade na Pelada dos Sub</p>
    {ready && card ? <PlayerCard player={card} /> : <div className="card-empty">
      {(card?.resolved_photo_url || profile?.foto_url) && <img className="card-empty-photo" src={card?.resolved_photo_url || profile?.foto_url || ""} alt="Foto do jogador" />}
      <h2>Sua cartinha ainda não está pronta</h2>
      <p>A diretoria ainda está configurando seus atributos.</p>
    </div>}
    <div className="my-card-actions">
      <button type="button" className="secondary" onClick={() => setEditing(true)}>ALTERAR FOTO</button>
      <button type="button" disabled={!ready || busy} onClick={() => void download()}>{busy ? "GERANDO…" : "BAIXAR CARTINHA"}</button>
    </div>
    {card?.photo_url && <button type="button" className="link" onClick={() => setEditing(true)}>REDEFINIR ENQUADRAMENTO</button>}
    {editing && <CardPhotoEditor card={editableCard} onCancel={() => setEditing(false)} onConfirm={async (file, framing) => {
      const path = file ? await uploadPlayerCardPhoto(currentPlayer.id, file) : editableCard.photo_url;
      if (!path) throw new Error("Selecione uma foto.");
      await saveOwnPlayerCardPhoto(path, framing.scale, framing.x, framing.y);
      setEditing(false); feedback("Foto atualizada com sucesso."); await state.reload();
    }} />}
    <Toast message={toast} />
  </section>;
}
