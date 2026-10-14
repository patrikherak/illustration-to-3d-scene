import { useMemo } from 'react';
import { DoubleSide, ExtrudeGeometry, ShapeGeometry } from 'three';
import { planarUvs, ribbonGeometry, roundedOutline, smoothCurve } from './geometry.ts';
import type { Vec2 } from './iso.ts';
import { sharedMaterial, type Surface } from './surface.ts';
import { canvasShadow } from './shadow.ts';

export interface Area {
  outline: readonly Vec2[];
  surface: Surface;
  lift?: number;
  cornerRadius?: number;
}

export interface Path {
  points: readonly Vec2[];
  width: number;
  surface: Surface;
  closed?: boolean;
  tile?: number;
  lift?: number;
}

export interface DropShadow {
  depth: number;
  opacity: number;
  blur?: number;
  color?: string;
}

export interface GroundProps {
  outline: readonly Vec2[];
  surface: Surface;
  side?: Surface;
  thickness?: number;
  elevation?: number;
  cornerRadius?: number;
  areas?: readonly Area[];
  paths?: readonly Path[];
  dropShadow?: DropShadow;
}

export function Ground({ outline, surface, side = surface, thickness = 0.3, elevation = 0, cornerRadius = 1.2, areas = [], paths = [], dropShadow }: GroundProps) {
  const geometry = useMemo(() => {
    const bevel = Math.min(0.12, thickness / 3);
    const slab = new ExtrudeGeometry(roundedOutline(outline, cornerRadius), {
      depth: thickness - bevel,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 10,
    });
    slab.rotateX(-Math.PI / 2);
    slab.computeBoundingBox();
    slab.translate(0, elevation - (slab.boundingBox?.max.y ?? 0), 0);
    return slab;
  }, [outline, thickness, cornerRadius, elevation]);

  return (
    <group>
      <mesh geometry={geometry} material={[sharedMaterial(surface), sharedMaterial(side)]} castShadow receiveShadow />
      {areas.map((area, i) => (
        <AreaPatch key={i} area={area} elevation={elevation} />
      ))}
      {paths.map((path, i) => (
        <PathStrip key={i} path={path} elevation={elevation} />
      ))}
      {dropShadow && <IslandShadow outline={outline} shadow={dropShadow} elevation={elevation} />}
    </group>
  );
}

function AreaPatch({ area, elevation }: { area: Area; elevation: number }) {
  const geometry = useMemo(() => {
    const patch = new ShapeGeometry(roundedOutline(area.outline, area.cornerRadius ?? 0.6), 12);
    patch.rotateX(-Math.PI / 2);
    patch.translate(0, elevation + (area.lift ?? 0.006), 0);
    return planarUvs(patch, 1);
  }, [area, elevation]);
  return <mesh geometry={geometry} material={sharedMaterial(area.surface)} receiveShadow />;
}

function PathStrip({ path, elevation }: { path: Path; elevation: number }) {
  const geometry = useMemo(
    () => ribbonGeometry(smoothCurve(path.points, elevation + (path.lift ?? 0.012), { closed: path.closed }), path.width, path.tile ?? path.width),
    [path, elevation],
  );
  return <mesh geometry={geometry} material={sharedMaterial(path.surface)} receiveShadow />;
}

function IslandShadow({ outline, shadow, elevation }: { outline: readonly Vec2[]; shadow: DropShadow; elevation: number }) {
  const { texture, center, size } = useMemo(() => canvasShadow(outline, shadow.blur ?? 1.5, shadow.color ?? '#3d3f5a'), [outline, shadow.blur, shadow.color]);
  return (
    <mesh position={[center[0], elevation - shadow.depth, center[1]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
      <planeGeometry args={[size[0], size[1]]} />
      <meshBasicMaterial map={texture} transparent opacity={shadow.opacity} depthWrite={false} side={DoubleSide} toneMapped={false} />
    </mesh>
  );
}
