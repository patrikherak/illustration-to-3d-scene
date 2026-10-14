import { Canvas, type RootState } from '@react-three/fiber';
import { useState } from 'react';
import { calibration, labels, palette, referenceUrl } from './example/alpine.ts';
import { AlpineScene } from './example/AlpineScene.tsx';
import { schedule } from './example/routes.ts';
import {
  ClockContext,
  ClockDriver,
  createClock,
  Effects,
  type Fit,
  FullscreenButton,
  IsoCamera,
  IsoLabels,
  qualityFromUrl,
  ReferenceOverlay,
  ReloadOnContextLoss,
  type SceneClock,
  useUptimeReload,
} from './kit/index.ts';

const params = new URLSearchParams(window.location.search);
const frozenAt = params.has('t') ? Number(params.get('t')) : null;
const fit: Fit = params.get('fit') === 'cover' ? 'cover' : 'contain';
const referenceOpacity = Number(params.get('ref') ?? 0);
const uptimeHours = Number(params.get('uptime') ?? 12);
const adaptive = params.get('adaptive') !== '0' && frozenAt === null;
const showControls = params.get('ui') !== '0';
const snowfall = params.get('snow') !== '0';
const clock = createClock(frozenAt ?? 0, frozenAt !== null);

interface SceneHooks {
  clock: SceneClock;
  period: number;
  renderer: string;
  dpr: () => number;
  seek: (time: number) => void;
  play: () => void;
}

declare global {
  interface Window {
    __scene?: SceneHooks;
  }
}

function rendererName(state: RootState): string {
  const context = state.gl.getContext();
  const info = context.getExtension('WEBGL_debug_renderer_info');
  return String(info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER));
}

function exposeHooks(state: RootState) {
  window.__scene = {
    clock,
    period: schedule.period,
    renderer: rendererName(state),
    dpr: () => state.gl.getPixelRatio(),
    seek: (time) => {
      clock.time = time;
      clock.paused = true;
    },
    play: () => {
      clock.paused = false;
    },
  };
}

document.documentElement.style.setProperty('--sky-top', palette.sky_top);
document.documentElement.style.setProperty('--sky-bottom', palette.sky_bottom);

export function App() {
  const [quality, setQuality] = useState(qualityFromUrl());
  useUptimeReload(uptimeHours);
  return (
    <ClockContext.Provider value={clock}>
      <Canvas
        orthographic
        flat
        shadows
        dpr={quality === 'low' ? 1 : [1, 2]}
        gl={{ antialias: false, stencil: false, powerPreference: 'high-performance' }}
        onCreated={(state) => {
          state.gl.localClippingEnabled = true;
          exposeHooks(state);
        }}
      >
        <ClockDriver clock={clock} />
        <IsoCamera calibration={calibration} fit={fit} />
        <AlpineScene quality={quality} snowfall={snowfall} />
        <Effects quality={quality} onQualityChange={setQuality} adaptive={adaptive} maxDpr={quality === 'low' ? 1 : 2} />
        <ReloadOnContextLoss />
      </Canvas>
      <IsoLabels calibration={calibration} labels={labels} fit={fit} />
      <ReferenceOverlay src={referenceUrl} opacity={referenceOpacity} fit={fit} />
      {showControls && <FullscreenButton />}
    </ClockContext.Provider>
  );
}
