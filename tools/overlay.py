import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from skimage.feature import canny

RED = (230, 0, 0)


def load_pair(reference: str, render: str, crop: list[int] | None) -> tuple[np.ndarray, np.ndarray]:
    ref = Image.open(reference).convert("RGB")
    ren = Image.open(render).convert("RGB").resize(ref.size, Image.Resampling.BOX)
    if crop:
        ref, ren = ref.crop(tuple(crop)), ren.crop(tuple(crop))
    return np.asarray(ref), np.asarray(ren)


def edges(image: np.ndarray) -> np.ndarray:
    gray = np.asarray(Image.fromarray(image).convert("L"), dtype=float) / 255
    return canny(gray, sigma=1.0, low_threshold=0.08, high_threshold=0.2)


def ticks(image: Image.Image, origin: tuple[int, int], scale: float) -> Image.Image:
    out = image.copy()
    draw = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=12)
    x0, y0 = origin
    w, h = out.size
    for x in range(int(np.ceil(x0 / 10) * 10), int(x0 + w / scale), 10):
        sx = int((x - x0) * scale)
        draw.line([(sx, 0), (sx, 12 if x % 50 == 0 else 5)], fill=RED)
        if x % 100 == 0:
            draw.text((sx + 2, 14), str(x), fill=RED, font=font)
    for y in range(int(np.ceil(y0 / 10) * 10), int(y0 + h / scale), 10):
        sy = int((y - y0) * scale)
        draw.line([(0, sy), (12 if y % 50 == 0 else 5, sy)], fill=RED)
        if y % 100 == 0:
            draw.text((14, sy - 6), str(y), fill=RED, font=font)
    return out


def score(ref: np.ndarray, ren: np.ndarray, tolerance: int) -> tuple[float, float, float]:
    a, b = edges(ref), edges(ren)
    window = np.ones((2 * tolerance + 1, 2 * tolerance + 1), bool)
    near_b = ndimage.binary_dilation(b, window)
    near_a = ndimage.binary_dilation(a, window)
    recall = float((a & near_b).sum() / max(1, a.sum()))
    precision = float((b & near_a).sum() / max(1, b.sum()))
    f = 2 * precision * recall / max(1e-9, precision + recall)
    return recall, precision, f


def sheet(files: list[str], labels: list[str], columns: int, tile_width: int, crop: list[int] | None) -> Image.Image:
    font = ImageFont.load_default(size=22)
    tiles = []
    for index, file in enumerate(files):
        image = Image.open(file).convert("RGB")
        if crop:
            image = image.crop(tuple(crop))
        tile = image.resize((tile_width, round(image.height * tile_width / image.width)), Image.Resampling.LANCZOS)
        caption = labels[index] if index < len(labels) else Path(file).stem
        ImageDraw.Draw(tile).text((10, 8), caption, fill=(40, 40, 40), font=font, stroke_width=3, stroke_fill=(255, 255, 255))
        tiles.append(tile)
    height = max(tile.height for tile in tiles)
    rows = -(-len(tiles) // columns)
    out = Image.new("RGB", (columns * tile_width, rows * height), (255, 255, 255))
    for index, tile in enumerate(tiles):
        out.paste(tile, ((index % columns) * tile_width, (index // columns) * height))
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare a render against the illustration it rebuilds, or tile frames into a contact sheet.")
    parser.add_argument("mode", choices=["edges", "side", "score", "sheet"])
    parser.add_argument("files", nargs="+", help="edges/side/score: REFERENCE RENDER; sheet: IMAGE...")
    parser.add_argument("--out", default="overlay.png")
    parser.add_argument("--crop", type=int, nargs=4, metavar=("X0", "Y0", "X1", "Y1"), help="edges/side/score: in reference pixels; sheet: in pixels of each image")
    parser.add_argument("--zoom", type=float, default=1.0)
    parser.add_argument("--tolerance", type=int, default=3, help="score: pixels an edge may be off")
    parser.add_argument("--columns", type=int, default=3, help="sheet: tiles per row")
    parser.add_argument("--tile-width", type=int, default=600, help="sheet: width of one tile")
    parser.add_argument("--labels", nargs="*", default=[], help="sheet: caption per image")
    args = parser.parse_args()

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    if args.mode == "sheet":
        sheet(args.files, args.labels, args.columns, args.tile_width, args.crop).save(args.out)
        print(f"wrote {args.out}")
        return
    if len(args.files) != 2:
        parser.error(f"{args.mode} needs REFERENCE and RENDER")
    ref, ren = load_pair(*args.files, args.crop)
    if args.mode == "score":
        recall, precision, f = score(ref, ren, args.tolerance)
        print(f"edge recall {recall:.3f} (reference edges the render reproduces)")
        print(f"edge precision {precision:.3f} (render edges the reference has)")
        print(f"edge F {f:.3f} at ±{args.tolerance}px")
        return
    if args.mode == "edges":
        dimmed = (ren * 0.75).astype(np.uint8)
        dimmed[edges(ref)] = RED
        out = Image.fromarray(dimmed)
    else:
        gap = np.full((ref.shape[0], 8, 3), 255, np.uint8)
        out = Image.fromarray(np.hstack([ref, gap, ren]))
    if args.zoom != 1.0:
        out = out.resize((round(out.width * args.zoom), round(out.height * args.zoom)), Image.Resampling.BICUBIC)
    if args.mode == "edges":
        out = ticks(out, (args.crop[0], args.crop[1]) if args.crop else (0, 0), args.zoom)
    out.save(args.out)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
