---
name: illustration-to-3d-scene
description: Rebuild a flat isometric illustration (a PNG infographic, map or diagram) as an animated, textured real-time 3D scene in React Three Fiber, built procedurally from code primitives and checked against the image in a one-minute render loop. Use when someone hands you an isometric drawing and wants it live, animated, sharp at 4K, or running unattended on a kiosk.
---

# Illustration to 3D scene

The scene is code: no ML, no Blender, no artwork cut out of the drawing. The illustration is the
measurement source and the acceptance test. Work through the steps below and do not start on animation before the
still matches.

```
PNG ─► calibrate ─► measure ─► primitives + textures ─► verify loop ─► animation ─► kiosk hardening
```

## 0. Setup (once)

```bash
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
(cd viewer && npm install)
(cd verify && npm install && npx playwright install chromium)
(cd viewer && npm run dev)                      # http://localhost:5188, leave it running
```

Put the illustration at `examples/<name>/reference.png`. Copy `viewer/src/example/` as the starting point;
the kit in `viewer/src/kit/` stays generic. `examples/alpine/` is the worked example: `make_image.py`
generates a textured synthetic illustration and its ground truth, `measure.sh` runs steps 1–2.

## 1. Calibrate the camera

Isometric art is an orthographic camera at 45° azimuth and some elevation (30° is common, true isometric
is 35.26°, 2:1 pixel art is 26.57°).

1. Pick 6–10 sharp corners whose 3D position you can name: base corners of buildings, the corners of a
   raised plate at its foot and top. Read them from zoomed crops, never from a downscaled view.
2. Declare the unit with one known size and write `points.json` (`pixel` + `world` per point; y up, x to
   the lower right, z to the lower left).
3. `tools/calibrate.py examples/<name>/points.json --out examples/<name>/calibration.json`

It fits anchor, scale and elevation (or `--elevation` to fix it) and prints the residual. **Above about
1 px something is mislabelled**: the per-point lines show which. The example fits 10 points at 0.27 px.

`tools/iso.py` and `viewer/src/kit/iso.ts` implement the same mapping. To place anything visible in the
drawing, read its pixel and call `iso(px, py, height)`.

## 2. Measure the layout

```bash
.venv/bin/python tools/layout.py examples/<name>/reference.png --calibration examples/<name>/calibration.json \
  --region ground=#f1f3f6:9 --hull ground --region summit=#dbe5ef:6@2.6 --hull summit \
  --region lake=#c4e1f2:7 --path road=#d6c5af:8 --path stream=#50a1d3:20 \
  --bridge 15 --min-area 800 --debug shots/layout-debug.png --out examples/<name>/layout.json
```

- `--region NAME=#RRGGBB:TOL@HEIGHT` turns a colour into polygons (CIELAB distance on a 0–255 scale). The
  height matters for raised plates: their top is measured at that height.
- `--hull NAME` returns one convex hull over all parts of a region: use it for plates cut up by buildings,
  trees and shadows.
- `--path NAME=#RRGGBB:TOL@HEIGHT` gives the centreline of a band, measured in a top view so widths are
  true; a ring is detected and returned with `"closed": true`.
- `--bridge PX` closes gaps left by thin things crossing a band (poles, cables) before skeletonising.
- Sample the colours from the image itself (median of a small window), not from the palette: lighting and
  texture shift them.
- Open `--debug` every time. Sizes of buildings and openings come from crops with the ruler of
  `overlay.py edges`, kept as data.

## 3. Build from primitives and textures

| Kit | What it is |
|---|---|
| `IsoCamera`, `IsoLabels` | orthographic camera from the calibration; DOM labels placed through it |
| `Ground` | extruded plate (`elevation` for raised ones), flat areas, ribbon paths, soft drop shadow |
| `Building`, `windowRow` | stacked wall bands, openings with frames, gable or flat roofs |
| `Forest` | instanced pines with snow caps |
| `Mast` | tapered pole with a crossbar (pylons, lamp posts) |
| `Track` | curve that carries items: a moving ribbon (stream, walkway) or a line with hanging items (gondola) |
| `Bus`, `Vehicle`, `Fleet` | vehicle model, one scheduled vehicle, a scheduled fleet |
| `Snowfall` | deterministic falling snow |
| `Effects`, `SoftEnvironment` | N8AO, Bloom, SMAA, adaptive pixel ratio; procedural room environment light |
| `noiseTexture`, `woodTexture`, `shingleTexture`, `rockTexture`, `iceTexture`, `rippleTexture`, `barkTexture`, `foliageTexture`, `trackTexture` | canvas-generated colour, normal and roughness maps, tileable, cached |

- Surfaces are data (`{ color, textures, tile, roughness, normalScale, clearcoat, emissive }`); keep them as
  module constants so materials are shared.
- `<Canvas orthographic flat>`: no tone mapping, so palette colours stay what the art says.
- Derive the light from the drawing (top / left / right face brightness), then check: sample the same
  world points in the reference and the render and compare the ratios. Environment light brightens
  vertical faces a lot; keep it low (about 0.1).
- If the drawing has textures, generate the same motifs in both: planks, shingles, grain. Keep texture
  amplitude small enough that the colour regions still measure.

## 4. Verify loop (about a minute per round)

```bash
node verify/shoot.mjs compare --reference examples/<name>/reference.png --out shots/r01 --t 1
```

`compare` writes `render.png`, `edges.png` (reference edges in red over the render, with a pixel ruler),
`side.png` and prints an edge score. Read the images, fix numbers, not looks. Other modes:

- `still --t 3`, `sequence --times 0,1.5,3 --sheet --crop X0 Y0 X1 Y1` for animation checks
- `fps --size 3840x2160 [--uncapped] [--query quality=low]`
- `gif --reference PNG --out FILE --start T --seconds 7 --crop ...`: frames on the GPU, then
  `tools/animate.py` holds the reference, cross-fades into the render and back. A `.webp` output writes a
  lossy animated WebP (sharper, smaller, and not paused by GitHub's animated-GIF player). A `.gif` output
  uses one adaptive palette, Bayer-matrix dithering (stable from frame to frame, so textures do not crawl)
  and transparent deltas
- `kiosk <preview url>`: offline reload and reload after a lost WebGL context

The page exposes `window.__scene` (`seek`, `play`, `clock`, `renderer`, `dpr`). The script prints the
WebGL renderer: SwiftShader or llvmpipe means software rendering, do not judge edges or speed from it.
GPU flags: macOS `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` (default); Linux
`--use-angle=vulkan --enable-features=Vulkan --enable-gpu --ignore-gpu-blocklist`, or
`GPU_FLAGS="--use-gl=angle --use-angle=gl-egl --enable-gpu --ignore-gpu-blocklist"` without Vulkan.

## 5. Animation is computation

- `loopRoute(name, loop, stops)` turns a measured closed path plus stop positions into legs; `planRoute`
  makes a timetable at constant cruise speed with acceleration only at stops; `poseAt(plan, t)` is pure.
- `scheduleFleet` pads routes to one period and picks each vehicle's departure offset from the path
  lengths: even spacing when possible, and only offsets whose footprints never overlap over the whole
  period (following, merges, crossings, dwelling). No offset means the geometry is wrong; it throws.
- `driveProfile(condition, period, motion, { idle })` integrates a condition into travel with acceleration
  limits, e.g. the gondola runs at full speed while a bus waits at its station and at 35 % otherwise.
- Legs can pass through a wall (`portal`); the vehicle is clipped at the wall plane.
- Make `t = 0` a meaningful frame.

## 6. Kiosk hardening

Wired in `App.tsx`, `kit/kiosk.tsx` and `viewer/precache.ts`: precaching service worker, fullscreen
button that hides with the cursor, adaptive pixel ratio with a fallback to `quality=low`, reload on
`webglcontextlost` and after `?uptime=` hours. Check with `npm run build && npm run preview` and
`node verify/shoot.mjs kiosk http://localhost:5189/`.

## Pitfalls

- Anything in front of a band or an edge (closer to the camera, i.e. larger x + z) hides it in the image:
  roofs over a road behind them, a cabin over the road, buildings over the island's back edge. Lay out
  the illustration with that in mind, or complete hidden parts by hand.
- A background gradient can pass through the colour of something you measure; check the masks.
- White text halos and snow caps count as snow; keep them out of measured colours.
- `setDpr` is absolute: multiply by `devicePixelRatio`.
- A service worker matching cached module scripts needs `ignoreVary: true`.
- `PCFSoftShadowMap` is gone in recent three.js; use the default shadow map with `shadow.radius`.
- Error-diffusion dithering in a GIF makes static textures crawl around moving objects; use Bayer-matrix
  dithering with one palette for all frames.
