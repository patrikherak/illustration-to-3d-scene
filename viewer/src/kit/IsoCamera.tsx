import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { OrthographicCamera } from 'three';
import { type Calibration, imageCentre, viewDirection } from './iso.ts';

export type Fit = 'contain' | 'cover';

export interface IsoCameraProps {
  calibration: Calibration;
  fit?: Fit;
  distance?: number;
}

export function IsoCamera({ calibration, fit = 'contain', distance = 120 }: IsoCameraProps) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) throw new Error('IsoCamera needs <Canvas orthographic>');
    const [dx, dy, dz] = viewDirection(calibration);
    const [tx, ty, tz] = imageCentre(calibration);
    const pick = fit === 'contain' ? Math.min : Math.max;
    camera.position.set(tx + dx * distance, ty + dy * distance, tz + dz * distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, ty, tz);
    camera.zoom = pick(width / calibration.image[0], height / calibration.image[1]) * calibration.pxPerUnit;
    camera.near = 0.1;
    camera.far = distance * 2;
    camera.updateProjectionMatrix();
  }, [camera, calibration, fit, distance, width, height]);

  return null;
}
