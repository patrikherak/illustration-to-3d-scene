import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, type CatmullRomCurve3, Color, CylinderGeometry, type InstancedMesh, Matrix4, Quaternion, TubeGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useSceneClock } from './clock.ts';
import { curveThrough, ribbonGeometry, wallGeometry } from './geometry.ts';
import type { Vec3 } from './iso.ts';
import { makeMaterial, scrollTextures, type Surface } from './surface.ts';

export interface TrackSurface {
  width: number;
  surface: Surface;
  tile?: number;
  sides?: { depth: number; surface: Surface };
}

export interface TrackLine {
  radius: number;
  color: string;
}

export interface ItemStyle {
  spacing: number;
  size: Vec3;
  colors: readonly string[];
  hang?: number;
  window?: string;
  roughness?: number;
}

export interface TrackProps {
  points: readonly Vec3[];
  closed?: boolean;
  tension?: number;
  travel?: (time: number) => number;
  speed?: number;
  ribbon?: TrackSurface;
  line?: TrackLine;
  items?: ItemStyle;
}

const FADE = 0.35;

export function Track({ points, closed = false, tension, travel, speed = 0.5, ribbon, line, items }: TrackProps) {
  const curve = useMemo(() => curveThrough(points, { closed, tension }), [points, closed, tension]);
  const distanceAt = travel ?? ((time: number) => time * speed);
  return (
    <group>
      {ribbon && <Ribbon curve={curve} ribbon={ribbon} distanceAt={distanceAt} />}
      {line && <Line curve={curve} line={line} />}
      {items && <Items curve={curve} closed={closed} style={items} distanceAt={distanceAt} />}
    </group>
  );
}

function Ribbon({ curve, ribbon, distanceAt }: { curve: CatmullRomCurve3; ribbon: TrackSurface; distanceAt: (time: number) => number }) {
  const clock = useSceneClock();
  const tile = ribbon.tile ?? ribbon.width;
  const geometry = useMemo(() => ribbonGeometry(curve, ribbon.width, tile), [curve, ribbon.width, tile]);
  const material = useMemo(() => makeMaterial({ ...ribbon.surface, tile: 1 }), [ribbon.surface]);
  const sides = useMemo(
    () => (ribbon.sides ? [ribbon.width / 2, -ribbon.width / 2].map((offset) => wallGeometry(curve, offset, ribbon.sides?.depth ?? 0)) : []),
    [curve, ribbon.width, ribbon.sides],
  );
  const sideMaterial = useMemo(() => (ribbon.sides ? makeMaterial(ribbon.sides.surface) : null), [ribbon.sides]);
  useFrame(() => scrollTextures(material, -distanceAt(clock.time) / tile));
  return (
    <group>
      <mesh geometry={geometry} material={material} receiveShadow />
      {sideMaterial && sides.map((side, i) => <mesh key={i} geometry={side} material={sideMaterial} castShadow />)}
    </group>
  );
}

function Line({ curve, line }: { curve: CatmullRomCurve3; line: TrackLine }) {
  const geometry = useMemo(() => new TubeGeometry(curve, Math.ceil(curve.getLength() * 6), line.radius, 6, false), [curve, line.radius]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={line.color} roughness={0.4} metalness={0.6} />
    </mesh>
  );
}

interface ItemsProps {
  curve: CatmullRomCurve3;
  closed: boolean;
  style: ItemStyle;
  distanceAt: (time: number) => number;
}

function Items({ curve, closed, style, distanceAt }: ItemsProps) {
  const clock = useSceneClock();
  const body = useRef<InstancedMesh>(null);
  const glass = useRef<InstancedMesh>(null);
  const hanger = useRef<InstancedMesh>(null);
  const length = useMemo(() => curve.getLength(), [curve]);
  const count = closed ? Math.max(1, Math.round(length / style.spacing)) : Math.floor(length / style.spacing) + 1;
  const spacing = closed ? length / count : style.spacing;
  const loop = count * spacing;
  const hang = style.hang ?? 0;
  const [sx, sy, sz] = style.size;
  const geometries = useMemo(() => {
    const radius = Math.min(sx, sy, sz) * 0.18;
    return {
      body: new RoundedBoxGeometry(sx, sy, sz, 3, radius).translate(0, hang ? -hang - sy / 2 : sy / 2, 0),
      glass: new BoxGeometry(sx * 1.02, sy * 0.32, sz * 1.02).translate(0, hang ? -hang - sy * 0.38 : sy * 0.62, 0),
      hanger: new CylinderGeometry(0.025, 0.025, hang, 6).translate(0, -hang / 2, 0),
    };
  }, [sx, sy, sz, hang]);
  const scratch = useMemo(() => ({ matrix: new Matrix4(), rotation: new Quaternion(), scale: new Vector3(), up: new Vector3(0, 1, 0) }), []);

  useLayoutEffect(() => {
    const color = new Color();
    for (let i = 0; i < count; i++) body.current?.setColorAt(i, color.set(style.colors[i % style.colors.length]));
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true;
  }, [count, style.colors]);

  useFrame(() => {
    const travelled = distanceAt(clock.time);
    const targets = [body.current, glass.current, hanger.current].filter((mesh): mesh is InstancedMesh => mesh !== null);
    for (let i = 0; i < count; i++) {
      const s = (((travelled + i * spacing) % loop) + loop) % loop;
      const visible = closed || s <= length;
      const u = Math.min(1, s / length);
      const point = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u);
      const grow = !visible ? 0 : closed ? 1 : Math.min(1, s / FADE, (length - s) / FADE);
      scratch.rotation.setFromAxisAngle(scratch.up, Math.atan2(-tangent.z, tangent.x));
      scratch.scale.setScalar(Math.max(grow, 1e-4));
      scratch.matrix.compose(point, scratch.rotation, scratch.scale);
      for (const mesh of targets) mesh.setMatrixAt(i, scratch.matrix);
    }
    for (const mesh of targets) mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={body} args={[geometries.body, undefined, count]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial roughness={style.roughness ?? 0.45} />
      </instancedMesh>
      {style.window && (
        <instancedMesh ref={glass} args={[geometries.glass, undefined, count]} frustumCulled={false}>
          <meshStandardMaterial color={style.window} roughness={0.15} metalness={0.2} />
        </instancedMesh>
      )}
      {hang > 0 && (
        <instancedMesh ref={hanger} args={[geometries.hanger, undefined, count]} castShadow frustumCulled={false}>
          <meshStandardMaterial color="#3f4955" roughness={0.5} metalness={0.5} />
        </instancedMesh>
      )}
    </group>
  );
}
