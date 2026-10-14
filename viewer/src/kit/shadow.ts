import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Vec2 } from './iso.ts';

export function canvasShadow(outline: readonly Vec2[], blur: number, color: string, pixelsPerUnit = 24) {
  const xs = outline.map(([x]) => x);
  const zs = outline.map(([, z]) => z);
  const margin = blur * 3;
  const minX = Math.min(...xs) - margin;
  const minZ = Math.min(...zs) - margin;
  const size: Vec2 = [Math.max(...xs) + margin - minX, Math.max(...zs) + margin - minZ];
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size[0] * pixelsPerUnit);
  canvas.height = Math.ceil(size[1] * pixelsPerUnit);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is not available');
  context.filter = `blur(${blur * pixelsPerUnit}px)`;
  context.fillStyle = color;
  context.beginPath();
  outline.forEach(([x, z], i) => {
    const px = (x - minX) * pixelsPerUnit;
    const py = (z - minZ) * pixelsPerUnit;
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  });
  context.closePath();
  context.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { texture, center: [minX + size[0] / 2, minZ + size[1] / 2] as Vec2, size };
}
