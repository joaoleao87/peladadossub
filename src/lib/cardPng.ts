import type { MatchCard, Pelada } from "./database.types";
import { matchCardImageUrl } from "./api";

const WIDTH = 1080, HEIGHT = 1350, YELLOW = "#ffd500", DARK = "#090a08";
function canvas() { const value = document.createElement("canvas"); value.width = WIDTH; value.height = HEIGHT; return value; }
async function loadImage(url: string) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("Não foi possível carregar uma imagem do card.");
  const objectUrl = URL.createObjectURL(await response.blob());
  try { return await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Não foi possível processar uma imagem do card.")); image.src = objectUrl; }); }
  finally { URL.revokeObjectURL(objectUrl); }
}
function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x = 0, y = 0, width = WIDTH, height = HEIGHT) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight), drawWidth = image.naturalWidth * scale, drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = "#fff", weight = 800, maxWidth = WIDTH - x * 2) { ctx.fillStyle = color; ctx.font = `${weight} ${size}px Arial, sans-serif`; ctx.fillText(value, x, y, maxWidth); }
function gameLabel(game?: Pelada) { return game ? `${new Date(`${game.data}T12:00`).toLocaleDateString("pt-BR")} • ${game.local}` : ""; }
function blob(value: HTMLCanvasElement) { return new Promise<Blob>((resolve, reject) => value.toBlob(result => result ? resolve(result) : reject(new Error("Não foi possível gerar o PNG.")), "image/png")); }

export async function renderMatchCardPng(card: MatchCard, game?: Pelada) {
  if (card.imagem_path) { const result = canvas(), ctx = result.getContext("2d")!; cover(ctx, await loadImage(matchCardImageUrl(card.imagem_path))); return blob(result); }
  const result = canvas(), ctx = result.getContext("2d")!; ctx.fillStyle = DARK; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const photos = card.categoria === "time_destaque" ? card.snapshot_membros.map(member => member.foto_url) : [card.snapshot_foto_url];
  const loaded = await Promise.all(photos.filter((url): url is string => Boolean(url)).map(url => loadImage(url).catch(() => null)));
  if (card.categoria === "time_destaque" && loaded.length) { const tileWidth = WIDTH / 2, tileHeight = 820 / Math.ceil(loaded.length / 2); loaded.forEach((image, index) => image && cover(ctx, image, index % 2 * tileWidth, Math.floor(index / 2) * tileHeight, tileWidth, tileHeight)); }
  else if (loaded[0]) cover(ctx, loaded[0]);
  const gradient = ctx.createLinearGradient(0, 420, 0, HEIGHT); gradient.addColorStop(0, "rgba(9,10,8,0)"); gradient.addColorStop(.45, "rgba(9,10,8,.86)"); gradient.addColorStop(1, DARK); ctx.fillStyle = gradient; ctx.fillRect(0, 350, WIDTH, 1000);
  ctx.strokeStyle = YELLOW; ctx.lineWidth = 14; ctx.strokeRect(7, 7, WIDTH - 14, HEIGHT - 14);
  text(ctx, "PELADA DOS SUB", 72, 930, 34, "#fff", 700); text(ctx, card.titulo.toUpperCase(), 72, 1035, 82, YELLOW); text(ctx, card.snapshot_nome, 72, 1120, card.categoria === "time_destaque" ? 43 : 58);
  const detail = card.snapshot_time || "Companheiros não informados"; text(ctx, card.categoria === "time_destaque" ? detail : `${detail} • ${card.snapshot_gols} ${card.snapshot_gols === 1 ? "gol" : "gols"}`, 72, 1190, 28, "#ddd", 600); if ((card.snapshot_vitorias ?? 0) > 0) text(ctx, `${card.snapshot_vitorias} ${card.snapshot_vitorias === 1 ? "VITÓRIA" : "VITÓRIAS"}`, 72, 1240, 30, YELLOW, 800); text(ctx, gameLabel(game), 72, 1290, 25, "#aaa", 600);
  return blob(result);
}
export async function renderInstagramCover(game?: Pelada) {
  const result = canvas(), ctx = result.getContext("2d")!; ctx.fillStyle = DARK; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.fillStyle = YELLOW; ctx.fillRect(0, 0, WIDTH, 24); ctx.fillRect(0, HEIGHT - 24, WIDTH, 24);
  text(ctx, "PELADA DOS SUB", 72, 150, 38, YELLOW); text(ctx, "DESTAQUES", 72, 310, 112); text(ctx, "DA PELADA", 72, 415, 112, YELLOW); ctx.strokeStyle = "#393b34"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(72, 485); ctx.lineTo(1008, 485); ctx.stroke();
  const logo = await loadImage("/logo.png");
  const logoWidth = 520, logoHeight = logo.naturalHeight * (logoWidth / logo.naturalWidth);
  ctx.drawImage(logo, (WIDTH - logoWidth) / 2, 540, logoWidth, logoHeight);
  text(ctx, gameLabel(game), 72, 1180, 42, "#bbb", 700); return blob(result);
}
export function downloadBlob(value: Blob, filename: string) { const url = URL.createObjectURL(value), anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function cardFilename(card: MatchCard) { return `${card.categoria}-${card.snapshot_nome}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() + ".png"; }
