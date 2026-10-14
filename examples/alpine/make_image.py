import importlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "tools"))
Calibration = importlib.import_module("iso").Calibration

SUPERSAMPLE = 3
SEED = 11
CAL = Calibration(width=1200, height=800, anchor_x=600, anchor_y=420, px_per_unit=34, elevation_deg=30)
SUN = np.array([0.41, 0.72, 0.56]) / np.linalg.norm([0.41, 0.72, 0.56])
AMBIENT_LIGHT = 0.35 * np.array([0.88, 0.93, 1.06])
SUN_LIGHT = 0.9 * np.array([1.04, 1.0, 0.93])
VIEW = np.array([math.cos(math.radians(30)) * math.sqrt(0.5), math.sin(math.radians(30)), math.cos(math.radians(30)) * math.sqrt(0.5)])
UNIT = CAL.px_per_unit * SUPERSAMPLE

PALETTE = {
    "sky_top": "#a7c8e6",
    "sky_bottom": "#f6e2d2",
    "island_shadow": "#7d7f9e",
    "snow": "#f4f7fa",
    "glacier": "#dde8f2",
    "rock": "#7f8c9b",
    "ice": "#c3e1f2",
    "crack": "#eef8fd",
    "water": "#4f9fd0",
    "road": "#d9c9b3",
    "road_edge": "#bba78e",
    "plaster": "#f2ede6",
    "wood": "#b8784a",
    "wood_dark": "#8e5634",
    "window": "#ffd27a",
    "frame": "#5b3a26",
    "door": "#6b4027",
    "hotel_roof": "#a8413a",
    "chimney": "#9a8f86",
    "station": "#eee9e2",
    "station_roof": "#566577",
    "opening": "#2f3e4e",
    "steel": "#7b8794",
    "cable": "#3f4955",
    "cabin_a": "#e5533d",
    "cabin_b": "#f2b134",
    "pine": "#2f6b52",
    "trunk": "#6b4f3a",
    "ink": "#22324a",
}

PLATEAU = [(-14, 9), (-15, 1), (-11, -8), (-3, -13), (6, -14), (14, -10), (16, -2), (13, 6), (5, 11), (-5, 12)]
PLATEAU_THICKNESS = 0.6
SUMMIT = {"outline": [(4.0, -8.0), (5.0, -11.0), (9.0, -11.6), (12.0, -9.8), (12.6, -6.8), (9.5, -5.8), (6.0, -6.2)], "height": 2.6}
LAKE = {"center": (-5.0, 8.0), "radius": (3.2, 2.0)}
STREAM = {"path": [(-1.9, 8.4), (0.0, 9.3), (1.6, 10.3), (2.6, 11.2)], "width": 0.8}
ROAD = {
    "loop": [(10.6, 4.4), (10.7, 0.0), (10.2, -3.4), (7.5, -4.7), (3.0, -4.6), (-1.5, -4.4), (-6.0, -3.9), (-9.6, -2.2), (-10.4, 1.2), (-8.8, 3.9), (-4.5, 4.4), (0.5, 4.4), (4.5, 5.3), (8.0, 6.7)],
    "width": 1.4,
}
HOTEL = {"center": (0.5, -7.6), "size": (5.0, 3.0), "height": 3.0, "ridge": 1.5, "axis": "x", "roof": "#a8413a"}
CHALETS = [
    {"center": (-5.4, -6.9), "size": (2.2, 1.8), "height": 1.3, "ridge": 0.9, "axis": "x", "roof": "#3f7cc0"},
    {"center": (-8.8, -5.3), "size": (1.8, 2.2), "height": 1.3, "ridge": 0.9, "axis": "z", "roof": "#d9534f"},
    {"center": (-12.4, 0.8), "size": (1.8, 2.2), "height": 1.2, "ridge": 0.85, "axis": "z", "roof": "#4f9d69"},
    {"center": (-11.8, 4.6), "size": (2.2, 1.8), "height": 1.3, "ridge": 0.9, "axis": "x", "roof": "#e0a43a"},
    {"center": (-10.6, 8.2), "size": (1.8, 2.0), "height": 1.2, "ridge": 0.85, "axis": "z", "roof": "#8a5bb5"},
]
POND = {"center": (-3.4, -0.2), "radius": (1.8, 1.3)}
STATIONS = {
    "valley": {"center": (7.6, 3.6), "size": (2.0, 2.4), "height": 1.8, "base": 0.0, "opening": "-z"},
    "summit": {"center": (8.0, -8.4), "size": (2.0, 2.4), "height": 2.0, "base": SUMMIT["height"], "opening": "+z"},
}
CABLE = {"points": [(7.6, 2.15, 3.6), (8.0, 3.05, 0.4), (7.9, 3.75, -2.8), (8.0, 4.2, -8.4)], "gauge": 0.7, "hang": 0.5}
PYLONS = [{"position": (8.0, 0.4), "height": 3.1}, {"position": (7.9, -2.8), "height": 3.8}]
CABINS = [(1, 0.18), (1, 0.52), (1, 0.84), (-1, 0.34), (-1, 0.7)]
PINES = [
    (5.6, -9.6, 0.9, 2.6), (10.8, -8.4, 1.0, 2.6), (10.0, -10.4, 0.8, 2.6), (6.6, -7.2, 0.7, 2.6),
    (-7.4, -8.4, 1.1, 0), (-11.0, -3.6, 0.9, 0), (-3.6, -9.2, 1.0, 0), (-9.6, -7.4, 0.9, 0), (-13.2, -2.0, 1.0, 0),
    (-13.4, 3.0, 0.9, 0), (-12.8, 6.6, 1.0, 0), (-8.4, 10.4, 0.9, 0), (-1.0, 10.8, 0.8, 0), (13.2, -7.2, 0.9, 0),
    (4.2, -10.8, 0.9, 0), (-1.2, -11.6, 1.0, 0), (1.6, 1.4, 0.9, 0), (4.6, 2.2, 0.8, 0), (-0.6, 2.4, 0.7, 0),
]
LABELS = [("Summit", (8.0, 7.6, -8.4)), ("Hotel", (0.5, 6.3, -7.6)), ("Village", (-11.0, 5.0, 2.0))]


def lattice_hash(ix, iy, seed):
    value = np.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453
    return value - np.floor(value)


def value_noise(x, y, scale, seed=SEED):
    gx, gy = x / scale, y / scale
    ix, iy = np.floor(gx), np.floor(gy)
    fx, fy = gx - ix, gy - iy
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = lattice_hash(ix, iy, seed), lattice_hash(ix + 1, iy, seed)
    c, d = lattice_hash(ix, iy + 1, seed), lattice_hash(ix + 1, iy + 1, seed)
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy


def fractal(x, y, scale, octaves=3, seed=SEED):
    total, weight, amplitude = 0.0, 0.0, 1.0
    for octave in range(octaves):
        total = total + amplitude * value_noise(x, y, scale / 2**octave, seed + octave)
        weight += amplitude
        amplitude *= 0.5
    return total / weight


def to_linear(hex_color: str) -> np.ndarray:
    c = np.array([int(hex_color.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4)]) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(linear) -> np.ndarray:
    c = np.clip(linear, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def resolve(name: str) -> str:
    return PALETTE.get(name, name)


def lit(name: str, normal) -> np.ndarray:
    n = np.asarray(normal, float)
    n = n / np.linalg.norm(n)
    return to_linear(resolve(name)) * (AMBIENT_LIGHT + SUN_LIGHT * max(0.0, float(n @ SUN)))


def flat(name: str, normal) -> np.ndarray:
    return to_srgb(lit(name, normal)).astype(np.float32)


class Painter:
    def __init__(self) -> None:
        self.width, self.height = CAL.width * SUPERSAMPLE, CAL.height * SUPERSAMPLE
        top, bottom = to_srgb(to_linear(PALETTE["sky_top"])), to_srgb(to_linear(PALETTE["sky_bottom"]))
        t = np.linspace(0, 1, self.height)[:, None, None] ** 0.8
        self.rgb = np.broadcast_to(top * (1 - t) + bottom * t, (self.height, self.width, 3)).astype(np.float32).copy()
        self.shadow = Image.new("L", (self.width, self.height), 0)

    def px(self, x: float, y: float, z: float) -> tuple[float, float]:
        sx, sy = CAL.to_pixel(x, y, z)
        return sx * SUPERSAMPLE, sy * SUPERSAMPLE

    def fill(self, points, shade) -> None:
        xs, ys = [p[0] for p in points], [p[1] for p in points]
        x0, y0 = max(0, int(min(xs)) - 1), max(0, int(min(ys)) - 1)
        x1, y1 = min(self.width, int(max(xs)) + 2), min(self.height, int(max(ys)) + 2)
        if x1 <= x0 or y1 <= y0:
            return
        mask_image = Image.new("L", (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(mask_image).polygon([(x - x0, y - y0) for x, y in points], fill=255)
        mask = np.asarray(mask_image) > 127
        grid_y, grid_x = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        values = shade(grid_x, grid_y) if callable(shade) else np.broadcast_to(np.asarray(shade, np.float32), mask.shape + (3,))
        window = self.rgb[y0:y1, x0:x1]
        window[mask] = values[mask]

    def overlay(self, mask_image: Image.Image, rgb, opacity: float, blur: float = 0.0) -> None:
        if blur:
            mask_image = mask_image.filter(ImageFilter.GaussianBlur(blur))
        alpha = np.asarray(mask_image, np.float32)[..., None] / 255 * opacity
        self.rgb = self.rgb * (1 - alpha) + np.asarray(rgb, np.float32) * alpha

    def face(self, corners, base: str, pattern=None, occlusion: float = 0.0) -> None:
        corners = [np.asarray(c, float) for c in corners]
        u_axis, v_axis = corners[1] - corners[0], corners[-1] - corners[0]
        normal = np.cross(u_axis, v_axis)
        if normal @ VIEW <= 1e-6:
            return
        shaded = lit(base, normal)
        origin = np.array(self.px(*corners[0]))
        projected = np.column_stack([np.array(self.px(*(corners[0] + u_axis))) - origin, np.array(self.px(*(corners[0] + v_axis))) - origin])
        inverse = np.linalg.inv(projected)
        u_dir = u_axis / np.linalg.norm(u_axis)
        v_dir = v_axis - (v_axis @ u_dir) * u_dir
        v_dir = v_dir / np.linalg.norm(v_dir)

        def shade(xs, ys):
            dx, dy = xs - origin[0], ys - origin[1]
            a = inverse[0, 0] * dx + inverse[0, 1] * dy
            b = inverse[1, 0] * dx + inverse[1, 1] * dy
            u = a * (u_axis @ u_dir) + b * (v_axis @ u_dir)
            v = a * (u_axis @ v_dir) + b * (v_axis @ v_dir)
            factor = np.ones_like(u) if pattern is None else pattern(u, v)
            if occlusion:
                factor = factor * (1 - occlusion * np.exp(-np.clip(v, 0, None) * 3.0))
            return to_srgb(shaded[None, None, :] * factor[..., None]).astype(np.float32)

        self.fill([self.px(*c) for c in corners], shade)

    def ground(self, outline, y: float, base: str, pattern) -> None:
        shaded = lit(base, (0, 1, 0))
        elevation = math.radians(CAL.elevation_deg)

        def shade(xs, ys):
            across = (xs / SUPERSAMPLE - CAL.anchor_x) / (CAL.px_per_unit * math.sqrt(0.5))
            depth = (ys / SUPERSAMPLE - CAL.anchor_y + CAL.px_per_unit * y * math.cos(elevation)) / (CAL.px_per_unit * math.sqrt(0.5) * math.sin(elevation))
            return to_srgb(shaded[None, None, :] * pattern((across + depth) / 2, (depth - across) / 2)[..., None]).astype(np.float32)

        self.fill([self.px(x, y, z) for x, z in outline], shade)

    def cast(self, outline, height: float, base: float = 0.0, strength: int = 150) -> None:
        dx, dz = -SUN[0] / SUN[1] * height * 0.5, -SUN[2] / SUN[1] * height * 0.5
        hull = convex_hull(list(outline) + [(x + dx, z + dz) for x, z in outline])
        draw = ImageDraw.Draw(self.shadow)
        draw.polygon([self.px(x, base, z) for x, z in hull], fill=strength)
        draw.polygon([self.px(x, base, z) for x, z in grow(outline, 0.12)], fill=230)

    def apply_shadows(self, blur: float) -> None:
        soft = np.asarray(self.shadow.filter(ImageFilter.GaussianBlur(blur)), np.float32) / 255
        self.rgb *= 1 - soft[..., None] * np.array([0.30, 0.25, 0.16], np.float32)
        self.shadow = Image.new("L", (self.width, self.height), 0)

    def image(self) -> Image.Image:
        return Image.fromarray((np.clip(self.rgb, 0, 1) * 255 + 0.5).astype(np.uint8))


def convex_hull(points):
    pts = sorted(set(points))

    def half(sequence):
        out = []
        for p in sequence:
            while len(out) >= 2 and (out[-1][0] - out[-2][0]) * (p[1] - out[-2][1]) - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0]) <= 0:
                out.pop()
            out.append(p)
        return out

    return half(pts)[:-1] + half(list(reversed(pts)))[:-1]


def grow(outline, amount):
    cx = sum(p[0] for p in outline) / len(outline)
    cz = sum(p[1] for p in outline) / len(outline)
    return [(x + math.copysign(amount, x - cx), z + math.copysign(amount, z - cz)) for x, z in outline]


def catmull_rom(points, closed=False, step=0.15):
    pts = list(points)
    count = len(pts)
    out = []
    for i in range(count if closed else count - 1):
        p0 = pts[(i - 1) % count] if closed or i > 0 else pts[0]
        p1, p2 = pts[i % count], pts[(i + 1) % count]
        p3 = pts[(i + 2) % count] if closed or i + 2 < count else pts[-1]
        n = max(2, int(math.dist(p1, p2) / step))
        for k in range(n):
            t = k / n
            out.append(tuple(0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t**3) for a, b, c, d in zip(p0, p1, p2, p3)))
    if not closed:
        out.append(tuple(pts[-1]))
    return out


def offset_path(path, distance, closed=False):
    out = []
    count = len(path)
    for i, (x, z) in enumerate(path):
        ax, az = path[(i - 1) % count] if closed or i > 0 else path[0]
        bx, bz = path[(i + 1) % count] if closed or i + 1 < count else path[-1]
        length = math.hypot(bx - ax, bz - az) or 1.0
        out.append((x - (bz - az) / length * distance, z + (bx - ax) / length * distance))
    return out


def snow_pattern(u, v):
    drift = fractal(u, v, 3.0, 3, SEED) - 0.5
    grain = value_noise(u, v, 0.05, SEED + 9) - 0.5
    sparkle = (value_noise(u, v, 0.035, SEED + 21) > 0.94) * 0.05
    return 1 + 0.045 * drift + 0.02 * grain + sparkle


def rock_pattern(u, v):
    strata = np.sin(v * 9 + 2.5 * fractal(u, v, 1.2, 2, SEED + 3)) * 0.06
    return 1 + strata + 0.12 * (fractal(u, v, 0.4, 3, SEED + 4) - 0.5)


def planks(width=0.2):
    def pattern(u, v):
        index = np.floor(v / width)
        frac = v / width - index
        jitter = 0.9 + 0.12 * lattice_hash(index, index * 0.37, SEED + 5)
        grain = 1 + 0.06 * np.sin(u * 22 + 6 * value_noise(u * 0.5, v * 8, 0.3, SEED + 6))
        seam = 1 - 0.35 * np.exp(-((frac / 0.08) ** 2))
        return jitter * grain * seam

    return pattern


def shingles(row=0.2, tile=0.28):
    def pattern(u, v):
        index = np.floor(v / row)
        shifted = u + (index % 2) * tile / 2
        column = np.floor(shifted / tile)
        frac_v = v / row - index
        frac_u = shifted / tile - column
        jitter = 0.86 + 0.18 * lattice_hash(column, index, SEED + 7)
        overlap = 0.78 + 0.22 * np.clip(frac_v * 1.6, 0, 1)
        gap = 1 - 0.25 * np.exp(-((np.minimum(frac_u, 1 - frac_u) / 0.05) ** 2))
        return jitter * overlap * gap

    return pattern


def plaster(u, v):
    return 1 + 0.03 * (fractal(u, v, 0.5, 3, SEED + 8) - 0.5)


def ice_pattern(u, v):
    sheen = 0.06 * np.exp(-(((u - v * 0.6) % 4.0 - 2.0) ** 2) / 0.6)
    return 1 + sheen + 0.03 * (fractal(u, v, 1.5, 3, SEED + 10) - 0.5)


def water_pattern(u, v):
    return 1 + 0.1 * np.sin(u * 7 + 3 * value_noise(u, v, 0.6, SEED + 12)) * np.sin(v * 4)


def road_pattern(u, v):
    return 1 + 0.025 * (fractal(u, v, 0.3, 3, SEED + 13) - 0.5)


def uniform(u, v):
    return np.ones_like(u)


def prism_sides(painter, outline, bottom, top, base, pattern):
    ring = list(outline)
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:] + ring[:1]))
    for a, b in zip(ring, ring[1:] + ring[:1]):
        corners = [(a[0], bottom, a[1]), (b[0], bottom, b[1]), (b[0], top, b[1]), (a[0], top, a[1])]
        if area > 0:
            corners = [corners[1], corners[0], corners[3], corners[2]]
        painter.face(corners, base, pattern)


def draw_box(painter, center, size, height, base_y, colors, patterns=None, occlusion=0.0):
    (cx, cz), (dx, dz) = center, size
    x0, x1, z0, z1 = cx - dx / 2, cx + dx / 2, cz - dz / 2, cz + dz / 2
    y0, y1 = base_y, base_y + height
    patterns = patterns or {}
    painter.face([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], colors[0], patterns.get("front"), occlusion)
    painter.face([(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)], colors[1], patterns.get("side"), occlusion)
    painter.face([(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)], colors[2], patterns.get("top"))


def draw_gable(painter, center, size, top_y, ridge, axis, roof, gable, overhang=0.18):
    (cx, cz), (dx, dz) = center, size
    x0, x1, z0, z1 = cx - dx / 2 - overhang, cx + dx / 2 + overhang, cz - dz / 2 - overhang, cz + dz / 2 + overhang
    y0, y1 = top_y, top_y + ridge
    if axis == "z":
        painter.face([(x0, y0, z1), (x1, y0, z1), (cx, y1, z1)], gable, planks(0.16))
        painter.face([(x1, y0, z1), (x1, y0, z0), (cx, y1, z0), (cx, y1, z1)], roof, shingles())
        painter.face([(x0, y0, z0), (x0, y0, z1), (cx, y1, z1), (cx, y1, z0)], roof, shingles())
    else:
        painter.face([(x1, y0, z1), (x1, y0, z0), (x1, y1, cz)], gable, planks(0.16))
        painter.face([(x0, y0, z1), (x1, y0, z1), (x1, y1, cz), (x0, y1, cz)], roof, shingles())
        painter.face([(x1, y0, z0), (x0, y0, z0), (x0, y1, cz), (x1, y1, cz)], roof, shingles())


def face_corners(face, a, b, bottom, top, center, size, base_y):
    (cx, cz), (dx, dz) = center, size
    if face == "+z":
        z = cz + dz / 2 + 0.01
        return [(a, base_y + bottom, z), (b, base_y + bottom, z), (b, base_y + top, z), (a, base_y + top, z)]
    x = cx + dx / 2 + 0.01
    return [(x, base_y + bottom, b), (x, base_y + bottom, a), (x, base_y + top, a), (x, base_y + top, b)]


def panel(painter, face, a, b, bottom, top, center, size, base_y, base):
    painter.face(face_corners(face, a, b, bottom, top, center, size, base_y), base)


def glowing(painter, face, a, b, bottom, top, center, size, base_y):
    corners = face_corners(face, a, b, bottom, top, center, size, base_y)
    warm = to_srgb(to_linear(PALETTE["window"]))
    points = [painter.px(*c) for c in corners]
    low, high = min(p[1] for p in points), max(p[1] for p in points)
    painter.fill(points, lambda xs, ys: (warm * (0.9 + 0.1 * (ys - low) / max(1.0, high - low))[..., None]).astype(np.float32))


def windows(painter, face, start, end, count, rows, center, size, base_y):
    span = (end - start) / count
    for bottom, top in rows:
        for i in range(count):
            a, b = start + span * (i + 0.22), start + span * (i + 0.78)
            panel(painter, face, a, b, bottom - 0.05, top + 0.05, center, size, base_y, "frame")
            glowing(painter, face, a + 0.05, b - 0.05, bottom, top, center, size, base_y)


def draw_chalet(painter, chalet):
    center, size, height, ridge = chalet["center"], chalet["size"], chalet["height"], chalet["ridge"]
    (cx, cz), (dx, dz) = center, size
    draw_box(painter, center, size, height, 0, ("wood", "wood", "wood"), {"front": planks(), "side": planks()}, occlusion=0.25)
    windows(painter, "+z", cx - dx / 2, cx + dx / 2, 2, [(0.45, 0.95)], center, size, 0)
    windows(painter, "+x", cz - dz / 2, cz + dz / 2, 2, [(0.45, 0.95)], center, size, 0)
    draw_gable(painter, center, size, height, ridge, chalet["axis"], chalet["roof"], "wood_dark")
    chimney = (cx + (0.45 if chalet["axis"] == "x" else -0.35), cz - 0.3)
    draw_box(painter, chimney, (0.3, 0.3), 0.55, height + ridge * 0.45, ("chimney", "chimney", "snow"))


def draw_hotel(painter):
    center, size, height = HOTEL["center"], HOTEL["size"], HOTEL["height"]
    (cx, cz), (dx, dz) = center, size
    draw_box(painter, center, size, height * 0.5, 0, ("plaster", "plaster", "plaster"), {"front": plaster, "side": plaster}, occlusion=0.2)
    draw_box(painter, center, size, height * 0.5, height * 0.5, ("wood", "wood", "wood"), {"front": planks(), "side": planks()})
    windows(painter, "+z", cx - dx / 2, cx + dx / 2, 4, [(0.55, 1.1)], center, size, 0)
    windows(painter, "+z", cx - dx / 2, cx + dx / 2, 6, [(1.85, 2.45)], center, size, 0)
    windows(painter, "+x", cz - dz / 2, cz + dz / 2, 3, [(0.55, 1.1), (1.85, 2.45)], center, size, 0)
    panel(painter, "+z", cx - 0.28, cx + 0.28, 0, 1.0, center, size, 0, "door")
    draw_gable(painter, center, size, height, HOTEL["ridge"], HOTEL["axis"], HOTEL["roof"], "wood_dark", 0.25)


def draw_station(painter, station):
    center, size, height, base = station["center"], station["size"], station["height"], station["base"]
    (cx, cz), (dx, dz) = center, size
    draw_box(painter, center, size, height, base, ("station", "station", "station"), {"front": plaster, "side": plaster}, occlusion=0.2)
    if station["opening"] == "+z":
        panel(painter, "+z", cx - 0.7, cx + 0.7, height * 0.35, height * 0.92, center, size, base, "opening")
    panel(painter, "+x", cz - 0.3, cz + 0.3, 0, 1.0, center, size, base, "door")
    draw_box(painter, center, (dx + 0.4, dz + 0.4), 0.18, base + height, ("station_roof", "station_roof", "station_roof"), {"top": plaster})


def draw_pylon(painter, pylon):
    position, height = pylon["position"], pylon["height"]
    draw_box(painter, position, (0.22, 0.22), height, 0, ("steel", "steel", "steel"))
    draw_box(painter, position, (CABLE["gauge"] + 0.5, 0.16), 0.14, height, ("steel", "steel", "steel"))


def draw_pine(painter, x, z, scale, base_y):
    tx, ty = painter.px(x, base_y, z)
    _, trunk_top = painter.px(x, base_y + 0.45 * scale, z)
    trunk = 0.09 * scale * UNIT
    painter.fill([(tx - trunk, ty), (tx + trunk, ty), (tx + trunk, trunk_top), (tx - trunk, trunk_top)], flat("trunk", (0, 0.3, 1)))
    for bottom, height, radius in [(0.35, 1.25, 0.78), (0.95, 1.05, 0.6), (1.5, 0.9, 0.42)]:
        _, base_line = painter.px(x, base_y + bottom * scale, z)
        _, apex = painter.px(x, base_y + (bottom + height) * scale, z)
        half = radius * scale * UNIT

        def foliage(xs, ys, base_line=base_line, apex=apex, half=half):
            height_t = np.clip((base_line - ys) / max(1.0, base_line - apex), 0, 1)
            light = np.where(xs < tx, 1.0, 0.8)
            clusters = 0.86 + 0.28 * value_noise(xs / UNIT, ys / UNIT, 0.09, SEED + 14)
            needles = lit("pine", (0, 0.4, 1)) * ((0.88 + 0.3 * height_t) * light * clusters)[..., None]
            snow = lit("snow", (0, 1, 0.25)) * (0.98 * light)[..., None]
            cap = height_t > 0.6 + 0.07 * np.sin((xs - tx) / UNIT * 38)
            return to_srgb(np.where(cap[..., None], snow, needles)).astype(np.float32)

        edge = [(tx - half + half * 2 * k / 8, base_line + (0.12 * half if k % 2 else 0)) for k in range(9)]
        painter.fill(edge + [(tx, apex)], foliage)


def cable_lines():
    return {side: [(x + side * CABLE["gauge"] / 2, y, z) for x, y, z in CABLE["points"]] for side in (1, -1)}


def along(points, t):
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    target = t * sum(lengths)
    for (a, b), length in zip(zip(points, points[1:]), lengths):
        if target <= length:
            return tuple(pa + (pb - pa) * target / length for pa, pb in zip(a, b))
        target -= length
    return points[-1]


def draw_cabin(painter, x, y, z, tint):
    top = y - CABLE["hang"]
    painter.fill([painter.px(x - 0.02, y, z), painter.px(x + 0.02, y, z), painter.px(x + 0.02, top, z), painter.px(x - 0.02, top, z)], flat("cable", (0, 0, 1)))
    center, size = (x, z), (0.5, 0.44)
    draw_box(painter, center, size, 0.55, top - 0.55, (tint, tint, "snow"))
    panel(painter, "+z", x - 0.19, x + 0.19, 0.28, 0.46, center, size, top - 0.55, "opening")
    panel(painter, "+x", z - 0.16, z + 0.16, 0.28, 0.46, center, size, top - 0.55, "opening")


def pond_outline():
    cx, cz = POND["center"]
    rx, rz = POND["radius"]
    return [(round(cx + rx * math.cos(a), 3), round(cz + rz * math.sin(a), 3)) for a in np.linspace(0, 2 * math.pi, 10, endpoint=False)]


def lake_outline():
    cx, cz = LAKE["center"]
    rx, rz = LAKE["radius"]
    angles = np.linspace(0, 2 * math.pi, 12, endpoint=False)
    return [(round(cx + rx * math.cos(a) * (1 + 0.08 * math.sin(3 * a)), 3), round(cz + rz * math.sin(a) * (1 + 0.06 * math.cos(2 * a)), 3)) for a in angles]


def draw_lake(painter):
    painter.ground(catmull_rom(lake_outline(), closed=True), 0, "ice", ice_pattern)
    rng = np.random.default_rng(SEED)
    cracks = Image.new("L", (painter.width, painter.height), 0)
    draw = ImageDraw.Draw(cracks)
    cx, cz = LAKE["center"]
    rx, rz = LAKE["radius"]
    for _ in range(9):
        x, z = cx + rng.uniform(-2.2, 2.2), cz + rng.uniform(-1.2, 1.2)
        heading = rng.uniform(0, 2 * math.pi)
        points = [painter.px(x, 0, z)]
        for _ in range(4):
            heading += rng.uniform(-0.7, 0.7)
            x, z = x + 0.35 * math.cos(heading), z + 0.35 * math.sin(heading)
            if ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 > 0.75:
                break
            points.append(painter.px(x, 0, z))
        if len(points) > 1:
            draw.line(points, fill=255, width=SUPERSAMPLE)
    painter.overlay(cracks, flat("crack", (0, 1, 0)), 0.7, blur=1.0)


def draw_stream(painter):
    stream = catmull_rom(STREAM["path"])
    left, right = offset_path(stream, STREAM["width"] / 2), offset_path(stream, -STREAM["width"] / 2)
    painter.ground(left + right[::-1], 0, "water", water_pattern)
    for t in (0.25, 0.55, 0.8):
        x, _, z = along([(p[0], 0, p[1]) for p in stream], t)
        painter.ground([(x - 0.2, z - 0.1), (x + 0.15, z - 0.16), (x + 0.22, z + 0.08), (x - 0.12, z + 0.14)], 0.01, "snow", uniform)


def draw_road(painter):
    loop = catmull_rom(ROAD["loop"], closed=True)
    outer, inner = offset_path(loop, ROAD["width"] / 2, True), offset_path(loop, -ROAD["width"] / 2, True)
    painter.ground(outer, 0, "road", road_pattern)
    painter.ground(inner, 0, "snow", snow_pattern)
    lines = Image.new("L", (painter.width, painter.height), 0)
    draw = ImageDraw.Draw(lines)
    for ring in (outer, inner):
        draw.line([painter.px(x, 0, z) for x, z in ring + ring[:1]], fill=255, width=2 * SUPERSAMPLE)
    for side in (0.3, -0.3):
        track = offset_path(loop, side, True)
        draw.line([painter.px(x, 0, z) for x, z in track + track[:1]], fill=70, width=3 * SUPERSAMPLE)
    painter.overlay(lines, flat("road_edge", (0, 1, 0)), 0.55, blur=1.2)


def draw_island_shadow(painter):
    shadow = Image.new("L", (painter.width, painter.height), 0)
    ImageDraw.Draw(shadow).polygon([painter.px(x * 0.96, -2.4, z * 0.96) for x, z in PLATEAU], fill=255)
    painter.overlay(shadow, flat("island_shadow", (0, 1, 0)), 0.35, blur=18 * SUPERSAMPLE)


def draw_waterfall(painter):
    (ax, az), (bx, bz) = offset_path(STREAM["path"], STREAM["width"] / 2)[-1], offset_path(STREAM["path"], -STREAM["width"] / 2)[-1]
    painter.face([(bx, -PLATEAU_THICKNESS - 0.15, bz), (ax, -PLATEAU_THICKNESS - 0.15, az), (ax, 0, az), (bx, 0, bz)], "water", lambda u, v: 1 + 0.12 * np.sin(u * 30 + v * 4))


def footprint(center, size):
    (cx, cz), (dx, dz) = center, size
    return [(cx - dx / 2, cz - dz / 2), (cx + dx / 2, cz - dz / 2), (cx + dx / 2, cz + dz / 2), (cx - dx / 2, cz + dz / 2)]


def main() -> None:
    painter = Painter()
    draw_island_shadow(painter)
    prism_sides(painter, PLATEAU, -PLATEAU_THICKNESS, 0, "rock", rock_pattern)
    draw_waterfall(painter)
    painter.ground(PLATEAU, 0, "snow", snow_pattern)
    draw_lake(painter)
    draw_stream(painter)
    draw_road(painter)
    painter.ground(catmull_rom(pond_outline(), closed=True), 0, "ice", ice_pattern)
    for chalet in CHALETS:
        painter.cast(footprint(chalet["center"], chalet["size"]), chalet["height"] + chalet["ridge"] * 0.6)
    painter.cast(footprint(HOTEL["center"], HOTEL["size"]), HOTEL["height"] + HOTEL["ridge"] * 0.6)
    painter.cast(footprint(STATIONS["valley"]["center"], STATIONS["valley"]["size"]), STATIONS["valley"]["height"])
    for pylon in PYLONS:
        painter.cast(footprint(pylon["position"], (0.3, 0.3)), 0.6, strength=90)
    for x, z, scale, base in PINES:
        if base == 0:
            painter.cast(footprint((x, z), (0.9 * scale, 0.9 * scale)), 1.6 * scale, strength=120)
    painter.apply_shadows(4 * SUPERSAMPLE)

    prism_sides(painter, SUMMIT["outline"], 0, SUMMIT["height"], "rock", rock_pattern)
    painter.ground(SUMMIT["outline"], SUMMIT["height"], "glacier", snow_pattern)
    summit = STATIONS["summit"]
    painter.cast(footprint(summit["center"], summit["size"]), summit["height"], SUMMIT["height"])
    for x, z, scale, base in PINES:
        if base > 0:
            painter.cast(footprint((x, z), (0.9 * scale, 0.9 * scale)), 1.6 * scale, base, strength=120)
    painter.apply_shadows(4 * SUPERSAMPLE)

    actors = [(sum(c["center"]), (lambda c=c: draw_chalet(painter, c))) for c in CHALETS]
    actors.append((sum(HOTEL["center"]), lambda: draw_hotel(painter)))
    actors.append((sum(STATIONS["valley"]["center"]), lambda: draw_station(painter, STATIONS["valley"])))
    actors.append((sum(STATIONS["summit"]["center"]), lambda: draw_station(painter, STATIONS["summit"])))
    actors += [(sum(p["position"]), (lambda p=p: draw_pylon(painter, p))) for p in PYLONS]
    actors += [(x + z, (lambda x=x, z=z, s=s, b=base: draw_pine(painter, x, z, s, b))) for x, z, s, base in PINES]
    for _, paint in sorted(actors, key=lambda actor: actor[0]):
        paint()

    cables = Image.new("L", (painter.width, painter.height), 0)
    for points in cable_lines().values():
        ImageDraw.Draw(cables).line([painter.px(*p) for p in points], fill=255, width=2 * SUPERSAMPLE)
    painter.overlay(cables, flat("cable", (0, 0.5, 1)), 1.0)
    lines = cable_lines()
    for index, (side, t) in enumerate(CABINS):
        draw_cabin(painter, *along(lines[side], t), "cabin_a" if index % 2 == 0 else "cabin_b")

    image = painter.image().filter(ImageFilter.GaussianBlur(0.5)).resize((CAL.width, CAL.height), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=22)
    for text, (x, y, z) in LABELS:
        sx, sy = CAL.to_pixel(x, y, z)
        box = draw.textbbox((0, 0), text, font=font)
        draw.text((sx - (box[2] + box[0]) / 2, sy - (box[3] + box[1]) / 2), text, fill=PALETTE["ink"], font=font)
    image.save(HERE / "reference.png")
    truth = {
        "calibration": CAL.to_json(),
        "plateau": {"outline": PLATEAU, "thickness": PLATEAU_THICKNESS},
        "summit": SUMMIT,
        "lake": {"outline": lake_outline()},
        "pond": {"outline": pond_outline()},
        "stream": STREAM,
        "road": ROAD,
        "hotel": HOTEL,
        "chalets": CHALETS,
        "stations": STATIONS,
        "cable": CABLE,
        "pylons": PYLONS,
        "pines": [{"position": [x, z], "scale": s, "base": b} for x, z, s, b in PINES],
        "labels": [{"text": t, "position": p} for t, p in LABELS],
        "light": {"sun": SUN.round(4).tolist(), "ambient": AMBIENT_LIGHT.round(4).tolist(), "sunColor": SUN_LIGHT.round(4).tolist()},
        "palette": PALETTE,
    }
    (HERE / "truth.json").write_text(json.dumps(truth, indent=2) + "\n")
    print(f"wrote {HERE / 'reference.png'} and truth.json")


if __name__ == "__main__":
    main()
