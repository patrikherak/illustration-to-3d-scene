import type { CSSProperties } from 'react';
import type { Fit } from './IsoCamera.tsx';
import { type Calibration, toPixel, type Vec3 } from './iso.ts';

export interface IsoLabel {
  text: string;
  position: Vec3;
}

export interface IsoLabelsProps {
  calibration: Calibration;
  labels: readonly IsoLabel[];
  fit?: Fit;
  fontPx?: number;
}

export function IsoLabels({ calibration, labels, fit = 'contain', fontPx = 22 }: IsoLabelsProps) {
  const [width, height] = calibration.image;
  const aspect = width / height;
  const frame: CSSProperties = {
    width: `${fit === 'contain' ? 'min' : 'max'}(100vw, calc(100vh * ${aspect}))`,
    aspectRatio: `${width} / ${height}`,
    fontSize: `${(fontPx / width) * 100}cqw`,
  };
  return (
    <div className="iso-labels" style={frame} aria-hidden="true">
      {labels.map((label) => {
        const [px, py] = toPixel(calibration, label.position);
        return (
          <div key={label.text} className="iso-label" style={{ left: `${(px / width) * 100}%`, top: `${(py / height) * 100}%` }}>
            {label.text}
          </div>
        );
      })}
    </div>
  );
}
