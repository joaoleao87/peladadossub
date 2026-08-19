import { useEffect, useRef, useState } from "react";
import { CROP_SIZE, cropGeometry } from "../lib/imageCrop";

type Props = { src: string; onCancel: () => void; onConfirm: (file: File) => void };

export function AvatarCropper({ src, onCancel, onConfirm }: Props) {
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 }),
    [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState({ x: 0, y: 0 }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null),
    geometry = cropGeometry(dimensions.width, dimensions.height, zoom, offset.x, offset.y);

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = src;
  }, [src]);

  function move(x: number, y: number) {
    if (!drag.current) return;
    const next = cropGeometry(dimensions.width, dimensions.height, zoom, drag.current.left + x - drag.current.x, drag.current.top + y - drag.current.y);
    setOffset({ x: next.offsetX, y: next.offsetY });
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Não foi possível carregar a foto."));
        image.src = src;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Editor de imagem indisponível.");
      context.drawImage(image, geometry.sourceX, geometry.sourceY, geometry.sourceSize, geometry.sourceSize, 0, 0, 512, 512);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível cortar a foto.")), "image/jpeg", 0.9));
      onConfirm(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ajustar a foto.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="crop-modal" role="dialog" aria-modal="true" aria-labelledby="crop-title">
    <section>
      <header><h2 id="crop-title">Ajustar foto</h2><button type="button" className="crop-close" aria-label="Fechar editor" onClick={onCancel}>×</button></header>
      <div className="crop-stage" style={{ width: CROP_SIZE, height: CROP_SIZE }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, left: geometry.offsetX, top: geometry.offsetY }; }} onPointerMove={(event) => move(event.clientX, event.clientY)} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <img src={src} crossOrigin="anonymous" alt="Prévia do corte" draggable={false} style={{ width: dimensions.width * geometry.base, height: dimensions.height * geometry.base, transform: `translate(${geometry.offsetX}px,${geometry.offsetY}px) scale(${zoom})` }} /><span />
      </div>
      <small>Arraste a foto para posicionar</small>
      <label className="crop-zoom">Zoom<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => { const value = Number(event.target.value), next = cropGeometry(dimensions.width, dimensions.height, value, offset.x, offset.y); setZoom(value); setOffset({ x: next.offsetX, y: next.offsetY }); }} /></label>
      {error && <p className="crop-error">{error}</p>}
      <footer><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "AJUSTANDO…" : "USAR FOTO"}</button></footer>
    </section>
  </div>;
}
