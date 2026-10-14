import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CanvasTexture, Color, type MeshStandardMaterial, Object3D, SRGBColorSpace } from 'three';
import {
  barkTexture,
  Building,
  Fleet,
  foliageTexture,
  Forest,
  Ground,
  iceTexture,
  lifted,
  Mast,
  noiseTexture,
  offsetPoints3,
  type Quality,
  rippleTexture,
  rockTexture,
  shingleTexture,
  Snowfall,
  SoftEnvironment,
  type Surface,
  Track,
  trackTexture,
  useSceneClock,
  windowRow,
  woodTexture,
} from '../kit/index.ts';
import { cable, chalets, hotel, island, lake, light, palette, pines, pond, pylons, road, stations, stream, summit } from './alpine.ts';
import { busStyles, liftDrive, schedule, streamSpeed } from './routes.ts';

const snow: Surface = { color: palette.snow, textures: noiseTexture({ cells: 3, octaves: 4, amplitude: 0.045, sparkle: 0.05, roughness: 0.8, bump: 0.5, seed: 2 }), tile: 9, normalScale: 0.25 };
const glacier: Surface = { ...snow, color: palette.glacier };
const rock: Surface = { color: palette.rock, textures: rockTexture(), tile: 3.5, normalScale: 0.5 };
const ice: Surface = { color: palette.ice, textures: iceTexture(), tile: 6, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06, normalScale: 0.3 };
const water: Surface = { color: palette.water, textures: rippleTexture(), roughness: 0.25, metalness: 0.05, normalScale: 0.6 };
const gravel: Surface = { color: palette.road, textures: trackTexture(), roughness: 0.95, normalScale: 0.6 };
const wood: Surface = { color: palette.wood, textures: woodTexture({ planks: 8 }), tile: 1.6, normalScale: 0.8 };
const darkWood: Surface = { color: palette.wood_dark, textures: woodTexture({ planks: 10, seed: 6 }), tile: 1.6, normalScale: 0.8 };
const plaster: Surface = { color: palette.plaster, textures: noiseTexture({ cells: 6, octaves: 3, amplitude: 0.035, seed: 8 }), tile: 3, normalScale: 0.12 };
const stationWall: Surface = { ...plaster, color: palette.station };
const slate: Surface = { color: palette.station_roof, textures: noiseTexture({ cells: 6, amplitude: 0.08, seed: 9 }), tile: 2, roughness: 0.7 };
const glass: Surface = { color: palette.window, emissive: '#ff9f2e', emissiveIntensity: 0.45, roughness: 0.3 };
const frame: Surface = { color: palette.frame, roughness: 0.8 };
const door: Surface = { color: palette.door, textures: woodTexture({ planks: 6, seed: 4 }), tile: 1 };
const opening: Surface = { color: palette.opening, roughness: 1 };
const steel: Surface = { color: palette.steel, roughness: 0.45, metalness: 0.6 };
const needles: Surface = { color: palette.pine, textures: foliageTexture(), roughness: 0.85, normalScale: 0.8 };
const pineSnow: Surface = { color: palette.snow, textures: noiseTexture({ cells: 4, amplitude: 0.05, sparkle: 0.06, seed: 12 }), roughness: 0.7 };
const bark: Surface = { color: palette.trunk, textures: barkTexture() };
const chimney: Surface = { color: palette.chimney, textures: rockTexture({ seed: 5 }), tile: 1 };
const roofs = new Map([hotel.roof, ...chalets.map((chalet) => chalet.roof)].map((color) => [color, { color, textures: shingleTexture(), tile: 1.4, roughness: 0.7, normalScale: 0.9 } satisfies Surface]));

const SHADOW_EXTENT = 20;

function Lights({ quality }: { quality: Quality }) {
  const target = useMemo(() => new Object3D(), []);
  const distance = 30;
  const [lx, ly, lz] = light.sun;
  return (
    <>
      <ambientLight color={new Color(...light.ambient).multiplyScalar(1 / Math.max(...light.ambient))} intensity={Math.max(...light.ambient) * Math.PI * 0.9} />
      <primitive object={target} position={[0, 0, -1]} />
      <directionalLight
        target={target}
        color={new Color(...light.sunColor).multiplyScalar(1 / Math.max(...light.sunColor))}
        intensity={Math.max(...light.sunColor) * Math.PI}
        position={[lx * distance, ly * distance, -1 + lz * distance]}
        castShadow
        shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-intensity={0.5}
        shadow-radius={5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={80}
      />
    </>
  );
}

function Sky({ top, bottom }: { top: string; bottom: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is not available');
    const from = new Color(top);
    const to = new Color(bottom);
    for (let y = 0; y < 512; y++) {
      const t = (y / 511) ** 0.8;
      const mixed = from.clone().lerp(to, t);
      context.fillStyle = `#${mixed.getHexString()}`;
      context.fillRect(0, y, 2, 1);
    }
    const sky = new CanvasTexture(canvas);
    sky.colorSpace = SRGBColorSpace;
    return sky;
  }, [top, bottom]);
  return <primitive attach="background" object={texture} />;
}

function StationLamp() {
  const clock = useSceneClock();
  const material = useRef<MeshStandardMaterial>(null);
  const { center, size } = stations.valley;
  useFrame(() => {
    const active = liftDrive.activeAt(clock.time);
    material.current?.emissive.set(active ? '#3ddc84' : '#f5a524');
    if (material.current) material.current.emissiveIntensity = active ? 3 : 1.2;
  });
  return (
    <mesh position={[center[0] + size[0] / 2 + 0.08, 1.35, center[1]]}>
      <sphereGeometry args={[0.11, 16, 12]} />
      <meshStandardMaterial ref={material} color="#000000" />
    </mesh>
  );
}

function Hotel() {
  const [cx, cz] = hotel.center;
  const [dx, dz] = hotel.size;
  const half = hotel.height / 2;
  return (
    <Building
      center={hotel.center}
      size={hotel.size}
      walls={[
        { height: half, surface: plaster },
        { height: half, surface: wood },
      ]}
      openings={[
        ...windowRow('+z', cx - dx / 2, cx + dx / 2, 4, 0.55, 1.1, glass, frame),
        ...windowRow('+z', cx - dx / 2, cx + dx / 2, 6, 1.85, 2.45, glass, frame),
        ...windowRow('+x', cz - dz / 2, cz + dz / 2, 3, 0.55, 1.1, glass, frame),
        ...windowRow('+x', cz - dz / 2, cz + dz / 2, 3, 1.85, 2.45, glass, frame),
        { face: '+z', from: cx - 0.28, to: cx + 0.28, bottom: 0, top: 1.0, surface: door },
      ]}
      roof={{ ridge: hotel.ridge, axis: 'x', overhang: 0.25, surface: roofs.get(hotel.roof) ?? wood, gable: darkWood }}
    />
  );
}

function Chalet({ chalet }: { chalet: (typeof chalets)[number] }) {
  const [cx, cz] = chalet.center;
  const [dx, dz] = chalet.size;
  const chimneyX = chalet.axis === 'x' ? 0.45 : -0.35;
  return (
    <Building
      center={chalet.center}
      size={chalet.size}
      walls={[{ height: chalet.height, surface: wood }]}
      openings={[...windowRow('+z', cx - dx / 2, cx + dx / 2, 2, 0.45, 0.95, glass, frame), ...windowRow('+x', cz - dz / 2, cz + dz / 2, 2, 0.45, 0.95, glass, frame)]}
      roof={{ ridge: chalet.ridge, axis: chalet.axis, surface: roofs.get(chalet.roof) ?? wood, gable: darkWood }}
    >
      <mesh position={[chimneyX, chalet.height + chalet.ridge * 0.45 + 0.275, -0.3]} castShadow>
        <boxGeometry args={[0.3, 0.55, 0.3]} />
        <meshStandardMaterial color={palette.chimney} map={chimney.textures?.map} roughness={0.9} />
      </mesh>
    </Building>
  );
}

function Station({ station, front }: { station: typeof stations.valley; front: boolean }) {
  const [cx, cz] = station.center;
  const { height, base } = station;
  return (
    <Building
      center={station.center}
      size={station.size}
      base={base}
      walls={[{ height, surface: stationWall }]}
      openings={[
        ...(front ? [{ face: '+z' as const, from: cx - 0.7, to: cx + 0.7, bottom: height * 0.35, top: height * 0.92, surface: opening }] : []),
        { face: '+x', from: cz - 0.3, to: cz + 0.3, bottom: 0, top: 1.0, surface: door },
      ]}
      cap={{ thickness: 0.18, overhang: 0.2, surface: slate }}
    />
  );
}

function Gondola() {
  const up = useMemo(() => offsetPoints3(cable.points, cable.gauge / 2), []);
  const down = useMemo(() => offsetPoints3(cable.points, -cable.gauge / 2), []);
  const cabins = { spacing: 2.6, size: [0.5, 0.55, 0.44] as const, colors: [palette.cabin_a, palette.cabin_b], hang: cable.hang, window: palette.opening, roughness: 0.35 };
  const line = { radius: 0.03, color: palette.cable };
  const reverse = (time: number) => cabins.spacing / 2 - liftDrive.travelAt(time);
  return (
    <group>
      <Track points={up} tension={0} line={line} items={cabins} travel={liftDrive.travelAt} />
      <Track points={down} tension={0} line={line} items={cabins} travel={reverse} />
      {pylons.map((pylon, i) => (
        <Mast key={i} position={pylon.position} height={pylon.height} arm={cable.gauge + 0.5} surface={steel} />
      ))}
    </group>
  );
}

export function AlpineScene({ quality, snowfall }: { quality: Quality; snowfall: boolean }) {
  const floes = { spacing: 1.7, size: [0.34, 0.05, 0.26] as const, colors: ['#f4f8fb', '#e6eef5'], roughness: 0.6 };
  return (
    <>
      <Sky top={palette.sky_top} bottom={palette.sky_bottom} />
      <SoftEnvironment intensity={0.1} />
      <Lights quality={quality} />
      <Ground
        outline={island.outline}
        surface={snow}
        side={rock}
        thickness={island.thickness}
        cornerRadius={0.8}
        areas={[
          { outline: lake, surface: ice },
          { outline: pond, surface: ice },
        ]}
        paths={[{ points: road.loop, width: road.width, surface: gravel, closed: true, tile: road.width }]}
        dropShadow={{ depth: 2.4, opacity: 0.32, blur: 1.4, color: '#4b4d6e' }}
      />
      <Ground outline={summit.outline} surface={glacier} side={rock} thickness={summit.height + 0.1} elevation={summit.height} cornerRadius={0.4} />
      <Track
        points={lifted(stream.points, 0.02)}
        ribbon={{ width: stream.width, surface: water, tile: 1.2 }}
        items={floes}
        speed={streamSpeed}
      />
      <Hotel />
      {chalets.map((chalet, i) => (
        <Chalet key={i} chalet={chalet} />
      ))}
      <Station station={stations.valley} front={false} />
      <Station station={stations.summit} front />
      <StationLamp />
      <Gondola />
      <Forest pines={pines} needles={needles} snow={pineSnow} bark={bark} />
      <Fleet schedule={schedule} styles={busStyles} />
      {snowfall && <Snowfall min={[-16, 0, -15]} max={[17, 11, 13]} count={420} size={4.5} speed={0.8} />}
    </>
  );
}
