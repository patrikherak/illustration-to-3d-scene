import argparse
import json
import sys
from pathlib import Path

import numpy as np

from iso import Calibration


def solve(points: list[dict], elevation_deg: float) -> tuple[Calibration, float]:
    rows, rhs = [], []
    probe = Calibration(0, 0, 0.0, 0.0, 1.0, elevation_deg)
    for p in points:
        x, y, z = p["world"]
        u, v = probe.to_pixel(x, y, z)
        rows.append([1.0, 0.0, u])
        rhs.append(p["pixel"][0])
        rows.append([0.0, 1.0, v])
        rhs.append(p["pixel"][1])
    a = np.array(rows)
    b = np.array(rhs)
    (ax, ay, s), *_ = np.linalg.lstsq(a, b, rcond=None)
    residual = float(np.sqrt(np.mean((a @ np.array([ax, ay, s]) - b) ** 2)))
    return Calibration(0, 0, float(ax), float(ay), float(s), elevation_deg), residual


def main() -> None:
    parser = argparse.ArgumentParser(description="Fit an isometric camera to pixel ↔ world correspondences.")
    parser.add_argument("points", help="JSON file: {\"image\": [w, h], \"points\": [{\"pixel\": [x, y], \"world\": [x, y, z]}, ...]}")
    parser.add_argument("--elevation", type=float, default=None, help="fix the camera elevation in degrees (default: fit 15–60°)")
    parser.add_argument("--out", default=None, help="write calibration JSON here")
    args = parser.parse_args()

    data = json.loads(Path(args.points).read_text())
    points = data["points"]
    if len(points) < 2:
        sys.exit("need at least two points (three or more on different axes is better)")
    candidates = [args.elevation] if args.elevation is not None else [e / 10 for e in range(150, 601)]
    best = min((solve(points, e) for e in candidates), key=lambda r: r[1])
    cal, residual = best
    cal = Calibration(data["image"][0], data["image"][1], cal.anchor_x, cal.anchor_y, cal.px_per_unit, cal.elevation_deg)
    result = cal.to_json() | {"residualPx": round(residual, 3)}
    text = json.dumps(result, indent=2)
    if args.out:
        Path(args.out).write_text(text + "\n")
    print(text)
    for p in points:
        px, py = cal.to_pixel(*p["world"])
        print(f"  {p.get('name', p['world'])}: picked {p['pixel']} → model ({px:.1f}, {py:.1f})", file=sys.stderr)


if __name__ == "__main__":
    main()
