#!/usr/bin/env python3
"""Check an advanced-runtime scene against its asset manifest."""
import argparse
from collections import Counter
import json
from pathlib import Path

from check_manifest import Invalid, integer, need, nonempty, number, read_json, vector


def validate(manifest, scene):
    need(isinstance(manifest, dict) and manifest.get("version") == 2,
         "expected a v2 asset manifest")
    assets = manifest.get("assets")
    need(isinstance(assets, list) and assets, "manifest.assets: expected a nonempty list")
    counts = {}
    for asset in assets:
        need(isinstance(asset, dict) and nonempty(asset.get("id")), "manifest asset has no id")
        asset_id = asset["id"]
        count = asset.get("gaussianCount")
        need(asset_id not in counts, f"duplicate asset id {asset_id}")
        need(integer(count, True), f"{asset_id}: expected positive gaussianCount")
        counts[asset_id] = count

    need(isinstance(scene, dict), "expected a scene object")
    camera = scene.get("camera")
    need(isinstance(camera, dict), "camera: expected an object")
    vector(camera.get("target"), 3, "camera.target")
    for name in ("yaw", "pitch"):
        need(number(camera.get(name)), f"camera.{name}: expected finite radians")
    need(number(camera.get("span"), True), "camera.span: expected a positive number")

    items = scene.get("items")
    need(isinstance(items, list) and items, "items: expected a nonempty list")
    ids = set()
    usages = Counter()
    for index, item in enumerate(items):
        need(isinstance(item, dict) and nonempty(item.get("id")), f"items[{index}]: missing id")
        item_id = item["id"]
        asset_id = item.get("asset")
        need(item_id not in ids, f"duplicate instance id {item_id}")
        need(nonempty(asset_id) and asset_id in counts, f"{item_id}: unknown asset {asset_id!r}")
        ids.add(item_id)
        usages[asset_id] += 1
        vector(item.get("position"), 3, f"{item_id}.position")
        need(number(item.get("yaw", 0)), f"{item_id}.yaw: expected finite radians")
        scale = item.get("scale", 1)
        if isinstance(scale, list):
            vector(scale, 3, f"{item_id}.scale", positive=True)
        else:
            need(number(scale, True), f"{item_id}.scale: expected a positive number")
        alpha = item.get("alpha", 1)
        need(number(alpha) and 0 <= alpha <= 1, f"{item_id}.alpha: expected [0, 1]")
        intensity = item.get("intensity", 1)
        need(number(intensity) and intensity >= 0, f"{item_id}.intensity: expected a nonnegative number")

    total = sum(counts[key] * amount for key, amount in usages.items())
    budgets = manifest.get("budgets", {})
    need(isinstance(budgets, dict), "budgets: expected an object")
    limit = budgets.get("maxSceneGaussians")
    if limit is not None:
        need(integer(limit, True), "maxSceneGaussians: expected a positive integer")
        need(total <= limit, f"scene uses {total} Gaussians, exceeds budget {limit}")
    return {
        "ok": True,
        "assetsInPack": len(counts),
        "assetsUsed": len(usages),
        "instances": len(items),
        "uniqueGaussians": sum(counts[key] for key in usages),
        "instancedGaussians": total,
        "maxSceneGaussians": limit,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("scene", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        report = validate(read_json(args.manifest), read_json(args.scene))
    except Invalid as error:
        report = {"ok": False, "error": str(error)}

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    elif report["ok"]:
        print(f"PASS: {report['assetsUsed']} assets, {report['instances']} instances, "
              f"{report['instancedGaussians']} instanced Gaussians")
    else:
        print(f"FAIL: {report['error']}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
