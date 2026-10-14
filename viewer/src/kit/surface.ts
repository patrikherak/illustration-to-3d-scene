import { Color, MeshPhysicalMaterial, MeshStandardMaterial, type Plane, Vector2 } from 'three';
import { type TextureSet, tiled } from './textures.ts';

export interface Surface {
  color: string;
  textures?: TextureSet;
  tile?: number;
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export function makeMaterial(surface: Surface, clippingPlanes?: Plane[]): MeshStandardMaterial {
  const repeat = 1 / (surface.tile ?? 1);
  const textures = surface.textures;
  const common = {
    color: new Color(surface.color),
    roughness: surface.roughness ?? 0.9,
    metalness: surface.metalness ?? 0,
    map: textures ? tiled(textures.map, repeat) : null,
    normalMap: textures ? tiled(textures.normalMap, repeat) : null,
    roughnessMap: textures ? tiled(textures.roughnessMap, repeat) : null,
    normalScale: new Vector2(surface.normalScale ?? 1, surface.normalScale ?? 1),
    emissive: new Color(surface.emissive ?? '#000000'),
    emissiveIntensity: surface.emissiveIntensity ?? 0,
    clippingPlanes: clippingPlanes ?? null,
    clipShadows: Boolean(clippingPlanes),
  };
  if (surface.clearcoat !== undefined) {
    return new MeshPhysicalMaterial({ ...common, clearcoat: surface.clearcoat, clearcoatRoughness: surface.clearcoatRoughness ?? 0.1 });
  }
  return new MeshStandardMaterial(common);
}

const materials = new WeakMap<Surface, MeshStandardMaterial>();

export function sharedMaterial(surface: Surface): MeshStandardMaterial {
  const hit = materials.get(surface);
  if (hit) return hit;
  const made = makeMaterial(surface);
  materials.set(surface, made);
  return made;
}

export function scrollTextures(material: MeshStandardMaterial, offsetV: number) {
  for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
    if (texture) texture.offset.y = offsetV;
  }
}
