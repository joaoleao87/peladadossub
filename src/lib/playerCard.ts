import type { PlayerCardData, PlayerCardType } from "./database.types";

export const CARD_TEMPLATES: Record<PlayerCardType, string> = {
  normal: "/cards/carta-normal.png",
  legendary: "/cards/carta-lendaria.png",
};

export const CARD_TEAM_LOGO = "/cards/logo-time-sub.png";

export const CARD_POSITIONS = ["GOL", "FIXO", "ALA", "PIVO"] as const;

export const CARD_LAYOUTS = {
  normal: { aspectRatio: 1060 / 1484, color: "#261805", photo: { left: 32, top: 20, width: 53, height: 36 } },
  legendary: { aspectRatio: 1024 / 1536, color: "#281806", photo: { left: 32, top: 20, width: 53, height: 36 } },
} as const;

export const CARD_STATS = [
  ["pace", "RIT"], ["shooting", "FIN"], ["passing", "PAS"],
  ["dribbling", "DRI"], ["defending", "DEF"], ["physical", "FÍS"],
] as const;

export const GOALKEEPER_CARD_STATS = [
  ["pace", "DIV"], ["shooting", "HAN"], ["passing", "KIC"],
  ["dribbling", "REF"], ["defending", "SPE"], ["physical", "POS"],
] as const;

const POSITION_WEIGHTS = {
  GOL: [0.21, 0.21, 0.10, 0.24, 0.08, 0.16],
  FIXO: [0.10, 0.05, 0.15, 0.10, 0.35, 0.25],
  ALA: [0.22, 0.15, 0.18, 0.22, 0.08, 0.15],
  PIVO: [0.15, 0.30, 0.13, 0.20, 0.05, 0.17],
} as const;

export function cardStats(position: PlayerCardData["position"]) {
  return position === "GOL" ? GOALKEEPER_CARD_STATS : CARD_STATS;
}

export function calculatePlayerCardOverall(card: Pick<PlayerCardData, "position" | "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical">) {
  if (!card.position) return null;
  const values = [card.pace, card.shooting, card.passing, card.dribbling, card.defending, card.physical];
  if (values.some(value => value == null)) return null;
  const weights = POSITION_WEIGHTS[card.position];
  const numericValues = values.map(Number);
  return Math.max(1, Math.min(99, Math.round(numericValues.reduce((total, value, index) => total + value * weights[index], 0))));
}

export function playerCardStatus(card?: PlayerCardData | null) {
  if (!card || [card.display_name, card.position, card.pace, card.shooting, card.passing, card.dribbling, card.defending, card.physical].every(value => value == null || value === "")) return "not_configured" as const;
  if ([card.display_name, card.position, card.pace, card.shooting, card.passing, card.dribbling, card.defending, card.physical].some(value => value == null || value === "")) return "incomplete" as const;
  return "ready" as const;
}

export const PLAYER_CARD_STATUS_LABEL = {
  not_configured: "NÃO CONFIGURADA",
  incomplete: "INCOMPLETA",
  ready: "PRONTA",
} as const;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar uma imagem da cartinha."));
    image.src = src;
  });
}

export async function renderPlayerCardPng(card: PlayerCardData) {
  if (playerCardStatus(card) !== "ready") throw new Error("Sua cartinha ainda não está pronta.");
  const type = card.card_type, template = await loadImage(CARD_TEMPLATES[type]);
  const canvas = document.createElement("canvas");
  canvas.width = template.naturalWidth;
  canvas.height = template.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível gerar a cartinha.");
  const layout = CARD_LAYOUTS[type], width = canvas.width, height = canvas.height;
  context.drawImage(template, 0, 0, width, height);
  const teamLogoPromise = loadImage(CARD_TEAM_LOGO);
  if (card.resolved_photo_url) {
    const photo = await loadImage(card.resolved_photo_url);
    const area = { x: width * layout.photo.left / 100, y: height * layout.photo.top / 100, w: width * layout.photo.width / 100, h: height * layout.photo.height / 100 },
      fit = Math.min(area.w / photo.naturalWidth, area.h / photo.naturalHeight),
      scale = Number(card.photo_scale), drawW = photo.naturalWidth * fit * scale, drawH = photo.naturalHeight * fit * scale,
      photoCanvas = document.createElement("canvas"), photoContext = photoCanvas.getContext("2d");
    photoCanvas.width = width; photoCanvas.height = height;
    if (!photoContext) throw new Error("Não foi possível compor a foto.");
    photoContext.save();
    const x = area.x, y = area.y, w = area.w, h = area.h;
    photoContext.beginPath();
    photoContext.moveTo(x + w * .14, y + h * .05);
    photoContext.quadraticCurveTo(x + w * .1, y + h * .06, x + w * .07, y + h * .11);
    photoContext.lineTo(x + w * .02, y + h * .2);
    photoContext.quadraticCurveTo(x + w * .01, y + h * .22, x + w * .01, y + h * .27);
    photoContext.lineTo(x + w * .01, y + h * .91);
    photoContext.quadraticCurveTo(x + w * .01, y + h * .98, x + w * .09, y + h * .98);
    photoContext.lineTo(x + w * .91, y + h * .98);
    photoContext.quadraticCurveTo(x + w * .99, y + h * .98, x + w * .99, y + h * .9);
    photoContext.lineTo(x + w * .99, y + h * .07);
    photoContext.quadraticCurveTo(x + w * .99, y + h * .02, x + w * .94, y + h * .02);
    photoContext.lineTo(x + w * .22, y + h * .02);
    photoContext.quadraticCurveTo(x + w * .18, y + h * .02, x + w * .14, y + h * .05);
    photoContext.closePath();
    photoContext.clip();
    photoContext.fillStyle = "#171914";
    photoContext.fillRect(area.x, area.y, area.w, area.h);
    photoContext.drawImage(photo, area.x + (area.w - drawW) / 2 + area.w * Number(card.photo_position_x) / 100, area.y + (area.h - drawH) / 2 + area.h * Number(card.photo_position_y) / 100, drawW, drawH);
    photoContext.restore();
    context.drawImage(photoCanvas, 0, 0);
    context.save();
    context.beginPath();
    context.moveTo(x + w * .14, y + h * .05);
    context.quadraticCurveTo(x + w * .1, y + h * .06, x + w * .07, y + h * .11);
    context.lineTo(x + w * .02, y + h * .2);
    context.quadraticCurveTo(x + w * .01, y + h * .22, x + w * .01, y + h * .27);
    context.lineTo(x + w * .01, y + h * .91);
    context.quadraticCurveTo(x + w * .01, y + h * .98, x + w * .09, y + h * .98);
    context.lineTo(x + w * .91, y + h * .98);
    context.quadraticCurveTo(x + w * .99, y + h * .98, x + w * .99, y + h * .9);
    context.lineTo(x + w * .99, y + h * .07);
    context.quadraticCurveTo(x + w * .99, y + h * .02, x + w * .94, y + h * .02);
    context.lineTo(x + w * .22, y + h * .02);
    context.quadraticCurveTo(x + w * .18, y + h * .02, x + w * .14, y + h * .05);
    context.closePath();
    context.strokeStyle = "#6d4208";
    context.lineWidth = width * .009;
    context.stroke();
    context.strokeStyle = "#efc75e";
    context.lineWidth = width * .004;
    context.stroke();
    context.restore();
  }
  context.fillStyle = layout.color;
  context.textAlign = "center";
  context.font = `900 ${Math.round(width * .09)}px Impact, sans-serif`;
  context.fillText(String(calculatePlayerCardOverall(card)), width * .22, height * .285);
  context.font = `800 ${Math.round(width * .035)}px Arial, sans-serif`;
  context.fillText(card.position!, width * .22, height * .322);
  const flagX = width * .18, flagY = height * .34, flagW = width * .09, flagH = height * .037;
  context.fillStyle = "#199447";
  context.fillRect(flagX, flagY, flagW, flagH);
  context.fillStyle = "#f7d117";
  context.beginPath();
  context.moveTo(flagX + flagW * .5, flagY + flagH * .1);
  context.lineTo(flagX + flagW * .9, flagY + flagH * .5);
  context.lineTo(flagX + flagW * .5, flagY + flagH * .9);
  context.lineTo(flagX + flagW * .1, flagY + flagH * .5);
  context.closePath();
  context.fill();
  context.fillStyle = "#244ca5";
  context.beginPath();
  context.arc(flagX + flagW * .5, flagY + flagH * .5, flagH * .22, 0, Math.PI * 2);
  context.fill();
  const teamLogo = await teamLogoPromise, logoW = width * .095, logoH = logoW * teamLogo.naturalHeight / teamLogo.naturalWidth;
  context.drawImage(teamLogo, width * .225 - logoW / 2, height * .39, logoW, logoH);
  context.fillStyle = layout.color;
  context.font = `900 ${Math.round(width * .065)}px Impact, sans-serif`;
  context.fillText(card.display_name!.toUpperCase(), width * .5, height * .595);
  context.font = `800 ${Math.round(width * .041)}px Arial, sans-serif`;
  cardStats(card.position).forEach(([key, label], index) => {
    const column = index < 3 ? .35 : .65, row = index % 3;
    context.fillText(`${card[key]} ${label}`, width * column, height * (.65 + row * .042));
  });
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível exportar a cartinha.")), "image/png"));
}

export function downloadPlayerCard(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cartinha-${name.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}.png`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
