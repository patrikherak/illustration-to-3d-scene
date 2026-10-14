# Licences

This repository is MIT licensed ([`LICENSE`](LICENSE)). Nothing below is vendored: everything is installed
by npm or by `pip install -r tools/requirements.txt`. Only permissive licences are used; there is no
copyleft dependency. `npm run licenses` in `viewer/` re-checks the whole npm tree and exits non-zero on GPL,
LGPL, AGPL, MPL, EPL, EUPL, CDDL, OSL, CC-BY-SA, SSPL or an unknown licence; pass a lock file to check
another tree, e.g. `node viewer/scripts/licenses.mjs verify/*-lock.json`.

## Viewer (`viewer/`)

| Dependency | Version | Used for | Licence |
|---|---|---|---|
| [three](https://github.com/mrdoob/three.js) | 0.186.0 | WebGL renderer, geometry, room environment | MIT |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) | 9.8.0 | React renderer for three.js | MIT |
| [@react-three/drei](https://github.com/pmndrs/drei) | 10.7.8 | `PerformanceMonitor` | MIT |
| [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) | 3.1.2 | effect composer | MIT |
| [postprocessing](https://github.com/pmndrs/postprocessing) | 6.39.5 | Bloom, SMAA | Zlib |
| [n8ao](https://github.com/N8python/n8ao) | 2.0.1 (via @react-three/postprocessing) | ambient occlusion | ISC |
| [react](https://github.com/facebook/react), react-dom | 19.3.0 | UI | MIT |
| [vite](https://github.com/vitejs/vite) (dev) | 7.3.6 | dev server, build | MIT |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) (dev) | 5.2.0 | JSX, fast refresh | MIT |
| [typescript](https://github.com/microsoft/TypeScript) (dev) | 5.9.3 | type checking | Apache-2.0 |
| @types/react, @types/react-dom, @types/three, @types/node (dev) | 19.3.0, 19.3.0, 0.186.0, 24.13.6 | types | MIT |

The full tree (185 entries) by licence: MIT 165, ISC 9, Apache-2.0 7, BSD-3-Clause 2, Zlib 1, CC-BY-4.0 1.

- `caniuse-lite` (CC-BY-4.0) is a browser-support data table used by the build tooling. It is an
  attribution licence, not copyleft, and it does not end up in the built app.
- `webgl-constants` (via drei) has no licence field in its manifest; it ships an MIT `LICENSE` file.
- Vite is pinned to 7.x on purpose: Vite 8 depends on `lightningcss`, which is MPL-2.0.

## Verify (`verify/`)

| Dependency | Version | Used for | Licence |
|---|---|---|---|
| [playwright](https://github.com/microsoft/playwright) | 1.63.0 | headless GPU screenshots, frame rate | Apache-2.0 |

`npx playwright install chromium` downloads Chromium (BSD-3-Clause and the licences in its
`about:credits`); it is a tool on your machine, not part of this repository.

## Python tools (`tools/`)

| Dependency | Version | Used for | Licence |
|---|---|---|---|
| [numpy](https://numpy.org) | 2.5.4 | arrays, least squares, noise | BSD-3-Clause |
| [scipy](https://scipy.org) | 1.18.1 | morphology, labelling, distance transform, convex hull, palette lookup | BSD-3-Clause |
| [scikit-image](https://scikit-image.org) | 0.26.0 | CIELAB, skeleton, contours, Canny | BSD-3-Clause |
| [Pillow](https://python-pillow.org) | 12.3.0 | image I/O, drawing, GIF writing | MIT-CMU (HPND) |

Pulled in by scikit-image: networkx (BSD-3-Clause), imageio (BSD-2-Clause), tifffile (BSD-3-Clause),
lazy-loader (BSD-3-Clause), packaging (Apache-2.0 or BSD-2-Clause).

- SciPy's binary wheels bundle the GCC runtime libraries (`libgfortran`, `libquadmath`, `libgcc_s`), which
  are covered by the GCC Runtime Library Exception.
- OpenCV is deliberately not used: its prebuilt wheels bundle FFmpeg with GPL codecs (x264, x265 on macOS).

## Example artwork

`examples/alpine/reference.png` and `docs/images/` are generated from code in this repository
(`examples/alpine/make_image.py`, `verify/shoot.mjs`, `tools/animate.py`, `tools/layout.py`) and are MIT
licensed with it. The labels use Pillow's built-in default font (Aileron Regular, CC0) in the illustration
and the system UI font in the viewer.
