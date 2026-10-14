#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
python="${PYTHON:-.venv/bin/python}"
"$python" examples/alpine/make_image.py
"$python" tools/calibrate.py examples/alpine/points.json --out examples/alpine/calibration.json
"$python" tools/layout.py examples/alpine/reference.png \
  --calibration examples/alpine/calibration.json \
  --region ground=#f1f3f6:9 --hull ground \
  --region summit=#dbe5ef:6@2.6 --hull summit \
  --region lake=#c4e1f2:7 \
  --path road=#d6c5af:8 --path stream=#50a1d3:20 \
  --bridge 15 --min-area 800 \
  --debug docs/images/layout-debug.png --out examples/alpine/layout.json
