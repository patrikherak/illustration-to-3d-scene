import json
import math
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Calibration:
    width: int
    height: int
    anchor_x: float
    anchor_y: float
    px_per_unit: float
    elevation_deg: float = 30.0

    @property
    def elevation(self) -> float:
        return math.radians(self.elevation_deg)

    def to_pixel(self, x: float, y: float, z: float) -> tuple[float, float]:
        e = self.elevation
        s = self.px_per_unit
        return (
            self.anchor_x + s * (x - z) * math.sqrt(0.5),
            self.anchor_y + s * (x + z) * math.sqrt(0.5) * math.sin(e) - s * y * math.cos(e),
        )

    def to_world(self, px: float, py: float, y: float = 0.0) -> tuple[float, float, float]:
        e = self.elevation
        s = self.px_per_unit
        across = (px - self.anchor_x) / (s * math.sqrt(0.5))
        depth = (py - self.anchor_y + s * y * math.cos(e)) / (s * math.sqrt(0.5) * math.sin(e))
        return ((across + depth) / 2, y, (depth - across) / 2)

    def to_json(self) -> dict:
        return {
            "image": [self.width, self.height],
            "anchor": [round(self.anchor_x, 3), round(self.anchor_y, 3)],
            "pxPerUnit": round(self.px_per_unit, 4),
            "elevationDeg": round(self.elevation_deg, 3),
        }

    @staticmethod
    def from_json(data: dict) -> "Calibration":
        return Calibration(
            width=data["image"][0],
            height=data["image"][1],
            anchor_x=data["anchor"][0],
            anchor_y=data["anchor"][1],
            px_per_unit=data["pxPerUnit"],
            elevation_deg=data.get("elevationDeg", 30.0),
        )

    @staticmethod
    def load(path: str | Path) -> "Calibration":
        return Calibration.from_json(json.loads(Path(path).read_text()))
