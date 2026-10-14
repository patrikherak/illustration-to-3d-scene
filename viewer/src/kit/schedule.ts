import type { CatmullRomCurve3 } from 'three';
import { offsetPoints, smoothCurve } from './geometry.ts';
import type { Vec2 } from './iso.ts';

export interface Portal {
  point: Vec2;
  normal: Vec2;
  reach?: number;
}

export interface Leg {
  path: readonly Vec2[];
  reverse?: boolean;
  stop?: string;
  dwell?: number;
  hidden?: boolean;
  portal?: Portal;
}

export interface Route {
  name: string;
  legs: readonly Leg[];
}

export interface Motion {
  speed: number;
  accel: number;
}

export interface Footprint {
  length: number;
  width: number;
}

interface Segment {
  leg: Leg;
  curve: CatmullRomCurve3;
  length: number;
  offset: number;
}

interface Run {
  segments: Segment[];
  length: number;
  start: number;
  arrive: number;
  depart: number;
  stop: string | null;
}

export interface Plan {
  route: Route;
  motion: Motion;
  runs: Run[];
  period: number;
  length: number;
}

export interface Pose {
  x: number;
  z: number;
  heading: number;
  stop: string | null;
  hidden: boolean;
  portal: Portal | undefined;
}

function isStop(leg: Leg, next: Leg | undefined): boolean {
  return Boolean(leg.stop) || (leg.dwell ?? 0) > 0 || next === undefined || Boolean(next.reverse) !== Boolean(leg.reverse);
}

export function travelTime(length: number, { speed, accel }: Motion): number {
  const rampDistance = (speed * speed) / accel;
  return length >= rampDistance ? length / speed + speed / accel : 2 * Math.sqrt(length / accel);
}

export function distanceAt(elapsed: number, length: number, motion: Motion): number {
  const { speed, accel } = motion;
  const total = travelTime(length, motion);
  const t = Math.min(Math.max(elapsed, 0), total);
  const peak = Math.min(speed, Math.sqrt(length * accel));
  const ramp = peak / accel;
  if (t < ramp) return 0.5 * accel * t * t;
  if (t > total - ramp) return length - 0.5 * accel * (total - t) ** 2;
  return 0.5 * accel * ramp * ramp + peak * (t - ramp);
}

export function planRoute(route: Route, motion: Motion): Plan {
  const runs: Run[] = [];
  let pending: Segment[] = [];
  let clock = 0;
  let pendingLength = 0;
  route.legs.forEach((leg, i) => {
    const curve = smoothCurve(leg.path);
    const length = curve.getLength();
    pending.push({ leg, curve, length, offset: pendingLength });
    pendingLength += length;
    if (!isStop(leg, route.legs[i + 1])) return;
    const arrive = clock + travelTime(pendingLength, motion);
    const depart = arrive + (leg.dwell ?? 0);
    runs.push({ segments: pending, length: pendingLength, start: clock, arrive, depart, stop: leg.stop ?? null });
    clock = depart;
    pending = [];
    pendingLength = 0;
  });
  return { route, motion, runs, period: clock, length: runs.reduce((sum, run) => sum + run.length, 0) };
}

export function withPeriod(plan: Plan, period: number): Plan {
  const layover = period - plan.period;
  if (layover < 0) throw new Error(`route ${plan.route.name} is longer than the shared period`);
  const runs = plan.runs.map((run, i) => (i === plan.runs.length - 1 ? { ...run, depart: run.depart + layover } : run));
  return { ...plan, runs, period };
}

export function poseAt(plan: Plan, time: number): Pose {
  const t = ((time % plan.period) + plan.period) % plan.period;
  const run = plan.runs.find((candidate) => t < candidate.depart) ?? plan.runs[plan.runs.length - 1];
  const travelled = distanceAt(t - run.start, run.length, plan.motion);
  const segment = run.segments.find((candidate) => travelled <= candidate.offset + candidate.length) ?? run.segments[run.segments.length - 1];
  const u = Math.min(1, Math.max(0, (travelled - segment.offset) / segment.length));
  const point = segment.curve.getPointAt(u);
  const tangent = segment.curve.getTangentAt(u);
  const direction = segment.leg.reverse ? -1 : 1;
  return {
    x: point.x,
    z: point.z,
    heading: Math.atan2(-tangent.z * direction, tangent.x * direction),
    stop: t >= run.arrive ? run.stop : null,
    hidden: Boolean(segment.leg.hidden),
    portal: segment.leg.portal,
  };
}

export function stopTime(plan: Plan, stop: string): number {
  const run = plan.runs.find((candidate) => candidate.stop === stop);
  if (!run) throw new Error(`route ${plan.route.name} has no stop ${stop}`);
  return run.arrive;
}

export function footprintsOverlap(a: Pose, b: Pose, fa: Footprint, fb: Footprint, gap: number): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const axes = [a.heading, a.heading + Math.PI / 2, b.heading, b.heading + Math.PI / 2];
  return axes.every((angle) => {
    const ux = Math.cos(angle);
    const uz = -Math.sin(angle);
    const extent = (pose: Pose, footprint: Footprint) =>
      (Math.abs(Math.cos(pose.heading) * ux - Math.sin(pose.heading) * uz) * footprint.length) / 2 +
      (Math.abs(Math.sin(pose.heading) * ux + Math.cos(pose.heading) * uz) * footprint.width) / 2;
    return Math.abs(dx * ux + dz * uz) < extent(a, fa) + extent(b, fb) + gap;
  });
}

export interface FleetMember {
  plan: Plan;
  footprint: Footprint;
}

export interface FleetSchedule {
  plans: Plan[];
  offsets: number[];
  period: number;
}

export interface FleetOptions {
  gap?: number;
  resolution?: number;
}

export function scheduleFleet(members: readonly FleetMember[], { gap = 0.3, resolution = 0.05 }: FleetOptions = {}): FleetSchedule {
  const period = Math.max(...members.map((member) => member.plan.period));
  const plans = members.map((member) => withPeriod(member.plan, period));
  const steps = Math.ceil(period / resolution);
  const tracks = plans.map((plan) => Array.from({ length: steps }, (_, k) => poseAt(plan, k * resolution)));
  const routeSizes = new Map<string, number>();
  const routeIndex = members.map((member) => {
    const index = routeSizes.get(member.plan.route.name) ?? 0;
    routeSizes.set(member.plan.route.name, index + 1);
    return index;
  });

  const shifts: number[] = [];
  members.forEach((member, i) => {
    const preferred = Math.round((routeIndex[i] * steps) / (routeSizes.get(member.plan.route.name) ?? 1));
    const candidates = Array.from({ length: steps }, (_, k) => k).sort(
      (a, b) => circularDistance(a, preferred, steps) - circularDistance(b, preferred, steps),
    );
    const shift = candidates.find((candidate) =>
      shifts.every((other, j) => !tracksCollide(tracks[i], candidate, member.footprint, tracks[j], other, members[j].footprint, gap)),
    );
    if (shift === undefined) throw new Error(`no collision-free departure for vehicle ${i} on ${member.plan.route.name}`);
    shifts.push(shift);
  });
  return { plans, offsets: shifts.map((shift) => shift * resolution), period };
}

function circularDistance(a: number, b: number, size: number): number {
  const d = Math.abs(a - b) % size;
  return Math.min(d, size - d);
}

function tracksCollide(a: Pose[], shiftA: number, fa: Footprint, b: Pose[], shiftB: number, fb: Footprint, gap: number): boolean {
  const steps = a.length;
  for (let k = 0; k < steps; k++) {
    const pa = a[(k + shiftA) % steps];
    const pb = b[(k + shiftB) % steps];
    if (pa.hidden || pb.hidden) continue;
    if (Math.max(Math.abs(pa.x - pb.x), Math.abs(pa.z - pb.z)) > fa.length + fb.length + 2 * gap) continue;
    if (footprintsOverlap(pa, pb, fa, fb, gap)) return true;
  }
  return false;
}

export function minimumGap(schedule: FleetSchedule, footprints: readonly Footprint[], resolution = 0.05): number {
  let smallest = Infinity;
  for (let t = 0; t < schedule.period; t += resolution) {
    const poses = schedule.plans.map((plan, i) => poseAt(plan, t + schedule.offsets[i]));
    poses.forEach((a, i) =>
      poses.slice(i + 1).forEach((b, j) => {
        if (a.hidden || b.hidden) return;
        smallest = Math.min(smallest, separation(a, b, footprints[i], footprints[i + 1 + j]));
      }),
    );
  }
  return smallest;
}

function separation(a: Pose, b: Pose, fa: Footprint, fb: Footprint): number {
  let low = -Math.max(fa.length, fb.length);
  let high = Math.hypot(a.x - b.x, a.z - b.z);
  if (footprintsOverlap(a, b, fa, fb, low)) return low;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (footprintsOverlap(a, b, fa, fb, mid)) high = mid;
    else low = mid;
  }
  return low;
}

export interface DriveProfile {
  travelAt(time: number): number;
  activeAt(time: number): boolean;
}

export interface DriveOptions {
  idle?: number;
  resolution?: number;
}

export function driveProfile(active: (time: number) => boolean, period: number, { speed, accel }: Motion, { idle = 0, resolution = 1 / 120 }: DriveOptions = {}): DriveProfile {
  const steps = Math.ceil(period / resolution);
  const flags = Array.from({ length: steps }, (_, k) => active(k * resolution));
  const travel = new Float64Array(steps + 1);
  let velocity = 0;
  let distance = 0;
  for (let pass = 0; pass < 2; pass++) {
    distance = 0;
    for (let k = 0; k < steps; k++) {
      travel[k] = distance;
      const target = flags[k] ? speed : speed * idle;
      velocity += Math.max(-accel * resolution, Math.min(accel * resolution, target - velocity));
      distance += velocity * resolution;
    }
    travel[steps] = distance;
  }
  const perPeriod = travel[steps];
  return {
    travelAt(time) {
      const cycles = Math.floor(time / period);
      const local = (time - cycles * period) / resolution;
      const k = Math.min(steps - 1, Math.floor(local));
      const f = local - k;
      return cycles * perPeriod + travel[k] * (1 - f) + travel[k + 1] * f;
    },
    activeAt(time) {
      const local = ((time % period) + period) % period;
      return flags[Math.min(steps - 1, Math.floor(local / resolution))];
    },
  };
}

export interface LoopStop {
  name: string;
  at: Vec2;
  dwell: number;
}

export interface LoopOptions {
  spacing?: number;
  reverse?: boolean;
  lane?: number;
}

export function loopRoute(name: string, loop: readonly Vec2[], stops: readonly LoopStop[], { spacing = 0.25, reverse = false, lane = 0 }: LoopOptions = {}): Route {
  const curve = smoothCurve(loop, 0, { closed: true });
  const count = Math.max(8, Math.round(curve.getLength() / spacing));
  const samples = Array.from({ length: count }, (_, i) => {
    const point = curve.getPointAt(i / count);
    return [point.x, point.z] as const;
  });
  const directed = reverse ? [...samples].reverse() : samples;
  const dense = lane ? offsetPoints(directed, lane, true) : directed;
  const nearest = (at: Vec2) => dense.reduce((best, [x, z], i) => (Math.hypot(x - at[0], z - at[1]) < Math.hypot(dense[best][0] - at[0], dense[best][1] - at[1]) ? i : best), 0);
  const marks = stops.map((stop) => ({ stop, index: nearest(stop.at) })).sort((a, b) => a.index - b.index);
  const legs = marks.map(({ stop, index }, i) => {
    const start = marks[(i - 1 + marks.length) % marks.length].index;
    const span = (index - start + count) % count || count;
    const path = Array.from({ length: span + 1 }, (_, k) => dense[(start + k) % count]);
    return { path, stop: stop.name, dwell: stop.dwell };
  });
  return { name, legs };
}
