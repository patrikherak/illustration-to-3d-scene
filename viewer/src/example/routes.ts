import { driveProfile, type LoopStop, loopRoute, type Motion, planRoute, poseAt, scheduleFleet, stopTime, type VehicleStyle } from '../kit/index.ts';
import { road } from './alpine.ts';

const LIFT_STOP = 'lift';

export const stops: LoopStop[] = [
  { name: LIFT_STOP, at: [10.6, 3.2], dwell: 4 },
  { name: 'hotel', at: [0.6, -4.5], dwell: 2 },
  { name: 'village', at: [-10.2, 0.4], dwell: 2 },
];

export const busMotion: Motion = { speed: 2.6, accel: 2.2 };
export const liftMotion: Motion = { speed: 0.9, accel: 0.5 };
export const streamSpeed = 0.35;

const bus = { length: 2.0, width: 0.95, height: 1.15 };

export const busStyles: VehicleStyle[] = [
  { ...bus, color: '#e5533d' },
  { ...bus, color: '#f2b134' },
  { ...bus, color: '#3f7cc0' },
];

export const busRoute = loopRoute('village loop', road.loop, stops);
const plan = planRoute(busRoute, busMotion);
const fleet = scheduleFleet(
  busStyles.map((style) => ({ plan, footprint: style })),
  { gap: 0.3 },
);
const firstAtLift = stopTime(fleet.plans[0], LIFT_STOP) - 1.5 - fleet.offsets[0];

export const schedule = { ...fleet, offsets: fleet.offsets.map((offset) => offset + firstAtLift) };

export const liftDrive = driveProfile(
  (time) => schedule.plans.some((route, i) => poseAt(route, time + schedule.offsets[i]).stop === LIFT_STOP),
  schedule.period,
  liftMotion,
  { idle: 0.35 },
);
