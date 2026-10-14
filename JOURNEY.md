# From a flat illustration to a live 3D scene: what did not work, and what did

The method in this repository came out of turning a large isometric infographic into an animated screen
that runs all day on a kiosk. The original showed buildings connected by roads and moving bands, with
small objects travelling along them. These are the lessons, written so they hold for any illustration of
that kind.

## 1. The 2D attempt: animate the drawing itself

The first idea was to keep the artwork and make parts of it move:

1. Cut each object out of the PNG (GrabCut seeded with a rough rectangle per object).
2. Fill the hole it left with inpainting, and later with patch-match synthesis.
3. Animate the cut-outs as sprites over the repaired background.

It failed on three counts:

- **Blurry.** The illustration was a fixed-resolution raster. Scaled to a 4K screen every edge went soft,
  and the cut-outs kept a halo of half-transparent background pixels that no matting setting removed.
- **The background never looked untouched.** Inpainting smears flat colour fields; patch-match copies
  texture that a flat illustration does not have. Every filled hole showed, worst where an object had
  covered an edge or a shadow.
- **The moving bands could not move.** A band drawn as stripes is part of the background. To move the
  stripes you have to redraw the band, and to move objects along it you need its exact path, width and
  everything in front of it. At that point you are rebuilding it anyway, in a medium that cannot do it.

Each fix created the next problem, and the result stayed "nearly right".

## 2. Switch: rebuild the whole scene in 3D, from code

An isometric illustration is an orthographic view of simple geometry: boxes, prisms, extruded outlines,
bands along curves, cones for trees. Rebuilding it from parametric primitives was faster and better:

- **Sharp at any resolution.** 4K is just a bigger canvas.
- **Everything can move.** A band is a ribbon with a scrolling texture; items ride the same curve.
- **Small.** No textures cut from the art, no models: a few hundred lines of data and components.
- **One camera aligns it all.** With an orthographic camera at the illustration's angle, the render can be
  laid over the original pixel for pixel, which turns the drawing into a precise acceptance test.

The cost is that you must know where things are, exactly.

## 3. Measure, don't eyeball

- **Calibrate the camera from named corners** and read the residual. Under a pixel means the drawing really
  is orthographic at that angle; more means a mislabelled point.
- **Read positions from pixels.** Once pixels map to world coordinates, a tree's position is the pixel of
  its trunk base, converted.
- **Measure areas and bands with colour masks** in a perceptual colour space; skeletonise bands in a top
  view (warp the mask with the calibration first), or their ends hook into corners.
- **Plates are occluded by what stands on them**; their outline is the convex hull of all visible parts.
- **Sizes from zoomed crops with a ruler**, converted through the calibration and kept as data.

## 4. Check the render against the drawing every round

A loop of about a minute: render on the real GPU at the illustration's size, overlay the illustration's
edges, put both side by side, read crops at 2–3× zoom. An edge score catches regressions; the images tell
you which number to change. Headless browsers without a GPU fall back to software rendering without
multisampling, so print the WebGL renderer in every run. Make the whole scene a function of a time value
so a script can render exactly `t = 4.5` before and after a change.

## 5. Look at time sequences, not stills

A single still can look perfect while vehicles drive through each other, items pop into existence in the
middle of a band, or a band keeps running when it should wait. All of that is invisible in one frame and
obvious in a contact sheet of a few frames a second or two apart.

## 6. Schedule, don't tune

Hand-tuned delays break whenever a speed, path or stop changes. Treat the animation as a computation:

- Routes are legs with stops and dwell times; with a constant cruise speed and acceleration only at
  stops, a route is a timetable and a vehicle's pose is a pure function of time.
- All routes share one period. Each departure offset is computed from the path lengths: prefer even
  spacing, accept an offset only if the footprint never overlaps another one over the whole period.
  Merges, crossings, dwelling and following are all the same check.
- When no offset exists, the geometry is wrong, and the scheduler says so instead of a collision showing
  up hours later.
- Coupled motion is integrated from the same schedule, with acceleration limits.

## 7. Textures in both images

A flat-filled illustration and a flat-shaded render match easily but look cheap. Adding texture to both
(planks, shingles, snow grain, ice cracks, rock strata) made the result charming, with two rules: generate
the same motifs on both sides so a cross-fade does not jump, and keep the amplitude small enough that the
colour regions still measure. Lighting and texture shift the colours, so measure with colours sampled
from the image, not from the palette.

## 8. A kiosk is a different runtime

- Start without a network: precache every built file. Module scripts are requested with CORS, so cache
  matching has to ignore `Vary`.
- GPUs lose contexts and browsers leak: reload on `webglcontextlost` and after a fixed uptime.
- Measure at the target resolution, lower the pixel ratio automatically, keep a low-quality switch.
  Pixel-ratio settings are absolute: forgetting the display's ratio renders a 1× 4K screen at 8K.

## 9. Small things that cost time

- Tone mapping changes every colour; render without it and calibrate the lights against the drawing.
- Environment lighting brightens vertical faces far more than tops; keep it low.
- Emissive details on a light base clip to white without tone mapping.
- A GIF with error-diffusion dithering crawls around every moving object; Bayer-matrix dithering with one
  palette keeps static parts identical from frame to frame, which also makes transparent deltas small.
- Check licences of binary wheels, not only of the projects: a popular computer-vision wheel bundles GPL video
  codecs, so the tools use scikit-image and SciPy instead.
