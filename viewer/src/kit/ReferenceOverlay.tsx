export interface ReferenceOverlayProps {
  src: string;
  opacity: number;
  fit?: 'contain' | 'cover';
}

export function ReferenceOverlay({ src, opacity, fit = 'contain' }: ReferenceOverlayProps) {
  if (!(opacity > 0)) return null;
  return <img className="reference-overlay" src={src} alt="" style={{ opacity, objectFit: fit }} />;
}
