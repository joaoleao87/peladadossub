import type { PlayerCardData, PlayerCardType } from "./database.types";

export const CARD_TEMPLATES: Record<PlayerCardType, string> = {
  normal: "/cards/carta-normal.png",
  legendary: "/cards/carta-lendaria.png",
};

export const CARD_POSITIONS = ["GOL", "FIXO", "ALA", "PIVO"] as const;

export const CARD_LAYOUTS = {
  normal: { aspectRatio: 1060 / 1484, color: "#261805", photo: { left: 17, top: 19, width: 68, height: 45 } },
  legendary: { aspectRatio: 1024 / 1536, color: "#281806", photo: { left: 16, top: 18, width: 70, height: 45 } },
} as const;

export const CARD_STATS = [
  ["pace", "RIT"], ["shooting", "FIN"], ["passing", "PAS"],
  ["dribbling", "DRI"], ["defending", "DEF"], ["physical", "FÍS"],
] as const;

export function playerCardStatus(card?: PlayerCardData | null) {
  if (!card || [card.display_name, card.position, card.overall, card.pace, card.shooting, card.passing, card.dribbling, card.defending, card.physical].every(value => value == null || value === "")) return "not_configured" as const;
  if ([card.display_name, card.position, card.overall, card.pace, card.shooting, card.passing, card.dribbling, card.defending, card.physical].some(value => value == null || value === "")) return "incomplete" as const;
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
  if (card.resolved_photo_url) {
    const photo = await loadImage(card.resolved_photo_url);
    const area = { x: width * layout.photo.left / 100, y: height * layout.photo.top / 100, w: width * layout.photo.width / 100, h: height * layout.photo.height / 100 },
      fit = Math.min(area.w / photo.naturalWidth, area.h / photo.naturalHeight),
      scale = Number(card.photo_scale), drawW = photo.naturalWidth * fit * scale, drawH = photo.naturalHeight * fit * scale,
      photoCanvas = document.createElement("canvas"), photoContext = photoCanvas.getContext("2d");
    photoCanvas.width = width; photoCanvas.height = height;
    if (!photoContext) throw new Error("Não foi possível compor a foto.");
    photoContext.save();
    const gradient = photoContext.createLinearGradient(0, area.y, 0, area.y + area.h);
    gradient.addColorStop(0, "#000");
    gradient.addColorStop(.78, "#000");
    gradient.addColorStop(1, "transparent");
    photoContext.beginPath(); photoContext.rect(area.x, area.y, area.w, area.h); photoContext.clip();
    photoContext.drawImage(photo, area.x + (area.w - drawW) / 2 + area.w * Number(card.photo_position_x) / 100, area.y + (area.h - drawH) / 2 + area.h * Number(card.photo_position_y) / 100, drawW, drawH);
    photoContext.globalCompositeOperation = "destination-in";
    photoContext.fillStyle = gradient;
    photoContext.fillRect(area.x, area.y, area.w, area.h);
    photoContext.restore();
    context.save();
    context.globalCompositeOperation = "multiply"; context.globalAlpha = .96;
    context.drawImage(photoCanvas, 0, 0);
    context.restore();
  }
  context.fillStyle = layout.color;
  context.textAlign = "center";
  context.font = `900 ${Math.round(width * .09)}px Impact, sans-serif`;
  context.fillText(String(card.overall), width * .22, height * .18);
  context.font = `800 ${Math.round(width * .035)}px Arial, sans-serif`;
  context.fillText(card.position!, width * .22, height * .215);
  context.font = `900 ${Math.round(width * .052)}px Impact, sans-serif`;
  context.fillText(card.display_name!.toUpperCase(), width * .5, height * .655);
  context.font = `800 ${Math.round(width * .032)}px Arial, sans-serif`;
  CARD_STATS.forEach(([key, label], index) => {
    const column = index < 3 ? .35 : .65, row = index % 3;
    context.fillText(`${card[key]} ${label}`, width * column, height * (.715 + row * .045));
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
