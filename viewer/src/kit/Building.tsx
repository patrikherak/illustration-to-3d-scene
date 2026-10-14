import { type ReactNode, useMemo } from 'react';
import { planarPolygon, worldUvBox } from './geometry.ts';
import type { Vec2, Vec3 } from './iso.ts';
import { sharedMaterial, type Surface } from './surface.ts';

export type Face = '+x' | '-x' | '+z' | '-z';

export interface WallBand {
  height: number;
  surface: Surface;
}

export interface Opening {
  face: Face;
  from: number;
  to: number;
  bottom: number;
  top: number;
  surface: Surface;
  frame?: Surface;
}

export interface GableRoof {
  ridge: number;
  axis: 'x' | 'z';
  overhang?: number;
  surface: Surface;
  gable: Surface;
}

export interface FlatRoof {
  thickness: number;
  overhang: number;
  surface: Surface;
}

export interface BuildingProps {
  center: Vec2;
  size: Vec2;
  walls: readonly WallBand[];
  base?: number;
  openings?: readonly Opening[];
  roof?: GableRoof;
  cap?: FlatRoof;
  children?: ReactNode;
}

const FACE_ROTATION: Record<Face, number> = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI };

export function wallHeight(walls: readonly WallBand[]): number {
  return walls.reduce((sum, band) => sum + band.height, 0);
}

export function windowRow(face: Face, start: number, end: number, count: number, bottom: number, top: number, surface: Surface, frame?: Surface): Opening[] {
  const span = (end - start) / count;
  return Array.from({ length: count }, (_, i) => ({ face, from: start + span * (i + 0.27), to: start + span * (i + 0.73), bottom, top, surface, frame }));
}

export function Building({ center, size, walls, base = 0, openings = [], roof, cap, children }: BuildingProps) {
  const [cx, cz] = center;
  const [dx, dz] = size;
  const height = wallHeight(walls);
  let y = base;
  const bands = walls.map((band) => {
    const bottom = y;
    y += band.height;
    return { band, bottom };
  });
  return (
    <group position={[cx, 0, cz]}>
      {bands.map(({ band, bottom }, i) => (
        <WallBox key={i} size={[dx, band.height, dz]} y={bottom} surface={band.surface} />
      ))}
      {openings.map((opening, i) => (
        <OpeningPanel key={i} opening={opening} center={center} size={size} base={base} />
      ))}
      {roof && <Gable roof={roof} size={size} top={base + height} />}
      {cap && <WallBox size={[dx + 2 * cap.overhang, cap.thickness, dz + 2 * cap.overhang]} y={base + height} surface={cap.surface} />}
      {children}
    </group>
  );
}

function WallBox({ size: [w, h, d], y, surface }: { size: Vec3; y: number; surface: Surface }) {
  const geometry = useMemo(() => worldUvBox(w, h, d), [w, h, d]);
  return <mesh geometry={geometry} material={sharedMaterial(surface)} position={[0, y + h / 2, 0]} castShadow receiveShadow />;
}

function OpeningPanel({ opening, center, size, base }: { opening: Opening; center: Vec2; size: Vec2; base: number }) {
  const { face, from, to, bottom, top } = opening;
  const [cx, cz] = center;
  const [dx, dz] = size;
  const alongX = face === '+z' || face === '-z';
  const middle = (from + to) / 2 - (alongX ? cx : cz);
  const sign = face.startsWith('+') ? 1 : -1;
  const out = (alongX ? dz / 2 : dx / 2) + 0.012;
  const width = Math.abs(to - from);
  const height = top - bottom;
  const position = (lift: number): Vec3 =>
    alongX ? [middle, base + (top + bottom) / 2, sign * (out + lift)] : [sign * (out + lift), base + (top + bottom) / 2, middle];
  return (
    <group>
      {opening.frame && (
        <mesh position={position(0)} rotation={[0, FACE_ROTATION[face], 0]} material={sharedMaterial(opening.frame)}>
          <planeGeometry args={[width + 0.1, height + 0.1]} />
        </mesh>
      )}
      <mesh position={position(0.006)} rotation={[0, FACE_ROTATION[face], 0]} material={sharedMaterial(opening.surface)}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

function Gable({ roof, size: [dx, dz], top }: { roof: GableRoof; size: Vec2; top: number }) {
  const geometries = useMemo(() => {
    const o = roof.overhang ?? 0.18;
    const [x0, x1, z0, z1] = [-dx / 2 - o, dx / 2 + o, -dz / 2 - o, dz / 2 + o];
    const [y0, y1] = [top, top + roof.ridge];
    if (roof.axis === 'z') {
      return {
        slopes: [
          planarPolygon([[x1, y0, z1], [x1, y0, z0], [0, y1, z0], [0, y1, z1]]),
          planarPolygon([[x0, y0, z0], [x0, y0, z1], [0, y1, z1], [0, y1, z0]]),
        ],
        gables: [planarPolygon([[x0, y0, z1], [x1, y0, z1], [0, y1, z1]]), planarPolygon([[x1, y0, z0], [x0, y0, z0], [0, y1, z0]])],
      };
    }
    return {
      slopes: [
        planarPolygon([[x0, y0, z1], [x1, y0, z1], [x1, y1, 0], [x0, y1, 0]]),
        planarPolygon([[x1, y0, z0], [x0, y0, z0], [x0, y1, 0], [x1, y1, 0]]),
      ],
      gables: [planarPolygon([[x1, y0, z1], [x1, y0, z0], [x1, y1, 0]]), planarPolygon([[x0, y0, z0], [x0, y0, z1], [x0, y1, 0]])],
    };
  }, [roof.overhang, roof.axis, roof.ridge, dx, dz, top]);
  return (
    <group>
      {geometries.slopes.map((geometry, i) => (
        <mesh key={`s${i}`} geometry={geometry} material={sharedMaterial(roof.surface)} castShadow receiveShadow />
      ))}
      {geometries.gables.map((geometry, i) => (
        <mesh key={`g${i}`} geometry={geometry} material={sharedMaterial(roof.gable)} castShadow receiveShadow />
      ))}
    </group>
  );
}
