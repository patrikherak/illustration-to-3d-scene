import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

TRANSPARENT = 255


def bayer(size: int = 8) -> np.ndarray:
    matrix = np.array([[0]])
    while matrix.shape[0] < size:
        matrix = np.block([[4 * matrix, 4 * matrix + 2], [4 * matrix + 3, 4 * matrix + 1]])
    return (matrix + 0.5) / matrix.size - 0.5


def load(path: str, size: tuple[int, int], crop: list[int] | None) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    if crop:
        scale = image.width / crop[4] if len(crop) > 4 else 1.0
        image = image.crop(tuple(round(v * scale) for v in crop[:4]))
    return np.asarray(image.resize(size, Image.Resampling.LANCZOS), np.float32)


def build_palette(samples: list[np.ndarray], colors: int) -> np.ndarray:
    montage = np.concatenate([s[::2, ::2].reshape(-1, 3) for s in samples])
    side = int(np.ceil(np.sqrt(len(montage))))
    padded = np.zeros((side * side, 3), np.float32)
    padded[: len(montage)] = montage
    padded[len(montage) :] = montage[0]
    image = Image.fromarray(padded.reshape(side, side, 3).astype(np.uint8))
    quantized = image.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, kmeans=2)
    return np.array(quantized.getpalette()[: colors * 3], np.float32).reshape(-1, 3)


def indices(frame: np.ndarray, tree: cKDTree, threshold: np.ndarray, strength: float) -> np.ndarray:
    h, w = frame.shape[:2]
    tiles = np.tile(threshold, (h // threshold.shape[0] + 1, w // threshold.shape[1] + 1))[:h, :w]
    dithered = np.clip(frame + tiles[..., None] * strength, 0, 255)
    _, nearest = tree.query(dithered.reshape(-1, 3))
    return nearest.reshape(h, w).astype(np.uint8)


def report(out: str, count: int, durations: list[int], size: tuple[int, int]) -> None:
    print(f"wrote {out}: {count} frames, {sum(durations) / 1000:.1f} s, {size[0]}x{size[1]}, {Path(out).stat().st_size / 1e6:.2f} MB")


def main() -> None:
    parser = argparse.ArgumentParser(description="Assemble rendered frames into a looping GIF or animated WebP that opens on the reference illustration.")
    parser.add_argument("frames", nargs="+")
    parser.add_argument("--out", required=True)
    parser.add_argument("--reference", help="illustration to open on and return to, cross-faded with the render")
    parser.add_argument("--fps", type=float, default=12)
    parser.add_argument("--hold", type=float, default=1.2, help="seconds the reference stays on screen")
    parser.add_argument("--fade", type=float, default=0.8, help="seconds of each cross-fade")
    parser.add_argument("--width", type=int, default=960)
    parser.add_argument("--crop", type=float, nargs=5, metavar=("X0", "Y0", "X1", "Y1", "SOURCE_WIDTH"), help="crop box in pixels of an image SOURCE_WIDTH wide, applied to every input")
    parser.add_argument("--colors", type=int, default=255)
    parser.add_argument("--dither", type=float, default=7.0, help="Bayer-matrix dither amplitude in 8-bit steps, 0 to switch off")
    parser.add_argument("--quality", type=int, default=88, help="lossy quality of an animated WebP (.webp output)")
    args = parser.parse_args()

    first = Image.open(args.frames[0])
    crop = list(args.crop) if args.crop else None
    aspect = ((crop[3] - crop[1]) / (crop[2] - crop[0])) if crop else first.height / first.width
    size = (args.width, round(args.width * aspect))
    renders = [load(path, size, crop) for path in args.frames]
    reference = load(args.reference, size, crop) if args.reference else None

    frames, durations = [], []
    step = round(1000 / args.fps)
    fade = max(0, round(args.fade * args.fps))
    if reference is not None:
        frames.append(reference)
        durations.append(round(args.hold * 1000))
        for k in range(1, fade + 1):
            frames.append(reference + (renders[0] - reference) * k / (fade + 1))
            durations.append(step)
    frames += renders
    durations += [step] * len(renders)
    if reference is not None:
        for k in range(1, fade + 1):
            frames.append(renders[-1] + (reference - renders[-1]) * k / (fade + 1))
            durations.append(step)

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    if Path(args.out).suffix.lower() == ".webp":
        images = [Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8)) for frame in frames]
        images[0].save(args.out, save_all=True, append_images=images[1:], duration=durations, loop=0, quality=args.quality, method=6)
        report(args.out, len(images), durations, size)
        return

    palette = build_palette(frames[:: max(1, len(frames) // 12)] + ([reference] if reference is not None else []), min(args.colors, 255))
    tree = cKDTree(palette)
    threshold = bayer()
    encoded, previous = [], None
    for frame in frames:
        current = indices(frame, tree, threshold, args.dither)
        coded = current.copy()
        if previous is not None:
            coded[current == previous] = TRANSPARENT
        previous = current
        image = Image.frombytes("P", (coded.shape[1], coded.shape[0]), coded.tobytes())
        flat = np.zeros(768, np.uint8)
        flat[: palette.size] = palette.astype(np.uint8).reshape(-1)
        image.putpalette(flat.tolist())
        encoded.append(image)
    encoded[0].save(args.out, save_all=True, append_images=encoded[1:], duration=durations, loop=0, disposal=1, transparency=TRANSPARENT, optimize=False)
    report(args.out, len(encoded), durations, size)


if __name__ == "__main__":
    main()
