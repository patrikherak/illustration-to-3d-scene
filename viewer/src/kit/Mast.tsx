import type { Vec2 } from './iso.ts';
import { sharedMaterial, type Surface } from './surface.ts';

export interface MastProps {
  position: Vec2;
  height: number;
  arm: number;
  surface: Surface;
  base?: number;
  width?: number;
}

export function Mast({ position: [x, z], height, arm, surface, base = 0, width = 0.22 }: MastProps) {
  const material = sharedMaterial(surface);
  return (
    <group position={[x, base, z]}>
      <mesh position={[0, height / 2, 0]} rotation={[0, Math.PI / 4, 0]} material={material} castShadow>
        <cylinderGeometry args={[(width / 2) * 0.75, (width / 2) * 1.35, height, 4]} />
      </mesh>
      <mesh position={[0, height + 0.07, 0]} material={material} castShadow>
        <boxGeometry args={[arm, 0.14, 0.16]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (arm - 0.3)) / 2, height - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={material}>
          <cylinderGeometry args={[0.09, 0.09, 0.06, 12]} />
        </mesh>
      ))}
    </group>
  );
}
