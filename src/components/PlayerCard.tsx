import type { CSSProperties } from "react";
import type { PlayerCardData, PlayerCardType } from "../lib/database.types";
import { calculatePlayerCardOverall, CARD_LAYOUTS, cardStats, CARD_TEMPLATES } from "../lib/playerCard";
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
  const overall = calculatePlayerCardOverall(player);
  return <article className={`player-card player-card--${cardType} ${className}`} style={{ aspectRatio: layout.aspectRatio, color: layout.color }} aria-label={`Cartinha de ${player.display_name || "jogador"}`}>
    <img className="player-card__template" src={CARD_TEMPLATES[cardType]} alt="" />
    <div className="player-card__photo" style={photoStyle}>
      {player.resolved_photo_url && <img src={player.resolved_photo_url} crossOrigin="anonymous" alt="" />}
      <svg className="player-card__photo-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="player-card__photo-frame-outer" d="M14 5 Q10 6 7 11 L2 20 Q1 22 1 27 L1 91 Q1 98 9 98 L91 98 Q99 98 99 90 L99 7 Q99 2 94 2 L22 2 Q18 2 14 5Z" />
        <path className="player-card__photo-frame-inner" d="M15 7 Q11 8 9 12 L4 21 Q3 23 3 28 L3 89 Q3 95 10 95 L90 95 Q96 95 96 89 L96 8 Q96 5 93 5 L23 5 Q19 5 15 7Z" />
      </svg>
    </div>
    <div className="player-card__rating"><strong>{value(overall)}</strong><span>{player.position || (mode === "admin" ? "POS" : "")}</span></div>
    <div className="player-card__identity" aria-label="Brasil, Pelada dos Sub">
      <span className="player-card__flag" aria-hidden="true"><i /></span>
      <img src="/cards/logo-time-sub.png" alt="" />
    </div>
    <strong className="player-card__name">{player.display_name || (mode === "admin" ? "NOME DO JOGADOR" : "")}</strong>
    <div className="player-card__stats">
      {cardStats(player.position).map(([key, label]) => <span key={key}><b>{value(player[key])}</b> {label}</span>)}
    </div>
  </article>;
}
