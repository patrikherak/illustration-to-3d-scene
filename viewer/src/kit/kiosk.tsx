import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';

const HOUR = 3_600_000;

export function registerPrecache(url = './sw.js') {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url).catch((error: unknown) => console.warn('precache unavailable', error));
  });
}

export function useUptimeReload(hours: number) {
  useEffect(() => {
    if (!(hours > 0)) return;
    const timer = window.setTimeout(() => window.location.reload(), hours * HOUR);
    return () => window.clearTimeout(timer);
  }, [hours]);
}

export function ReloadOnContextLoss({ delayMs = 1500 }: { delayMs?: number }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    const onLost = (event: Event) => {
      event.preventDefault();
      console.warn('webgl context lost, reloading');
      window.setTimeout(() => window.location.reload(), delayMs);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [canvas, delayMs]);
  return null;
}

function useIdle(ms: number): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), ms);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), ms);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake));
    };
  }, [ms]);
  return idle;
}

function useFullscreen(): boolean {
  const [active, setActive] = useState(Boolean(document.fullscreenElement));
  useEffect(() => {
    const update = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  return active;
}

export function FullscreenButton({ idleMs = 4000 }: { idleMs?: number }) {
  const idle = useIdle(idleMs);
  const fullscreen = useFullscreen();
  useEffect(() => {
    document.body.style.cursor = idle ? 'none' : '';
  }, [idle]);
  if (!document.fullscreenEnabled) return null;
  const toggle = () => {
    const request = fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    request.catch((error: unknown) => console.warn('fullscreen refused', error));
  };
  return (
    <button type="button" className={`kiosk-fullscreen${idle ? ' is-idle' : ''}`} onClick={toggle} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          d={fullscreen ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
