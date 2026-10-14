import { useLayoutEffect, useMemo, useRef } from 'react';
import { ConeGeometry, CylinderGeometry, type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { hash } from './textures.ts';
import type { Vec2 } from './iso.ts';
import { sharedMaterial, type Surface } from './surface.ts';

export interface Pine {
  position: Vec2;
  scale: number;
  base?: number;
}

export interface ForestProps {
  pines: readonly Pine[];
  needles: Surface;
  snow: Surface;
  bark: Surface;
}

const TIERS = [
  { bottom: 0.35, height: 1.25, radius: 0.78 },
  { bottom: 0.95, height: 1.05, radius: 0.6 },
  { bottom: 1.5, height: 0.9, radius: 0.42 },
] as const;
const SNOW_LINE = 0.6;

function parts() {
  const tiers = TIERS.map(({ bottom, height, radius }) => new ConeGeometry(radius, height, 14, 1).translate(0, bottom + height / 2, 0));
  const caps = TIERS.map(({ bottom, height, radius }) => {
    const capHeight = height * (1 - SNOW_LINE) * 1.02;
    return new ConeGeometry(radius * (1 - SNOW_LINE) * 1.12, capHeight, 14, 1).translate(0, bottom + height - capHeight / 2 + 0.01, 0);
  });
  const trunk = new CylinderGeometry(0.07, 0.1, 0.5, 8).translate(0, 0.25, 0);
  return { tiers, caps, trunk };
}

export function Forest({ pines, needles, snow, bark }: ForestProps) {
  const geometry = useMemo(parts, []);
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const up = new Vector3(0, 1, 0);
    pines.forEach(({ position: [x, z], scale, base = 0 }, i) => {
      rotation.setFromAxisAngle(up, hash(x, z, 3) * Math.PI * 2);
      matrix.compose(new Vector3(x, base, z), rotation, new Vector3(scale, scale, scale));
      for (const mesh of meshes.current) mesh?.setMatrixAt(i, matrix);
    });
    for (const mesh of meshes.current) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  }, [pines]);
  const register = (index: number) => (mesh: InstancedMesh | null) => {
    meshes.current[index] = mesh;
  };
  const all = [
    ...geometry.tiers.map((g) => ({ geometry: g, surface: needles })),
    ...geometry.caps.map((g) => ({ geometry: g, surface: snow })),
    { geometry: geometry.trunk, surface: bark },
  ];
  return (
    <group>
      {all.map(({ geometry: g, surface }, i) => (
        <instancedMesh key={i} ref={register(i)} args={[g, sharedMaterial(surface), pines.length]} castShadow receiveShadow />
      ))}
    </group>
  );
}
