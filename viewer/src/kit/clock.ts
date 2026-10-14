import { useFrame } from '@react-three/fiber';
import { createContext, useContext } from 'react';

export interface SceneClock {
  time: number;
  rate: number;
  paused: boolean;
  frames: number;
}

export function createClock(start = 0, paused = false): SceneClock {
  return { time: start, rate: 1, paused, frames: 0 };
}

export const ClockContext = createContext<SceneClock>(createClock());

export function useSceneClock(): SceneClock {
  return useContext(ClockContext);
}

const MAX_STEP = 0.1;

export function ClockDriver({ clock }: { clock: SceneClock }) {
  useFrame((_, delta) => {
    clock.frames += 1;
    if (!clock.paused) clock.time += Math.min(delta, MAX_STEP) * clock.rate;
  }, -100);
  return null;
}
