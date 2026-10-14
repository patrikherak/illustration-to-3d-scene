import { PerformanceMonitor } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA } from '@react-three/postprocessing';
import { useEffect, useState } from 'react';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type Quality = 'high' | 'low';

export function qualityFromUrl(search = window.location.search): Quality {
  return new URLSearchParams(search).get('quality') === 'low' ? 'low' : 'high';
}

export function SoftEnvironment({ intensity = 0.3 }: { intensity?: number }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      target.dispose();
      room.dispose();
      generator.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

export interface EffectsProps {
  quality: Quality;
  onQualityChange?: (quality: Quality) => void;
  maxDpr?: number;
  minDpr?: number;
  adaptive?: boolean;
  occlusionColor?: string;
}

export function Effects({ quality, onQualityChange, maxDpr = 2, minDpr = 0.75, adaptive = true, occlusionColor = '#2b3550' }: EffectsProps) {
  const setDpr = useThree((state) => state.setDpr);
  const [factor, setFactor] = useState(1);

  const degrade = (next: number) => {
    const ceiling = Math.min(window.devicePixelRatio, maxDpr);
    const floor = Math.min(minDpr, ceiling);
    setFactor(next);
    setDpr(floor + (ceiling - floor) * next);
  };

  return (
    <>
      {adaptive && (
        <PerformanceMonitor
          factor={1}
          step={0.2}
          flipflops={4}
          bounds={(refreshRate) => (refreshRate > 90 ? [55, 90] : [45, 58])}
          onChange={({ factor: next }) => degrade(next)}
          onFallback={() => onQualityChange?.('low')}
        />
      )}
      {quality === 'high' ? (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={1.1} distanceFalloff={0.6} intensity={factor > 0.5 ? 2.4 : 1.6} color={occlusionColor} halfRes={factor <= 0.5} quality="medium" />
          <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.25} intensity={0.55} />
          <SMAA />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}
