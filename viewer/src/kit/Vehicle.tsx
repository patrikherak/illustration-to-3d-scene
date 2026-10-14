import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BoxGeometry, CylinderGeometry, type Group, Plane, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useSceneClock } from './clock.ts';
import { type FleetSchedule, type Footprint, type Plan, type Pose, poseAt } from './schedule.ts';
import { makeMaterial } from './surface.ts';

export interface VehicleStyle extends Footprint {
  height: number;
  color: string;
  roofColor?: string;
  glassColor?: string;
  tyreColor?: string;
}

const CLEARANCE = 0.2;
const WHEEL_RADIUS = 0.19;
const NO_CLIP = new Plane(new Vector3(0, 1, 0), 1e4);
const PORTAL_REACH = 3;

function busParts({ length, width, height }: VehicleStyle) {
  const body = height - CLEARANCE;
  return {
    body: { geometry: new RoundedBoxGeometry(length, body * 0.9, width, 3, 0.12), y: CLEARANCE + body * 0.45 },
    roof: { geometry: new RoundedBoxGeometry(length * 0.94, body * 0.16, width * 0.9, 3, 0.07), y: CLEARANCE + body * 0.92 },
    windows: { geometry: new BoxGeometry(length * 0.86, body * 0.3, width + 0.02), x: -length * 0.04, y: CLEARANCE + body * 0.62 },
    windscreen: { geometry: new BoxGeometry(0.03, body * 0.36, width * 0.86), x: length / 2 + 0.005, y: CLEARANCE + body * 0.6 },
    stripe: { geometry: new BoxGeometry(length * 0.98, 0.07, width + 0.02), y: CLEARANCE + body * 0.3 },
    wheel: new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.14, 16).rotateX(Math.PI / 2),
    wheels: [-1, 1].flatMap((end) => [-1, 1].map((side) => [end * (length / 2 - 0.4), WHEEL_RADIUS, side * (width / 2 - 0.05)] as const)),
    lamp: new BoxGeometry(0.03, 0.08, 0.14),
    headlights: [-1, 1].map((side) => [length / 2 + 0.01, CLEARANCE + 0.16, side * (width / 2 - 0.15)] as const),
    taillights: [-1, 1].map((side) => [-length / 2 - 0.01, CLEARANCE + 0.2, side * (width / 2 - 0.12)] as const),
  };
}

export function Bus({ style, clip = NO_CLIP }: { style: VehicleStyle; clip?: Plane }) {
  const parts = useMemo(() => busParts(style), [style]);
  const materials = useMemo(() => {
    const planes = [clip];
    return {
      body: makeMaterial({ color: style.color, roughness: 0.35, clearcoat: 0.6 }, planes),
      roof: makeMaterial({ color: style.roofColor ?? '#f7fafc', roughness: 0.8 }, planes),
      glass: makeMaterial({ color: style.glassColor ?? '#2b3a4a', roughness: 0.1, metalness: 0.3 }, planes),
      stripe: makeMaterial({ color: '#ffffff', roughness: 0.5 }, planes),
      tyre: makeMaterial({ color: style.tyreColor ?? '#22324a', roughness: 0.9 }, planes),
      head: makeMaterial({ color: '#fff6d8', emissive: '#fff1c1', emissiveIntensity: 2.5 }, planes),
      tail: makeMaterial({ color: '#7a1f1f', emissive: '#ff3b30', emissiveIntensity: 2 }, planes),
    };
  }, [style, clip]);
  return (
    <group>
      <mesh geometry={parts.body.geometry} position={[0, parts.body.y, 0]} material={materials.body} castShadow receiveShadow />
      <mesh geometry={parts.roof.geometry} position={[0, parts.roof.y, 0]} material={materials.roof} castShadow />
      <mesh geometry={parts.windows.geometry} position={[parts.windows.x, parts.windows.y, 0]} material={materials.glass} />
      <mesh geometry={parts.windscreen.geometry} position={[parts.windscreen.x, parts.windscreen.y, 0]} material={materials.glass} />
      <mesh geometry={parts.stripe.geometry} position={[0, parts.stripe.y, 0]} material={materials.stripe} />
      {parts.wheels.map((position, i) => (
        <mesh key={`w${i}`} geometry={parts.wheel} position={position} material={materials.tyre} castShadow />
      ))}
      {parts.headlights.map((position, i) => (
        <mesh key={`h${i}`} geometry={parts.lamp} position={position} material={materials.head} />
      ))}
      {parts.taillights.map((position, i) => (
        <mesh key={`t${i}`} geometry={parts.lamp} position={position} material={materials.tail} />
      ))}
    </group>
  );
}

function aimClip(clip: Plane, { x, z, portal }: Pose) {
  if (!portal || Math.hypot(x - portal.point[0], z - portal.point[1]) > (portal.reach ?? PORTAL_REACH)) {
    clip.copy(NO_CLIP);
    return;
  }
  clip.normal.set(portal.normal[0], 0, portal.normal[1]).normalize();
  clip.constant = -(clip.normal.x * portal.point[0] + clip.normal.z * portal.point[1]);
}

export function Vehicle({ plan, offset, style }: { plan: Plan; offset: number; style: VehicleStyle }) {
  const clock = useSceneClock();
  const group = useRef<Group>(null);
  const clip = useMemo(() => NO_CLIP.clone(), []);
  useFrame(() => {
    const target = group.current;
    if (!target) return;
    const pose = poseAt(plan, clock.time + offset);
    target.visible = !pose.hidden;
    target.position.set(pose.x, 0, pose.z);
    target.rotation.y = pose.heading;
    aimClip(clip, pose);
  });
  return (
    <group ref={group}>
      <Bus style={style} clip={clip} />
    </group>
  );
}

export function Fleet({ schedule, styles }: { schedule: FleetSchedule; styles: readonly VehicleStyle[] }) {
  return (
    <group>
      {schedule.plans.map((plan, i) => (
        <Vehicle key={i} plan={plan} offset={schedule.offsets[i]} style={styles[i]} />
      ))}
    </group>
  );
}
