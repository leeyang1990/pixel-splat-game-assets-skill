#!/usr/bin/env python3
"""Validate version 2 pixel Gaussian splat packs with Python's standard library."""
import argparse
import json
import math
from pathlib import Path
import re
import struct
import sys


ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
SPLAT = struct.Struct("<6f8B")
ABS_TOL = 1e-5
REL_TOL = 1e-6


class Invalid(ValueError):
    pass


def need(condition, message):
    if not condition:
        raise Invalid(message)


def number(value, positive=False):
    try:
        valid = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
        return valid and (not positive or value > 0)
    except OverflowError:
        return False


def integer(value, positive=False):
    return isinstance(value, int) and not isinstance(value, bool) and (not positive or value > 0)


def vector(value, size, label, positive=False):
    need(isinstance(value, list) and len(value) == size and all(number(x, positive) for x in value),
         f"{label}: expected {size} finite {'positive ' if positive else ''}numbers")
    return value


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise Invalid(f"{path}: {exc}") from exc


def resource(root, value, label):
    need(nonempty(value), f"{label}: expected a file path")
    need(not Path(value).is_absolute(), f"{label}: use a path relative to the manifest")
    try:
        path = (root / value).resolve()
    except (ValueError, RuntimeError) as exc:
        raise Invalid(f"{label}: invalid path: {exc}") from exc
    need(path.is_relative_to(root), f"{label}: path escapes the pack")
    need(path.is_file(), f"{label}: missing file {value}")
    return path


def tolerance(a, b):
    return ABS_TOL + REL_TOL * max(abs(a), abs(b))


def bounds_data(value):
    need(isinstance(value, dict), "bounds: expected min and max")
    low = vector(value.get("min"), 3, "bounds.min")
    high = vector(value.get("max"), 3, "bounds.max")
    need(all(a <= b for a, b in zip(low, high)), "bounds: min exceeds max")
    return value


def normalized(q, label, require_unit=False):
    norm = math.hypot(*q)
    need(number(norm, True), f"{label}: quaternion must have nonzero finite norm")
    if require_unit:
        need(abs(norm - 1) <= 1e-3 + 1e-12, f"{label}: quaternion norm outside 1e-3 tolerance")
    return [v / norm for v in q]


def check_bounds(record, q, bounds, label):
    x, y, z, w = q
    rotation = (
        (1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)),
        (2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)),
        (2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)),
    )
    for axis, row in enumerate(rotation):
        extent = 3 * math.hypot(*(row[j] * record[3+j] for j in range(3)))
        low, high = record[axis] - extent, record[axis] + extent
        need(number(low) and number(high), f"{label}: non-finite 3-sigma support")
        bmin, bmax = bounds["min"][axis], bounds["max"][axis]
        need(low >= bmin - tolerance(low, bmin) and high <= bmax + tolerance(high, bmax),
             f"{label}: rotated 3-sigma support outside bounds on axis {axis}")


def check_record(record, bounds, label):
    need(all(number(v) for v in record), f"{label}: non-finite or non-numeric component")
    need(all(v > 0 for v in record[3:6]), f"{label}: scales must be positive linear standard deviations")
    need(all(0 <= v <= 1 for v in record[10:14]) and record[13] > 0,
         f"{label}: RGBA must be in 0..1 with alpha > 0")
    q = normalized(record[6:10], label, require_unit=True)
    check_bounds(record, q, bounds, label)
    return q


def check_count(count, limit, label, expected=None):
    need(integer(count, True), f"{label}: Gaussian count must be positive")
    if expected is not None:
        need(count == expected, f"{label}: count {count} differs from gaussianCount {expected}")
    if limit is not None:
        need(count <= limit, f"{label}: {count} Gaussians exceed budget {limit}")


def editable_data(path, bounds, limit, expected=None):
    data = read_json(path)
    need(isinstance(data, dict), f"{path.name}: expected a JSON object")
    need(integer(data.get("version")) and data["version"] == 1, f"{path.name}: version must be 1")
    need(data.get("type") == "gaussian-splats", f"{path.name}: type must be gaussian-splats")
    need(integer(data.get("stride")) and data["stride"] == 14, f"{path.name}: stride must be 14")
    splats = data.get("splats")
    need(isinstance(splats, list) and len(splats) > 0 and len(splats) % 14 == 0,
         f"{path.name}: splats must be a nonempty flat array with stride 14")
    check_count(len(splats) // 14, limit, path.name, expected)
    for offset in range(0, len(splats), 14):
        check_record(splats[offset:offset+14], bounds, f"{path.name}: Gaussian {offset // 14}")
    return splats


def binary_data(path, bounds, limit, expected=None, editable=None):
    need(path.suffix == ".splat", f"{path.name}: expected a Gaussian .splat file")
    raw = path.read_bytes()
    need(len(raw) > 0 and len(raw) % SPLAT.size == 0,
         f"{path.name}: byte length must be a nonzero multiple of 32")
    count = len(raw) // SPLAT.size
    check_count(count, limit, path.name, expected)
    if editable is not None:
        need(count == len(editable) // 14, f"{path.name}: binary and editable JSON counts differ")
    for index, packed in enumerate(SPLAT.iter_unpack(raw)):
        label = f"{path.name}: Gaussian {index}"
        # Binary quaternion bytes are WXYZ; all validation uses normalized XYZW.
        w, x, y, z = ((b - 128) / 128 for b in packed[10:14])
        q = normalized([x, y, z, w], label)
        record = list(packed[:6]) + q + [b / 255 for b in packed[6:10]]
        check_record(record, bounds, label)
        if editable is None:
            continue
        original = editable[index*14:(index+1)*14]
        need(all(abs(a-b) <= tolerance(a, b) for a, b in zip(record[:6], original[:6])),
             f"{label}: position/scale differs from editable JSON")
        need(all(abs(a-b) <= 1/255 + 1e-12 for a, b in zip(record[10:14], original[10:14])),
             f"{label}: RGBA differs from editable JSON by more than 1/255")
        original_q = normalized(original[6:10], label, require_unit=True)
        dot = abs(sum(a*b for a, b in zip(q, original_q)))
        need(dot >= 0.9998 - 1e-12, f"{label}: quaternion differs from editable JSON (absdot < 0.9998)")
    return count


def gameplay_data(asset, root):
    colliders = asset.get("colliders", [])
    need(isinstance(colliders, list), "colliders: expected array")
    for collider in colliders:
        need(isinstance(collider, dict), "collider: expected object")
        vector(collider.get("center"), 3, "collider.center")
        if collider.get("shape") == "box":
            vector(collider.get("size"), 3, "collider.size", positive=True)
        elif collider.get("shape") == "sphere":
            need(number(collider.get("radius"), True), "sphere: expected positive radius")
        else:
            raise Invalid("collider.shape: supported forms are box and sphere; use an adapter for others")
    anchors = asset.get("anchors", {})
    need(isinstance(anchors, dict), "anchors: expected object")
    for name, value in anchors.items():
        need(nonempty(name), "anchor: empty name")
        vector(value, 3, f"anchor.{name}")
    clips = asset.get("clips", [])
    need(isinstance(clips, list), "clips: expected array")
    names = set()
    for clip in clips:
        need(isinstance(clip, dict), "clip: expected object")
        name = clip.get("name")
        need(nonempty(name) and name not in names, "clip.name: missing or duplicate")
        names.add(name)
        duration = clip.get("duration")
        need(number(duration, True), f"clip {name}: duration must be positive")
        need(isinstance(clip.get("loop"), bool), f"clip {name}: loop must be boolean")
        if "file" in clip:
            resource(root, clip["file"], f"clip {name}.file")
        events = clip.get("events", [])
        need(isinstance(events, list), f"clip {name}: events must be an array")
        for event in events:
            need(isinstance(event, dict) and nonempty(event.get("name")), f"clip {name}: invalid event")
            need(number(event.get("time")) and 0 <= event["time"] <= duration,
                 f"clip {name}: event time outside clip")
    variants = asset.get("variants", [])
    need(isinstance(variants, list) and all(nonempty(v) for v in variants), "variants: expected array of asset ids")


def validate_asset(asset, root, limit):
    need(isinstance(asset, dict), "asset must be an object")
    aid = asset.get("id")
    need(isinstance(aid, str) and ID.fullmatch(aid), "invalid asset id")
    for field in ("type", "usage", "license"):
        need(nonempty(asset.get(field)), f"{field}: expected nonempty text")
    need(asset.get("representation") == "gaussian-splat", "representation must be gaussian-splat")
    paths = {}
    for field, required in (("file", f"assets/{aid}.splat"),
                            ("editable", f"assets/{aid}.gaussians.json")):
        need(asset.get(field) == required, f"{field}: must be {required}")
        paths[field] = resource(root, asset[field], field)
    paths["source"] = resource(root, asset.get("source"), "source")
    if "seed" in asset:
        need(integer(asset["seed"]), "seed: expected integer")
    vector(asset.get("pivot"), 3, "pivot")
    bounds = bounds_data(asset.get("bounds"))
    expected = asset.get("gaussianCount")
    need(integer(expected, True), "gaussianCount: expected positive integer")
    need(paths["file"].stat().st_size == expected * 32, "gaussianCount: binary byte count differs")
    material = asset.get("material", {})
    need(isinstance(material, dict), "material: expected object")
    if "kind" in material:
        need(nonempty(material["kind"]), "material.kind: expected text")
    if "reflect" in material:
        need(isinstance(material["reflect"], bool), "material.reflect: expected boolean")
    if "lighting" in material:
        need(nonempty(material["lighting"]), "material.lighting: expected text")
        if "world" in material["lighting"]:
            need(material.get("normalBasis") == "quaternion-local +Z",
                 "material.normalBasis: world lighting requires quaternion-local +Z")
    if "materialRanges" in asset:
        ranges = asset["materialRanges"]
        need(isinstance(ranges, list) and ranges, "materialRanges: expected nonempty array")
        covered = bytearray(expected)
        for entry in ranges:
            need(isinstance(entry, dict) and nonempty(entry.get("kind")), "material range: expected kind")
            start, count = entry.get("start"), entry.get("count")
            need(integer(start) and start >= 0 and integer(count, True) and start + count <= expected,
                 "material range: expected Gaussian record indices within asset")
            for i in range(start, start + count):
                need(not covered[i], "material range: overlap")
                covered[i] = 1
        need(all(covered), "material ranges: must cover asset")
    if "pixelDetailRanges" in asset:
        ranges = asset["pixelDetailRanges"]
        need(isinstance(ranges, list) and ranges, "pixelDetailRanges: expected nonempty array")
        covered = set()
        for entry in ranges:
            need(isinstance(entry, dict), "pixel detail range: expected object")
            start, count = entry.get("start"), entry.get("count")
            need(integer(start) and integer(count) and start >= 0 and count > 0 and start + count <= expected,
                 "pixel detail range: expected Gaussian record indices within asset")
            for i in range(start, start + count):
                need(i not in covered, "pixel detail range: overlap")
                covered.add(i)
    if "animationBounds" in asset:
        animated = bounds_data(asset["animationBounds"])
        need(all(animated["min"][i] <= bounds["min"][i] and animated["max"][i] >= bounds["max"][i]
                 for i in range(3)), "animationBounds: must contain rest bounds")
    if "parts" in asset:
        parts = asset["parts"]
        need(isinstance(parts, list) and parts, "parts: expected nonempty array")
        covered = bytearray(expected)
        names = set()
        for part in parts:
            need(isinstance(part, dict), "part: expected object")
            name, start, count = part.get("name"), part.get("start"), part.get("count")
            need(nonempty(name) and name not in names, "part.name: missing or duplicate")
            names.add(name)
            need(integer(start) and start >= 0 and integer(count, True) and start + count <= expected,
                 "part range: expected Gaussian record indices within asset")
            vector(part.get("pivot"), 3, "part.pivot")
            for i in range(start, start + count):
                need(not covered[i], "part range: overlap")
                covered[i] = 1
        need(all(covered), "part ranges: must cover asset")
    editable = editable_data(paths["editable"], bounds, limit, expected)
    count = binary_data(paths["file"], bounds, limit, expected, editable)
    gameplay_data(asset, root)
    lods = asset.get("lods", [])
    need(isinstance(lods, list), "lods: expected array")
    levels = set()
    for lod in lods:
        need(isinstance(lod, dict) and integer(lod.get("level"), True), "lod.level must be a positive integer")
        need(lod["level"] not in levels, "duplicate lod.level")
        levels.add(lod["level"])
        path = resource(root, lod.get("file"), "lod.file")
        for key in ("gaussianCount", "pointCount"):
            if key in lod:
                need(integer(lod[key], True), f"lod.{key}: expected positive integer")
        lod_editable = None
        if "editable" in lod:
            lod_editable = editable_data(resource(root, lod["editable"], "lod.editable"), bounds, limit)
        actual = binary_data(path, bounds, limit, editable=lod_editable)
        for key in ("gaussianCount", "pointCount"):
            if key in lod:
                need(actual == lod[key], f"lod.{key} differs from data")
    return aid, count


def validate(path):
    path = Path(path).resolve()
    root = path.parent
    result = {"ok": False, "assets": 0, "gaussians": 0, "warnings": [], "errors": []}
    try:
        data = read_json(path)
        need(isinstance(data, dict), "manifest must be an object")
        need(integer(data.get("version")) and data["version"] == 2, "version must be 2")
        need(data.get("pipeline") == "pixel-gaussian-splat", "pipeline must be pixel-gaussian-splat")
        if "pack" in data:
            need(isinstance(data["pack"], str) and ID.fullmatch(data["pack"]), "invalid pack name")
        units = data.get("units")
        need(isinstance(units, dict), "units required")
        axes = {"+X", "-X", "+Y", "-Y", "+Z", "-Z"}
        up, forward = units.get("up"), units.get("forward")
        need(isinstance(up, str) and isinstance(forward, str) and up in axes and forward in axes
             and up[-1] != forward[-1], "units: up and forward must be different coordinate axes")
        need(number(units.get("tile"), True), "units.tile must be positive")
        if "seed" in data:
            need(integer(data["seed"]), "seed must be integer")
        if "style" in data:
            resource(root, data["style"], "style")
        budgets = data.get("budgets", {})
        need(isinstance(budgets, dict), "budgets must be an object")
        limit = budgets.get("maxGaussiansPerAsset")
        if "maxGaussiansPerAsset" in budgets:
            need(integer(limit, True), "maxGaussiansPerAsset must be a positive integer")
        assets = data.get("assets")
        need(isinstance(assets, list) and len(assets) > 0, "assets must be a nonempty array")
        ids = set()
        for index, asset in enumerate(assets):
            try:
                aid, count = validate_asset(asset, root, limit)
                need(aid not in ids, f"duplicate asset id {aid}")
                ids.add(aid)
                result["assets"] += 1
                result["gaussians"] += count
            except (Invalid, OSError, RuntimeError) as exc:
                label = asset.get("id", str(index)) if isinstance(asset, dict) else str(index)
                result["errors"].append(f"{label}: {exc}")
        for asset in assets:
            if isinstance(asset, dict) and isinstance(asset.get("variants", []), list):
                for variant in asset.get("variants", []):
                    if isinstance(variant, str) and variant not in ids:
                        result["errors"].append(f"{asset.get('id')}: unknown variant {variant}")
    except (Invalid, OSError, RuntimeError) as exc:
        result["errors"].append(str(exc))
    result["ok"] = not result["errors"]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--json", action="store_true", help="print a machine-readable report")
    args = parser.parse_args()
    result = validate(args.manifest)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"{'PASS' if result['ok'] else 'FAIL'}: {result['assets']} assets, {result['gaussians']} base Gaussians")
        for warning in result["warnings"]:
            print(f"WARN: {warning}")
        for error in result["errors"]:
            print(f"ERROR: {error}")
        print("Data checks only; verify Gaussian rendering, game behavior and performance separately.")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
