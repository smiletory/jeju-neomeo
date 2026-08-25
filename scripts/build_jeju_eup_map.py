"""Build a compact SVG-path dataset for Jeju's 14 game regions.

Source data is the 2026-07-01 admdongkor GeoJSON, derived from Statistics
Korea SGIS administrative boundaries. The output is intentionally small
enough to ship with the desktop demo.
"""

from __future__ import annotations

import json
import math
from itertools import pairwise
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "web" / "assets" / "HangJeongDong_ver20260701.geojson"
OUTPUT = ROOT / "web" / "jeju-map-data.js"

RURAL_BY_CODE = {
    "5011025000": ("hallim", "한림읍", "eup"),
    "5011025300": ("aewol", "애월읍", "eup"),
    "5011025600": ("gujwa", "구좌읍", "eup"),
    "5011025900": ("jocheon", "조천읍", "eup"),
    "5011031000": ("hangyeong", "한경면", "myeon"),
    "5011032000": ("chuja", "추자면", "myeon"),
    "5011033000": ("udo", "우도면", "myeon"),
    "5013025000": ("daejeong", "대정읍", "eup"),
    "5013025300": ("namwon", "남원읍", "eup"),
    "5013025900": ("seongsan", "성산읍", "eup"),
    "5013031000": ("andeok", "안덕면", "myeon"),
    "5013032000": ("pyoseon", "표선면", "myeon"),
}

CHUJA_CODE = "5011032000"
JEJU_CITY_CODE = "50110"
SEOGWIPO_CITY_CODE = "50130"
VIEW_WIDTH = 1200
VIEW_HEIGHT = 700
PADDING = 38
SIMPLIFY_TOLERANCE = 0.72

# The two grouped city labels are moved slightly into open space so all
# fourteen game regions remain readable at the 1920x1200 demo resolution.
LABEL_OVERRIDES = {
    "jeju_dongs": (580.0, 238.0),
    "seogwipo_dongs": (566.0, 445.0),
    "udo": (1083.0, 126.0),
    "chuja": (1084.0, 546.0),
}

CHUJA_INSET = {"x": 1004, "y": 475, "width": 166, "height": 150}


def iter_rings(geometry: dict):
    if geometry["type"] == "Polygon":
        yield from geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        for polygon in geometry["coordinates"]:
            yield from polygon


def point_segment_distance(point, start, end):
    px, py = point
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def simplify_open(points, tolerance):
    if len(points) <= 2:
        return points
    start, end = points[0], points[-1]
    index = -1
    max_distance = 0.0
    for current_index, point in enumerate(points[1:-1], start=1):
        distance = point_segment_distance(point, start, end)
        if distance > max_distance:
            index = current_index
            max_distance = distance
    if max_distance <= tolerance:
        return [start, end]
    left = simplify_open(points[: index + 1], tolerance)
    right = simplify_open(points[index:], tolerance)
    return left[:-1] + right


def simplify_ring(points, tolerance):
    if len(points) < 5:
        return points
    open_points = points[:-1] if points[0] == points[-1] else points
    anchor = min(range(len(open_points)), key=lambda idx: (open_points[idx][0], open_points[idx][1]))
    rotated = open_points[anchor:] + open_points[:anchor] + [open_points[anchor]]
    simplified = simplify_open(rotated, tolerance)
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return simplified


def signed_area(ring):
    return sum(
        x1 * y2 - x2 * y1
        for (x1, y1), (x2, y2) in pairwise(ring)
    ) / 2


def polygon_centroid(ring):
    area = signed_area(ring)
    if abs(area) < 1e-9:
        return (
            sum(point[0] for point in ring[:-1]) / max(1, len(ring) - 1),
            sum(point[1] for point in ring[:-1]) / max(1, len(ring) - 1),
        )
    cx = cy = 0.0
    for (x1, y1), (x2, y2) in pairwise(ring):
        cross = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    return cx / (6 * area), cy / (6 * area)


def main_exterior(geometry, project):
    exteriors = []
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    for polygon in polygons:
        ring = [project(*point) for point in polygon[0]]
        exteriors.append(ring)
    return max(exteriors, key=lambda ring: abs(signed_area(ring)))


def geometry_centroid(geometries, project):
    """Return an area-weighted centroid across one or more geometries."""
    weighted_x = weighted_y = total_area = 0.0
    for geometry in geometries:
        polygons = (
            [geometry["coordinates"]]
            if geometry["type"] == "Polygon"
            else geometry["coordinates"]
        )
        for polygon in polygons:
            ring = [project(*point) for point in polygon[0]]
            area = abs(signed_area(ring))
            if area <= 1e-9:
                continue
            centroid_x, centroid_y = polygon_centroid(ring)
            weighted_x += centroid_x * area
            weighted_y += centroid_y * area
            total_area += area
    if total_area <= 1e-9:
        return 0.0, 0.0
    return weighted_x / total_area, weighted_y / total_area


def geometry_path(geometry, project):
    commands = []
    for source_ring in iter_rings(geometry):
        ring = [project(*point) for point in source_ring]
        if len(ring) < 4:
            continue
        xs = [point[0] for point in ring]
        ys = [point[1] for point in ring]
        if (max(xs) - min(xs)) * (max(ys) - min(ys)) < 0.8:
            continue
        ring = simplify_ring(ring, SIMPLIFY_TOLERANCE)
        commands.append(
            "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in ring[:-1]) + "Z"
        )
    return "".join(commands)


def make_project(features, width, height, padding, offset_x=0, offset_y=0):
    latitudes = []
    longitudes = []
    for feature in features:
        for ring in iter_rings(feature["geometry"]):
            for longitude, latitude in ring:
                longitudes.append(longitude)
                latitudes.append(latitude)

    mean_latitude = math.radians((min(latitudes) + max(latitudes)) / 2)
    min_x = min(longitudes) * math.cos(mean_latitude)
    max_x = max(longitudes) * math.cos(mean_latitude)
    min_y, max_y = min(latitudes), max(latitudes)
    scale = min(
        (width - padding * 2) / (max_x - min_x),
        (height - padding * 2) / (max_y - min_y),
    )
    map_width = (max_x - min_x) * scale
    map_height = (max_y - min_y) * scale
    inset_x = offset_x + (width - map_width) / 2
    inset_y = offset_y + (height - map_height) / 2

    def project(longitude, latitude):
        x = (longitude * math.cos(mean_latitude) - min_x) * scale + inset_x
        y = (max_y - latitude) * scale + inset_y
        return x, y

    return project


def main():
    with SOURCE.open(encoding="utf-8") as source_file:
        collection = json.load(source_file)

    all_jeju_features = [
        feature
        for feature in collection["features"]
        if feature["properties"].get("sido") == "50"
    ]
    main_features = [
        feature
        for feature in all_jeju_features
        if feature["properties"].get("adm_cd2") != CHUJA_CODE
    ]
    chuja_feature = next(
        feature
        for feature in all_jeju_features
        if feature["properties"].get("adm_cd2") == CHUJA_CODE
    )
    project = make_project(main_features, VIEW_WIDTH, VIEW_HEIGHT, PADDING)

    features_by_code = {
        feature["properties"].get("adm_cd2"): feature for feature in all_jeju_features
    }
    jeju_dongs = [
        feature
        for feature in all_jeju_features
        if feature["properties"].get("sgg") == JEJU_CITY_CODE
        and not feature["properties"]["adm_nm"].endswith(("읍", "면"))
    ]
    seogwipo_dongs = [
        feature
        for feature in all_jeju_features
        if feature["properties"].get("sgg") == SEOGWIPO_CITY_CODE
        and not feature["properties"]["adm_nm"].endswith(("읍", "면"))
    ]
    if len(jeju_dongs) != 19 or len(seogwipo_dongs) != 12:
        raise ValueError(
            f"Expected 19 Jeju-si and 12 Seogwipo-si dongs, got "
            f"{len(jeju_dongs)} and {len(seogwipo_dongs)}"
        )

    regions = []
    for code, (region_id, name, kind) in RURAL_BY_CODE.items():
        feature = features_by_code[code]
        if code == CHUJA_CODE:
            continue
        label_x, label_y = geometry_centroid([feature["geometry"]], project)
        label_x, label_y = LABEL_OVERRIDES.get(region_id, (label_x, label_y))
        regions.append(
            {
                "id": region_id,
                "name": name,
                "code": code,
                "kind": kind,
                "path": geometry_path(feature["geometry"], project),
                "label": [round(label_x, 1), round(label_y, 1)],
                "locked": region_id != "gujwa",
            }
        )

    for region_id, name, features in (
        ("jeju_dongs", "제주 열아홉 동네", jeju_dongs),
        ("seogwipo_dongs", "서귀포 열두 동네", seogwipo_dongs),
    ):
        label_x, label_y = LABEL_OVERRIDES[region_id]
        regions.append(
            {
                "id": region_id,
                "name": name,
                "kind": "dong-group",
                "path": "".join(
                    geometry_path(feature["geometry"], project) for feature in features
                ),
                "label": [label_x, label_y],
                "locked": True,
                "memberCount": len(features),
            }
        )

    inset_project = make_project(
        [chuja_feature],
        CHUJA_INSET["width"],
        CHUJA_INSET["height"] - 30,
        15,
        CHUJA_INSET["x"],
        CHUJA_INSET["y"] + 24,
    )
    regions.append(
        {
            "id": "chuja",
            "name": "추자면",
            "code": CHUJA_CODE,
            "kind": "myeon",
            "path": geometry_path(chuja_feature["geometry"], inset_project),
            "label": list(LABEL_OVERRIDES["chuja"]),
            "locked": True,
            "inset": True,
        }
    )

    if len(regions) != 14:
        raise ValueError(f"Expected 14 game regions, got {len(regions)}")

    base_paths = [geometry_path(feature["geometry"], project) for feature in main_features]

    payload = {
        "viewBox": f"0 0 {VIEW_WIDTH} {VIEW_HEIGHT}",
        "source": "SGIS 기반 admdongkor 2026-07-01 행정동 경계",
        "basePaths": base_paths,
        "regions": regions,
        "insets": [
            {
                **CHUJA_INSET,
                "title": "제주 북쪽 바다",
                "region": "chuja",
            }
        ],
    }
    OUTPUT.write_text(
        "window.JEJU_MAP_DATA=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
