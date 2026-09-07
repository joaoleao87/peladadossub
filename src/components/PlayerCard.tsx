import type { CSSProperties } from "react";
import type { PlayerCardData, PlayerCardType } from "../lib/database.types";
import { CARD_LAYOUTS, CARD_STATS, CARD_TEMPLATES } from "../lib/playerCard";
import "./player-card.css";

type Props = {
  player: PlayerCardData;
  cardType?: PlayerCardType;
  mode?: "player" | "admin";
  className?: string;
};

export function PlayerCard({ player, cardType = player.card_type, mode = "player", className = "" }: Props) {
  const layout = CARD_LAYOUTS[cardType], photoStyle = {
    "--photo-scale": player.photo_scale,
    "--photo-x": `${player.photo_position_x}%`,
    "--photo-y": `${player.photo_position_y}%`,
    left: `${layout.photo.left}%`,
    top: `${layout.photo.top}%`,
    width: `${layout.photo.width}%`,
    height: `${layout.photo.height}%`,
  } as CSSProperties;
  const value = (entry: number | null) => entry ?? (mode === "admin" ? "—" : "");
  return <article className={`player-card player-card--${cardType} ${className}`} style={{ aspectRatio: layout.aspectRatio, color: layout.color }} aria-label={`Cartinha de ${player.display_name || "jogador"}`}>
    <img className="player-card__template" src={CARD_TEMPLATES[cardType]} alt="" />
    <div className="player-card__photo" style={photoStyle}>
      {player.resolved_photo_url && <img src={player.resolved_photo_url} crossOrigin="anonymous" alt="" />}
    </div>
    <div className="player-card__rating"><strong>{value(player.overall)}</strong><span>{player.position || (mode === "admin" ? "POS" : "")}</span></div>
    <strong className="player-card__name">{player.display_name || (mode === "admin" ? "NOME DO JOGADOR" : "")}</strong>
    <div className="player-card__stats">
      {CARD_STATS.map(([key, label]) => <span key={key}><b>{value(player[key])}</b> {label}</span>)}
    </div>
  </article>;
}
