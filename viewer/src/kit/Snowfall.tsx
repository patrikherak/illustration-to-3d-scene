import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, CanvasTexture } from 'three';
import { useSceneClock } from './clock.ts';
import type { Vec3 } from './iso.ts';
import { hash } from './textures.ts';

export interface SnowfallProps {
  min: Vec3;
  max: Vec3;
  count?: number;
  speed?: number;
  size?: number;
  opacity?: number;
}

function flakeSprite(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is not available');
  const glow = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 32, 32);
  return new CanvasTexture(canvas);
}

export function Snowfall({ min, max, count = 400, speed = 0.7, size = 5, opacity = 0.9 }: SnowfallProps) {
  const clock = useSceneClock();
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => [hash(i, 1, 7), hash(i, 2, 7), hash(i, 3, 7), hash(i, 4, 7)] as const), [count]);
  const geometry = useMemo(() => {
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    return buffer;
  }, [count]);
  const sprite = useMemo(flakeSprite, []);
  useFrame(() => {
    const position = geometry.getAttribute('position') as BufferAttribute;
    const height = max[1] - min[1];
    seeds.forEach(([a, b, c, d], i) => {
      const fall = (((c * height - clock.time * speed * (0.7 + 0.6 * d)) % height) + height) % height;
      const sway = Math.sin(clock.time * (0.6 + d) + a * 20) * 0.25;
      position.setXYZ(i, min[0] + a * (max[0] - min[0]) + sway, min[1] + fall, min[2] + b * (max[2] - min[2]) + sway * 0.5);
    });
    position.needsUpdate = true;
  });
  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={10}>
      <pointsMaterial map={sprite} size={size} sizeAttenuation={false} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </points>
  );
}
