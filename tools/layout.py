import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull
from skimage.color import rgb2lab
from skimage.measure import approximate_polygon, find_contours
from skimage.morphology import skeletonize

from iso import Calibration

EIGHT_CONNECTED = np.ones((3, 3), bool)


def load_rgb(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def hex_to_rgb(value: str) -> np.ndarray:
    value = value.lstrip("#")
    return np.array([int(value[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.uint8)


def lab8(rgb: np.ndarray) -> np.ndarray:
    lab = rgb2lab(rgb)
    return np.stack([lab[..., 0] * 255 / 100, lab[..., 1], lab[..., 2]], axis=-1)


def morph(mask: np.ndarray, size: int, operation) -> np.ndarray:
    if not size:
        return mask
    padded = np.pad(mask, size, mode="edge")
    return operation(padded, structure=np.ones((size, size), bool))[size:-size, size:-size]


def color_mask(image: np.ndarray, color: str, tolerance: float, close: int, open_: int) -> np.ndarray:
    target = lab8(hex_to_rgb(color).reshape(1, 1, 3))[0, 0]
    mask = np.linalg.norm(lab8(image) - target, axis=2) <= tolerance
    return morph(morph(mask, close, ndimage.binary_closing), open_, ndimage.binary_opening)


def outline(component: np.ndarray) -> np.ndarray:
    contours = find_contours(np.pad(component, 1).astype(float), 0.5)
    return max(contours, key=len)[:, ::-1] - 1


def regions(mask: np.ndarray, min_area: float, epsilon: float, hull: bool = False) -> list[list[list[float]]]:
    labels, count = ndimage.label(mask, structure=EIGHT_CONNECTED)
    components = [ndimage.binary_fill_holes(labels == label) for label in range(1, count + 1)]
    components = [component for component in components if component.sum() >= min_area]
    if hull and components:
        points = np.vstack([outline(component) for component in components])
        corners = points[ConvexHull(points).vertices]
        simplified = approximate_polygon(np.vstack([corners, corners[:1]]), tolerance=epsilon)[:-1]
        return [[[round(float(x), 2), round(float(y), 2)] for x, y in simplified]]
    found = []
    for component in components:
        simplified = approximate_polygon(outline(component), tolerance=epsilon)[:-1]
        found.append((int(component.sum()), [[round(float(x), 2), round(float(y), 2)] for x, y in simplified]))
    return [polygon for _, polygon in sorted(found, key=lambda item: item[0], reverse=True)]


def longest_path(pixels: set[tuple[int, int]]) -> list[tuple[int, int]]:
    def neighbours(p):
        y, x = p
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                q = (y + dy, x + dx)
                if q != p and q in pixels:
                    yield q

    def farthest(start):
        previous = {start: None}
        queue = deque([start])
        last = start
        while queue:
            last = queue.popleft()
            for q in neighbours(last):
                if q not in previous:
                    previous[q] = last
                    queue.append(q)
        return last, previous

    end_a, _ = farthest(next(iter(pixels)))
    end_b, previous = farthest(end_a)
    chain, node = [], end_b
    while node is not None:
        chain.append(node)
        node = previous[node]
    return chain


def straighten_ends(points: np.ndarray, trim: float) -> np.ndarray:
    along = np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(points, axis=0).T))])
    total = along[-1]
    if trim <= 0 or total <= 4 * trim:
        return points
    inside = (along >= trim) & (along <= total - trim)
    inner, inner_along = points[inside], along[inside]
    head_ref = min(len(inner) - 1, int(np.searchsorted(inner_along, inner_along[0] + trim)))
    tail_ref = max(0, int(np.searchsorted(inner_along, inner_along[-1] - trim)) - 1)

    def extend(end: int, reference: int) -> np.ndarray:
        direction = inner[end] - inner[reference]
        return inner[end] + direction / max(float(np.hypot(*direction)), 1e-6) * trim

    return np.vstack([extend(0, head_ref), inner, extend(len(inner) - 1, tail_ref)])


def ground_view(mask: np.ndarray, cal: Calibration, height: float) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.nonzero(mask)
    corners = [cal.to_world(float(x), float(y), height) for x in (xs.min(), xs.max()) for y in (ys.min(), ys.max())]
    x0, z0 = min(c[0] for c in corners) - 1, min(c[2] for c in corners) - 1
    x1, z1 = max(c[0] for c in corners) + 1, max(c[2] for c in corners) + 1
    scale = cal.px_per_unit
    origin = np.array(cal.to_pixel(x0, height, z0))
    along_x = (np.array(cal.to_pixel(x0 + 1, height, z0)) - origin) / scale
    along_z = (np.array(cal.to_pixel(x0, height, z0 + 1)) - origin) / scale
    grid_to_image = np.column_stack([along_x, along_z, origin])
    shape = (int(np.ceil((z1 - z0) * scale)), int(np.ceil((x1 - x0) * scale)))
    rows, columns = np.indices(shape)
    source_x = np.rint(grid_to_image[0, 0] * columns + grid_to_image[0, 1] * rows + grid_to_image[0, 2]).astype(int)
    source_y = np.rint(grid_to_image[1, 0] * columns + grid_to_image[1, 1] * rows + grid_to_image[1, 2]).astype(int)
    inside = (source_x >= 0) & (source_x < mask.shape[1]) & (source_y >= 0) & (source_y < mask.shape[0])
    warped = np.zeros(shape, bool)
    warped[inside] = mask[source_y[inside], source_x[inside]]
    return warped, grid_to_image


def neighbours(pixels: set[tuple[int, int]], p: tuple[int, int]) -> list[tuple[int, int]]:
    y, x = p
    return [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (y + dy, x + dx) in pixels]


def without_spurs(pixels: set[tuple[int, int]], length: int) -> set[tuple[int, int]]:
    remaining = set(pixels)
    for _ in range(length):
        ends = [p for p in remaining if len(neighbours(remaining, p)) <= 1]
        if not ends:
            break
        remaining.difference_update(ends)
    return remaining


def walk_loop(pixels: set[tuple[int, int]]) -> list[tuple[int, int]]:
    start = min(pixels)
    chain, visited = [start], {start}
    while True:
        options = [q for q in neighbours(pixels, chain[-1]) if q not in visited]
        if not options:
            return chain
        step = min(options, key=lambda q: abs(q[0] - chain[-1][0]) + abs(q[1] - chain[-1][1]))
        chain.append(step)
        visited.add(step)


def centrelines(mask: np.ndarray, min_length: int, epsilon: float) -> list[tuple[np.ndarray, bool]]:
    skeleton = skeletonize(mask)
    half_width = ndimage.distance_transform_edt(mask)
    labels, count = ndimage.label(skeleton, structure=EIGHT_CONNECTED)
    found = []
    for label in range(1, count + 1):
        ys, xs = np.nonzero(labels == label)
        if len(xs) < min_length:
            continue
        pixels = set(zip(ys.tolist(), xs.tolist()))
        trim = 1.5 * float(np.median(half_width[ys, xs]))
        core = without_spurs(pixels, int(2 * trim) + 2)
        if len(core) >= min_length and all(len(neighbours(core, p)) >= 2 for p in core):
            chain = walk_loop(core)
            points = np.array([[x, y] for y, x in chain + chain[:1]], dtype=float)
            found.append((approximate_polygon(points, tolerance=epsilon)[:-1], True))
            continue
        chain = longest_path(pixels)
        points = straighten_ends(np.array([[x, y] for y, x in chain], dtype=float), trim)
        found.append((approximate_polygon(points, tolerance=epsilon), False))
    return found


def paths(mask: np.ndarray, min_length: int, epsilon: float, cal: Calibration | None, height: float, bridge: int = 0) -> list[tuple[list[list[float]], bool]]:
    if cal is None:
        lines = centrelines(morph(mask, bridge, ndimage.binary_closing), min_length, epsilon)
    else:
        warped, grid_to_image = ground_view(mask, cal, height)
        warped = morph(warped, bridge, ndimage.binary_closing)
        lines = [(np.hstack([line, np.ones((len(line), 1))]) @ grid_to_image.T, closed) for line, closed in centrelines(warped, min_length, epsilon)]
    found = [([[round(float(x), 2), round(float(y), 2)] for x, y in line], closed) for line, closed in lines]
    return sorted(found, key=lambda item: polyline_length(item[0] + item[0][:1] if item[1] else item[0]), reverse=True)


def polyline_length(points: list[list[float]]) -> float:
    return float(sum(np.hypot(bx - ax, by - ay) for (ax, ay), (bx, by) in zip(points, points[1:])))


def to_world(points: list[list[float]], cal: Calibration | None, height: float) -> list[list[float]] | None:
    if cal is None:
        return None
    return [[round(v, 3) for v in cal.to_world(x, y, height)][::2] for x, y in points]


def parse_spec(spec: str) -> tuple[str, str, float, float]:
    name, rest = spec.split("=", 1)
    height = 0.0
    if "@" in rest:
        rest, h = rest.split("@", 1)
        height = float(h)
    color, _, tol = rest.partition(":")
    return name, color, float(tol or 12), height


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure ground regions and path centrelines from an illustration by colour.")
    parser.add_argument("image")
    parser.add_argument("--calibration", help="calibration JSON from calibrate.py; adds world x/z coordinates and measures paths in a top view")
    parser.add_argument("--region", action="append", default=[], metavar="NAME=#RRGGBB[:TOL]", help="filled area, e.g. plateau=#e2ebf3:6")
    parser.add_argument("--path", action="append", default=[], metavar="NAME=#RRGGBB[:TOL][@HEIGHT]", help="band whose centreline you want, e.g. stream=#50a1d3:20 or cable=#3f4955:12@3.5")
    parser.add_argument("--hull", action="append", default=[], metavar="NAME", help="one convex hull over all parts of this region: ground plates cut up by buildings, trees and shadows")
    parser.add_argument("--bridge", type=int, default=0, metavar="PX", help="close gaps up to about PX pixels in path masks before skeletonising, e.g. where poles or cables cross a road")
    parser.add_argument("--min-area", type=float, default=4000)
    parser.add_argument("--min-length", type=int, default=40)
    parser.add_argument("--epsilon", type=float, default=4.0, help="simplification tolerance in pixels")
    parser.add_argument("--debug", help="write an overlay PNG with what was found")
    parser.add_argument("--out", help="write layout JSON here")
    args = parser.parse_args()

    image = load_rgb(args.image)
    cal = Calibration.load(args.calibration) if args.calibration else None
    canvas = Image.fromarray(image) if args.debug else None
    draw = ImageDraw.Draw(canvas) if canvas is not None else None
    layout: dict = {"image": [image.shape[1], image.shape[0]], "regions": {}, "paths": {}}

    for spec in args.region:
        name, color, tol, height = parse_spec(spec)
        found = regions(color_mask(image, color, tol, 9, 5), args.min_area, args.epsilon, name in args.hull)
        layout["regions"][name] = [{"pixel": poly, "world": to_world(poly, cal, height)} for poly in found]
        for poly in found if draw is not None else []:
            draw.line([tuple(p) for p in poly + poly[:1]], fill=(230, 0, 0), width=2)
    for spec in args.path:
        name, color, tol, height = parse_spec(spec)
        found = paths(color_mask(image, color, tol, 7, 3), args.min_length, args.epsilon, cal, height, args.bridge)
        layout["paths"][name] = [{"pixel": line, "world": to_world(line, cal, height), "height": height, "closed": closed} for line, closed in found]
        for line, closed in found if draw is not None else []:
            draw.line([tuple(p) for p in line + (line[:1] if closed else [])], fill=(230, 0, 230), width=2)
            for x, y in line:
                draw.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(230, 0, 230))

    text = json.dumps(layout, indent=1)
    if args.out:
        Path(args.out).write_text(text + "\n")
    else:
        print(text)
    if canvas is not None:
        canvas.save(args.debug)
    for kind in ("regions", "paths"):
        for name, items in layout[kind].items():
            print(f"{kind[:-1]} {name}: {len(items)} found, points {[len(i['pixel']) for i in items]}")


if __name__ == "__main__":
    main()
