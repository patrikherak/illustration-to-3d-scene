import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

export interface TextureSet {
  map: CanvasTexture;
  normalMap: CanvasTexture;
  roughnessMap: CanvasTexture;
}

export interface Sample {
  shade: number;
  height: number;
  roughness: number;
}

export type Sampler = (u: number, v: number) => Sample;

export function hash(ix: number, iy: number, seed: number): number {
  const value = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function wrap(value: number, period: number): number {
  return ((value % period) + period) % period;
}

export function valueNoise(u: number, v: number, cells: number, seed: number): number {
  const gx = u * cells;
  const gy = v * cells;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const x0 = wrap(ix, cells);
  const x1 = wrap(ix + 1, cells);
  const y0 = wrap(iy, cells);
  const y1 = wrap(iy + 1, cells);
  const a = hash(x0, y0, seed);
  const b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed);
  const d = hash(x1, y1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

export function fractalNoise(u: number, v: number, cells: number, octaves: number, seed: number): number {
  let total = 0;
  let weight = 0;
  let amplitude = 1;
  for (let octave = 0; octave < octaves; octave++) {
    total += amplitude * valueNoise(u, v, cells * 2 ** octave, seed + octave);
    weight += amplitude;
    amplitude *= 0.5;
  }
  return total / weight;
}

function encodeSrgb(linear: number): number {
  const c = Math.min(1, Math.max(0, linear));
  return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
}

function canvasOf(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is not available');
  return { canvas, context };
}

function finish(canvas: HTMLCanvasElement, srgb: boolean): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

export type Decorate = (context: CanvasRenderingContext2D, layer: 'map' | 'roughness', size: number) => void;

export function bakeTexture(size: number, sampler: Sampler, bump = 1, decorate?: Decorate): TextureSet {
  const heights = new Float32Array(size * size);
  const color = canvasOf(size);
  const rough = canvasOf(size);
  const normal = canvasOf(size);
  const colorPixels = color.context.createImageData(size, size);
  const roughPixels = rough.context.createImageData(size, size);
  const normalPixels = normal.context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sample = sampler(x / size, y / size);
      const i = y * size + x;
      const shade = encodeSrgb(sample.shade);
      colorPixels.data.set([shade, shade, shade, 255], i * 4);
      const roughness = Math.round(Math.min(1, Math.max(0, sample.roughness)) * 255);
      roughPixels.data.set([roughness, roughness, roughness, 255], i * 4);
      heights[i] = sample.height;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = (dx: number, dy: number) => heights[((y + dy + size) % size) * size + ((x + dx + size) % size)];
      const nx = (at(-1, 0) - at(1, 0)) * bump * size * 0.05;
      const ny = (at(0, 1) - at(0, -1)) * bump * size * 0.05;
      const length = Math.hypot(nx, ny, 1);
      normalPixels.data.set([((nx / length) * 0.5 + 0.5) * 255, ((ny / length) * 0.5 + 0.5) * 255, ((1 / length) * 0.5 + 0.5) * 255, 255], (y * size + x) * 4);
    }
  }
  color.context.putImageData(colorPixels, 0, 0);
  rough.context.putImageData(roughPixels, 0, 0);
  normal.context.putImageData(normalPixels, 0, 0);
  decorate?.(color.context, 'map', size);
  decorate?.(rough.context, 'roughness', size);
  return { map: finish(color.canvas, true), normalMap: finish(normal.canvas, false), roughnessMap: finish(rough.canvas, false) };
}

const cache = new Map<string, TextureSet>();

function cached(key: string, make: () => TextureSet): TextureSet {
  const hit = cache.get(key);
  if (hit) return hit;
  const made = make();
  cache.set(key, made);
  return made;
}

export interface NoiseOptions {
  size?: number;
  cells?: number;
  octaves?: number;
  amplitude?: number;
  sparkle?: number;
  roughness?: number;
  bump?: number;
  seed?: number;
}

export function noiseTexture({ size = 256, cells = 4, octaves = 5, amplitude = 0.08, sparkle = 0, roughness = 0.9, bump = 1, seed = 1 }: NoiseOptions = {}): TextureSet {
  return cached(`noise:${size}:${cells}:${octaves}:${amplitude}:${sparkle}:${roughness}:${bump}:${seed}`, () =>
    bakeTexture(
      size,
      (u, v) => {
        const drift = fractalNoise(u, v, cells, octaves, seed) - 0.5;
        const glint = sparkle && valueNoise(u, v, 96, seed + 21) > 0.9 ? 1 : 0;
        return { shade: 0.93 + amplitude * drift + sparkle * glint, height: drift, roughness: roughness - 0.55 * glint };
      },
      bump,
    ),
  );
}

export function woodTexture({ size = 256, planks = 8, seed = 5 }: { size?: number; planks?: number; seed?: number } = {}): TextureSet {
  return cached(`wood:${size}:${planks}:${seed}`, () =>
    bakeTexture(
      size,
      (u, v) => {
        const index = Math.floor(v * planks);
        const frac = v * planks - index;
        const jitter = 0.86 + 0.12 * hash(index, 3, seed);
        const grain = 1 + 0.07 * Math.sin(u * Math.PI * 2 * 9 + 6 * fractalNoise(u, v * 6, 4, 2, seed + index));
        const seam = Math.exp(-((Math.min(frac, 1 - frac) / 0.06) ** 2));
        return { shade: jitter * grain * (1 - 0.35 * seam), height: -seam, roughness: 0.75 };
      },
      2,
    ),
  );
}

export function shingleTexture({ size = 256, rows = 8, columns = 6, seed = 7 }: { size?: number; rows?: number; columns?: number; seed?: number } = {}): TextureSet {
  return cached(`shingle:${size}:${rows}:${columns}:${seed}`, () =>
    bakeTexture(
      size,
      (u, v) => {
        const row = Math.floor(v * rows);
        const shifted = u * columns + (row % 2) * 0.5;
        const column = Math.floor(shifted);
        const fracV = v * rows - row;
        const fracU = shifted - column;
        const jitter = 0.84 + 0.18 * hash(column, row, seed);
        const overlap = 0.76 + 0.24 * Math.min(1, (1 - fracV) * 1.6);
        const gap = Math.exp(-((Math.min(fracU, 1 - fracU) / 0.05) ** 2));
        return { shade: jitter * overlap * (1 - 0.3 * gap), height: 1 - fracV - gap * 0.4, roughness: 0.7 };
      },
      1.4,
    ),
  );
}

export function rockTexture({ size = 256, seed = 3 }: { size?: number; seed?: number } = {}): TextureSet {
  return cached(`rock:${size}:${seed}`, () =>
    bakeTexture(
      size,
      (u, v) => {
        const strata = Math.sin(v * Math.PI * 2 * 6 + 2.5 * fractalNoise(u, v, 3, 2, seed)) * 0.06;
        const grit = fractalNoise(u, v, 8, 4, seed + 1) - 0.5;
        return { shade: 0.9 + strata + 0.14 * grit, height: strata + grit * 0.6, roughness: 0.95 };
      },
      2.5,
    ),
  );
}

export function barkTexture({ size = 128, seed = 9 }: { size?: number; seed?: number } = {}): TextureSet {
  return cached(`bark:${size}:${seed}`, () =>
    bakeTexture(
      size,
      (u, v) => {
        const furrow = fractalNoise(u * 4, v * 0.6, 6, 3, seed);
        return { shade: 0.75 + 0.3 * furrow, height: furrow, roughness: 0.95 };
      },
      3,
    ),
  );
}

export function foliageTexture({ size = 256, seed = 14 }: { size?: number; seed?: number } = {}): TextureSet {
  return cached(`foliage:${size}:${seed}`, () =>
    bakeTexture(
      size,
      (u, v) => {
        const row = Math.floor(v * 10);
        const scallop = Math.abs(Math.sin((u * 14 + (row % 2) * 0.5) * Math.PI));
        const cluster = fractalNoise(u, v, 12, 3, seed);
        const shade = 0.62 + 0.28 * cluster + 0.12 * scallop * (v * 10 - row);
        return { shade, height: cluster + 0.4 * scallop, roughness: 0.85 };
      },
      2,
    ),
  );
}

export function iceTexture({ size = 512, cracks = 14, seed = 10 }: { size?: number; cracks?: number; seed?: number } = {}): TextureSet {
  return cached(`ice:${size}:${cracks}:${seed}`, () =>
    bakeTexture(
      size,
      (u, v) => {
        const across = ((((u - v * 0.6) % 0.5) + 0.5) % 0.5) - 0.25;
        const band = Math.exp(-(across * across) / 0.004);
        const cloud = fractalNoise(u, v, 3, 4, seed) - 0.5;
        return { shade: 0.9 + 0.08 * band + 0.06 * cloud, height: cloud * 0.2, roughness: 0.12 + 0.1 * (cloud + 0.5) };
      },
      0.6,
      (context, layer, s) => {
        context.strokeStyle = layer === 'map' ? 'rgba(255,255,255,0.75)' : 'rgba(200,200,200,0.9)';
        context.lineWidth = s / 90;
        for (let i = 0; i < cracks; i++) {
          let x = hash(i, 1, seed) * s;
          let y = hash(i, 2, seed) * s;
          let heading = hash(i, 3, seed) * Math.PI * 2;
          context.beginPath();
          context.moveTo(x, y);
          for (let k = 0; k < 6; k++) {
            heading += (hash(i, 10 + k, seed) - 0.5) * 1.4;
            x += Math.cos(heading) * s * 0.035;
            y += Math.sin(heading) * s * 0.035;
            context.lineTo(x, y);
          }
          context.stroke();
        }
      },
    ),
  );
}

export function rippleTexture({ size = 256, seed = 12 }: { size?: number; seed?: number } = {}): TextureSet {
  return cached(`ripple:${size}:${seed}`, () =>
    bakeTexture(
      size,
      (u, v) => {
        const wave = Math.sin((v * 6 + 0.8 * fractalNoise(u, v, 3, 2, seed)) * Math.PI * 2) * Math.sin(u * Math.PI * 2 * 2);
        return { shade: 0.88 + 0.1 * Math.max(0, wave), height: wave * 0.3, roughness: 0.1 };
      },
      1.5,
    ),
  );
}

export function trackTexture({ size = 256, seed = 13 }: { size?: number; seed?: number } = {}): TextureSet {
  return cached(`track:${size}:${seed}`, () =>
    bakeTexture(
      size,
      (u, v) => {
        const grit = fractalNoise(u, v, 8, 4, seed) - 0.5;
        const edge = Math.exp(-((Math.min(u, 1 - u) / 0.035) ** 2));
        const ruts = Math.exp(-(((u - 0.3) / 0.06) ** 2)) + Math.exp(-(((u - 0.7) / 0.06) ** 2));
        return { shade: 0.95 + 0.06 * grit - 0.18 * edge - 0.07 * ruts, height: grit * 0.3 - ruts * 0.4, roughness: 0.92 };
      },
      1.2,
    ),
  );
}

export function tiled<T extends Texture>(texture: T, repeatU: number, repeatV = repeatU): T {
  const copy = texture.clone();
  copy.repeat.set(repeatU, repeatV);
  copy.needsUpdate = true;
  return copy;
}
