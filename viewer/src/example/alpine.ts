import calibrationJson from '../../../examples/alpine/calibration.json';
import layoutJson from '../../../examples/alpine/layout.json';
import referenceUrl from '../../../examples/alpine/reference.png';
import truthJson from '../../../examples/alpine/truth.json';
import { type Calibration, type IsoLabel, isoMapper, type Pine, type Vec2, type Vec3 } from '../kit/index.ts';

export { referenceUrl };

function pair(values: readonly number[]): Vec2 {
  return [values[0], values[1]];
}

function triple(values: readonly number[]): Vec3 {
  return [values[0], values[1], values[2]];
}

function vec2s(points: readonly (readonly number[])[]): Vec2[] {
  return points.map(pair);
}

function centroid(points: readonly Vec2[]): Vec2 {
  return [points.reduce((sum, [x]) => sum + x, 0) / points.length, points.reduce((sum, [, z]) => sum + z, 0) / points.length];
}

function nearestRegion(regions: readonly Vec2[][], near: Vec2): Vec2[] {
  const distance = (outline: Vec2[]) => Math.hypot(centroid(outline)[0] - near[0], centroid(outline)[1] - near[1]);
  return regions.reduce((best, outline) => (distance(outline) < distance(best) ? outline : best));
}

export const calibration: Calibration = {
  image: pair(calibrationJson.image),
  anchor: pair(calibrationJson.anchor),
  pxPerUnit: calibrationJson.pxPerUnit,
  elevationDeg: calibrationJson.elevationDeg,
};

export const iso = isoMapper(calibration);
export const palette = truthJson.palette;
export const light = { sun: triple(truthJson.light.sun), ambient: triple(truthJson.light.ambient), sunColor: triple(truthJson.light.sunColor) };

const iceRegions = layoutJson.regions.lake.map((region) => vec2s(region.world));
const measuredStream = vec2s(layoutJson.paths.stream[0].world);
const lakeCenter = pair(truthJson.lake.outline.reduce((sum, [x, z]) => [sum[0] + x / truthJson.lake.outline.length, sum[1] + z / truthJson.lake.outline.length], [0, 0]));
const pondCenter = centroid(vec2s(truthJson.pond.outline));
const streamFromLake = Math.hypot(measuredStream[0][0] - lakeCenter[0], measuredStream[0][1] - lakeCenter[1]) < Math.hypot(measuredStream[measuredStream.length - 1][0] - lakeCenter[0], measuredStream[measuredStream.length - 1][1] - lakeCenter[1]);

export const island = { outline: vec2s(layoutJson.regions.ground[0].world), thickness: truthJson.plateau.thickness };
export const summit = { outline: vec2s(layoutJson.regions.summit[0].world), height: truthJson.summit.height };
export const lake = nearestRegion(iceRegions, lakeCenter);
export const pond = nearestRegion(iceRegions, pondCenter);
export const stream = { points: streamFromLake ? measuredStream : [...measuredStream].reverse(), width: truthJson.stream.width };
export const road = { loop: vec2s(layoutJson.paths.road[0].world), width: truthJson.road.width };


export const hotel = { center: pair(truthJson.hotel.center), size: pair(truthJson.hotel.size), height: truthJson.hotel.height, ridge: truthJson.hotel.ridge, roof: truthJson.hotel.roof };
export const chalets = truthJson.chalets.map((chalet) => ({
  center: pair(chalet.center),
  size: pair(chalet.size),
  height: chalet.height,
  ridge: chalet.ridge,
  axis: chalet.axis === 'x' ? ('x' as const) : ('z' as const),
  roof: chalet.roof,
}));
export const stations = {
  valley: { center: pair(truthJson.stations.valley.center), size: pair(truthJson.stations.valley.size), height: truthJson.stations.valley.height, base: truthJson.stations.valley.base },
  summit: { center: pair(truthJson.stations.summit.center), size: pair(truthJson.stations.summit.size), height: truthJson.stations.summit.height, base: truthJson.stations.summit.base },
};
export const cable = { points: truthJson.cable.points.map(triple), gauge: truthJson.cable.gauge, hang: truthJson.cable.hang };
export const pylons = truthJson.pylons.map((pylon) => ({ position: pair(pylon.position), height: pylon.height }));
export const pines: Pine[] = truthJson.pines.map((pine) => ({ position: pair(pine.position), scale: pine.scale, base: pine.base }));
export const labels: IsoLabel[] = truthJson.labels.map((label) => ({ text: label.text, position: triple(label.position) }));
