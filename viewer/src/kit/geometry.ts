import { BoxGeometry, BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Shape, Vector3 } from 'three';
import type { Vec2, Vec3 } from './iso.ts';

export interface CurveOptions {
  closed?: boolean;
  tension?: number;
}

export function curveThrough(points: readonly Vec3[], { closed = false, tension }: CurveOptions = {}): CatmullRomCurve3 {
  const controls = points.map(([x, y, z]) => new Vector3(x, y, z));
  return tension === undefined
    ? new CatmullRomCurve3(controls, closed, 'centripetal')
    : new CatmullRomCurve3(controls, closed, 'catmullrom', tension);
}

export function lifted(points: readonly Vec2[], y: number): Vec3[] {
  return points.map(([x, z]) => [x, y, z] as const);
}

export function smoothCurve(points: readonly Vec2[], y = 0, options: CurveOptions = {}): CatmullRomCurve3 {
  return curveThrough(lifted(points, y), options);
}

export function sideOf(tangent: Vector3): Vector3 {
  return new Vector3(-tangent.z, 0, tangent.x).normalize();
}

export function offsetPoints(points: readonly Vec2[], offset: number, closed = false): Vec2[] {
  const count = points.length;
  const at = (i: number) => points[closed ? (i + count) % count : Math.min(count - 1, Math.max(0, i))];
  return points.map(([x, z], i) => {
    const [ax, az] = at(i - 1);
    const [bx, bz] = at(i + 1);
    const length = Math.hypot(bx - ax, bz - az) || 1;
    return [x - ((bz - az) / length) * offset, z + ((bx - ax) / length) * offset] as const;
  });
}

export function offsetPoints3(points: readonly Vec3[], offset: number): Vec3[] {
  const flat = offsetPoints(
    points.map(([x, , z]) => [x, z] as const),
    offset,
  );
  return flat.map(([x, z], i) => [x, points[i][1], z] as const);
}

export interface StripSample {
  point: Vector3;
  side: Vector3;
  distance: number;
}

export function sampleCurve(curve: CatmullRomCurve3, step: number): StripSample[] {
  const length = curve.getLength();
  const count = Math.max(2, Math.ceil(length / step) + 1);
  return Array.from({ length: count }, (_, i) => {
    const u = i / (count - 1);
    return { point: curve.getPointAt(u), side: sideOf(curve.getTangentAt(u)), distance: u * length };
  });
}

export function ribbonGeometry(curve: CatmullRomCurve3, width: number, tile: number, step = 0.1): BufferGeometry {
  const samples = sampleCurve(curve, step);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  samples.forEach(({ point, side, distance }, i) => {
    const left = point.clone().addScaledVector(side, width / 2);
    const right = point.clone().addScaledVector(side, -width / 2);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, distance / tile, 1, distance / tile);
    if (i > 0) {
      const a = 2 * (i - 1);
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  return indexedGeometry(positions, normals, uvs, indices);
}

export function wallGeometry(curve: CatmullRomCurve3, offset: number, depth: number, step = 0.1): BufferGeometry {
  const samples = sampleCurve(curve, step);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const facing = Math.sign(offset) || 1;
  samples.forEach(({ point, side, distance }, i) => {
    const base = point.clone().addScaledVector(side, offset);
    positions.push(base.x, base.y, base.z, base.x, base.y - depth, base.z);
    normals.push(side.x * facing, 0, side.z * facing, side.x * facing, 0, side.z * facing);
    uvs.push(distance, 1, distance, 0);
    if (i > 0) {
      const a = 2 * (i - 1);
      if (facing > 0) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  return indexedGeometry(positions, normals, uvs, indices);
}

function indexedGeometry(positions: number[], normals: number[], uvs: number[], indices: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function roundedOutline(points: readonly Vec2[], radius: number): Shape {
  const shape = new Shape();
  const count = points.length;
  points.forEach(([x, z], i) => {
    const [px, pz] = points[(i + count - 1) % count];
    const [nx, nz] = points[(i + 1) % count];
    const toPrevious = Math.hypot(px - x, pz - z);
    const toNext = Math.hypot(nx - x, nz - z);
    const cut = Math.min(radius, toPrevious * 0.45, toNext * 0.45);
    const ax = x + ((px - x) / toPrevious) * cut;
    const az = z + ((pz - z) / toPrevious) * cut;
    const bx = x + ((nx - x) / toNext) * cut;
    const bz = z + ((nz - z) / toNext) * cut;
    if (i === 0) shape.moveTo(ax, -az);
    else shape.lineTo(ax, -az);
    shape.quadraticCurveTo(x, -z, bx, -bz);
  });
  shape.closePath();
  return shape;
}

export function planarUvs(geometry: BufferGeometry, scale: number): BufferGeometry {
  const position = geometry.getAttribute('position');
  const uvs = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uvs[2 * i] = position.getX(i) / scale;
    uvs[2 * i + 1] = position.getZ(i) / scale;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geometry;
}

export function worldUvBox(width: number, height: number, depth: number): BufferGeometry {
  const box = new BoxGeometry(width, height, depth);
  const position = box.getAttribute('position');
  const normal = box.getAttribute('normal');
  const uv = box.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    if (Math.abs(normal.getX(i)) > 0.5) uv.setXY(i, z * Math.sign(normal.getX(i)) * -1, y);
    else if (Math.abs(normal.getZ(i)) > 0.5) uv.setXY(i, x * Math.sign(normal.getZ(i)), y);
    else uv.setXY(i, x, z);
  }
  uv.needsUpdate = true;
  return box;
}

export function planarPolygon(points: readonly Vec3[]): BufferGeometry {
  const corners = points.map(([x, y, z]) => new Vector3(x, y, z));
  const origin = corners[0];
  const uAxis = corners[1].clone().sub(origin).normalize();
  const last = corners[corners.length - 1].clone().sub(origin);
  const normal = new Vector3().crossVectors(corners[1].clone().sub(origin), last).normalize();
  const vAxis = new Vector3().crossVectors(normal, uAxis).normalize();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  corners.forEach((corner, i) => {
    const offset = corner.clone().sub(origin);
    positions.push(corner.x, corner.y, corner.z);
    normals.push(normal.x, normal.y, normal.z);
    uvs.push(offset.dot(uAxis), offset.dot(vAxis));
    if (i >= 2) indices.push(0, i - 1, i);
  });
  return indexedGeometry(positions, normals, uvs, indices);
}
