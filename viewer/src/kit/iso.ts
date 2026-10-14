export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export interface Calibration {
  image: readonly [number, number];
  anchor: readonly [number, number];
  pxPerUnit: number;
  elevationDeg: number;
}

const HALF_SQRT2 = Math.SQRT1_2;

function elevation(cal: Calibration): number {
  return (cal.elevationDeg * Math.PI) / 180;
}

export function toPixel(cal: Calibration, [x, y, z]: Vec3): Vec2 {
  const e = elevation(cal);
  const s = cal.pxPerUnit;
  return [
    cal.anchor[0] + s * (x - z) * HALF_SQRT2,
    cal.anchor[1] + s * (x + z) * HALF_SQRT2 * Math.sin(e) - s * y * Math.cos(e),
  ];
}

export function toWorld(cal: Calibration, px: number, py: number, y = 0): Vec3 {
  const e = elevation(cal);
  const s = cal.pxPerUnit;
  const across = (px - cal.anchor[0]) / (s * HALF_SQRT2);
  const depth = (py - cal.anchor[1] + s * y * Math.cos(e)) / (s * HALF_SQRT2 * Math.sin(e));
  return [(across + depth) / 2, y, (depth - across) / 2];
}

export function isoMapper(cal: Calibration): (px: number, py: number, y?: number) => Vec3 {
  return (px, py, y = 0) => toWorld(cal, px, py, y);
}

export function viewDirection(cal: Calibration): Vec3 {
  const e = elevation(cal);
  return [Math.cos(e) * HALF_SQRT2, Math.sin(e), Math.cos(e) * HALF_SQRT2];
}

export function imageCentre(cal: Calibration): Vec3 {
  return toWorld(cal, cal.image[0] / 2, cal.image[1] / 2, 0);
}
