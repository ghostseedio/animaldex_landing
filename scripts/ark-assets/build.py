"""Builds one Ark asset set: geometry -> raw GLB -> gltfpack (meshopt) -> public/ark/assets/v1/<set>/,
the set's attach.json, its entry in src/ark-scene/assets-manifest.json, and contact-sheet tiles.

Run inside Blender (it renders the tiles with Cycles on the CPU), from the repo root:

  nice -n 10 blender -b --factory-startup -t 6 --python scripts/ark-assets/build.py -- --set trees
  options: --only oak,beech   --no-render   --no-pack   --work <dir>

Then `python3 scripts/ark-assets/sheet.py --set trees --work <dir> --out <dir>` lays the tiles out.
"""

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402

import arkgeo  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_BASE = os.path.join(REPO, "public", "ark", "assets", "v1")
MANIFEST = os.path.join(REPO, "src", "ark-scene", "assets-manifest.json")
GLTFPACK = "gltfpack@1.3.0"
PACK_ARGS = ["-cc", "-vpf", "-kv", "-km"]

TAGS = {
    "leaf": dict(spot="flowers", about="upper side of a real leaf blade"),
    "branch": dict(spot="bark", about="top of a roughly horizontal branch; forward runs along it"),
    "bark": dict(spot="bark", about="trunk surface; normal points out, forward points up the trunk (clingers)"),
    "tree_hollow": dict(spot="bark", about="the mouth of a hole in a trunk; normal out of the hole"),
    "crown": dict(spot="bark", about="the top of a palm trunk among the frond bases"),
    "frond": dict(spot="bark", about="top of a palm frond's midrib"),
    "root": dict(spot="rocks", about="top of an above-ground root (prop roots, root flares)"),
    "fruit": dict(spot="flowers", about="on top of a hanging fruit"),
    "flower_head": dict(spot="flowers", about="the centre of an open flower, normal out of the flower"),
    "bromeliad": dict(spot="pond_surface", about="the water cup of a bromeliad rosette"),
    "fungus_shelf": dict(spot="bark", about="the top of a bracket fungus"),
    "stem": dict(spot="flowers", about="a plant stem or grass blade; forward runs up it"),
    "pad": dict(spot="pond_surface", about="the top of a floating leaf (lily pad)"),
    "rock_face": dict(spot="rocks", about="a rock surface, up-facing or steep"),
    "ledge": dict(spot="rocks", about="a flat shelf on a cliff or boulder"),
    "crevice": dict(spot="rocks", about="a crack or gap between stones; normal out of it"),
    "tide_pool": dict(spot="pond_surface", about="the water surface in a rock hollow"),
    "burrow_entrance": dict(spot="leaf_litter", about="an opening into the ground, a log or under a stone"),
    "cave_mouth": dict(spot="rocks", about="the floor at the mouth of a cave"),
    "cave_ceiling": dict(spot="rocks", about="the underside of a cave roof (bats); normal points down"),
    "leaf_litter": dict(spot="leaf_litter", about="the ground among fallen leaves, twigs or cones"),
    "log_top": dict(spot="bark", about="the top of a fallen log; forward runs along it"),
    "moss": dict(spot="leaf_litter", about="a moss cushion"),
    "soil": dict(spot="leaf_litter", about="bare soil"),
    "shell": dict(spot="rocks", about="on or in a shell on the shore"),
    "sand": dict(spot="rocks", about="sand or shingle between stones"),
}


def run_gltfpack(src, dst):
    run = subprocess.run(["npx", "--yes", GLTFPACK, "-i", src, "-o", dst, *PACK_ARGS], capture_output=True, text=True)
    if run.returncode != 0 or not os.path.exists(dst):
        raise RuntimeError(f"gltfpack failed for {src}: {(run.stderr or run.stdout)[:400]}")


def load_set(name):
    if name == "trees":
        import trees
        return trees.all_trees
    if name == "plants":
        import plants
        return plants.all_plants
    if name == "rocks":
        import rocks
        return rocks.all_rocks
    if name == "floor":
        import floor
        return floor.all_floor
    raise SystemExit(f"unknown set {name}")


# MARK: - Blender rendering

def blender_scene():
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 6
    scene.render.resolution_x = 480
    scene.render.resolution_y = 480
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes.get("Background") or nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexGradient")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = (0, -math.pi / 2, 0)
    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], sky.inputs["Vector"])
    nt.links.new(sky.outputs["Fac"], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].color = (0.62, 0.66, 0.62, 1)
    ramp.color_ramp.elements[1].color = (0.42, 0.58, 0.82, 1)
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.9
    out = nt.nodes.get("World Output") or nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    scene.world = world
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3.2
    sun.angle = math.radians(6)
    sun.color = (1.0, 0.96, 0.9)
    so = bpy.data.objects.new("sun", sun)
    so.rotation_euler = (math.radians(42), math.radians(8), math.radians(35))
    scene.collection.objects.link(so)
    # Ground
    me = bpy.data.meshes.new("ground")
    s = 400
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    g = bpy.data.objects.new("ground", me)
    gm = bpy.data.materials.new("ground")
    gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.2, 0.21, 0.17, 1)
    gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    me.materials.append(gm)
    scene.collection.objects.link(g)
    mat = bpy.data.materials.new("vc")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    attr = nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "Col"
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    # Single-sided twin (cards): back faces are invisible, as with three's FrontSide.
    single = mat.copy()
    single.name = "vc_single"
    nt = single.node_tree
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    mixs = nt.nodes.new("ShaderNodeMixShader")
    outn = nt.nodes["Material Output"]
    nt.links.new(geo.outputs["Backfacing"], mixs.inputs["Fac"])
    nt.links.new(nt.nodes["Principled BSDF"].outputs["BSDF"], mixs.inputs[1])
    nt.links.new(transp.outputs["BSDF"], mixs.inputs[2])
    nt.links.new(mixs.outputs["Shader"], outn.inputs["Surface"])
    cam = bpy.data.cameras.new("cam")
    cam.lens = 50
    co = bpy.data.objects.new("cam", cam)
    scene.collection.objects.link(co)
    scene.camera = co
    return dict(scene=scene, mat=mat, single=single, cam=co, ground=g)


def to_bpy(env, name, mesh, morph=False, single=False):
    import bpy
    d = mesh.finalize()
    P = d["M"] if morph and "M" in d else d["P"]
    N = d["MN"] if morph and "MN" in d else d["N"]
    conv = lambda a: np.stack([a[:, 0], -a[:, 2], a[:, 1]], 1)
    me = bpy.data.meshes.new(name)
    me.from_pydata(conv(P).tolist(), [], d["F"].tolist())
    me.update()
    ca = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    C = arkgeo.srgb_to_linear(np.clip(d["C"], 0, 1))
    C[:, 3] = 1
    ca.data.foreach_set("color", C.astype(np.float32).ravel())
    me.normals_split_custom_set_from_vertices(conv(N).tolist())
    me.materials.append(env["single"] if single else env["mat"])
    ob = bpy.data.objects.new(name, me)
    env["scene"].collection.objects.link(ob)
    return ob


def render_tile(env, ob, path, lo, hi, elev=14, az=35, zoom=1.0, box=None):
    import bpy
    from mathutils import Vector
    # Bounds in Blender axes, from the object itself (or a close-up box given in glTF axes).
    if box is not None:
        b = np.array(box, float)
        conv = np.stack([b[:, 0], -b[:, 2], b[:, 1]], 1)
        lo, hi2 = conv.min(0), conv.max(0)
    else:
        pts = np.array([ob.matrix_world @ Vector(c) for c in ob.bound_box])
        lo, hi2 = pts.min(0), pts.max(0)
    centre = (lo + hi2) / 2
    radius = np.linalg.norm(hi2 - lo) / 2 * zoom
    fov = 2 * math.atan(18 / env["cam"].data.lens)
    dist = radius / math.sin(fov / 2) * 1.02
    e, a = math.radians(elev), math.radians(az)
    direction = np.array([math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)])
    cam = env["cam"]
    cam.location = Vector(centre + direction * dist)
    look = Vector(centre) - cam.location
    cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = dist * 4 + 100
    for other in env["scene"].collection.objects:
        if other.type == "MESH" and other.name != "ground":
            other.hide_render = other != ob
    env["scene"].render.filepath = path
    bpy.ops.render.render(write_still=True)


# MARK: - Main

def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", required=True)
    ap.add_argument("--only", default="")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--no-pack", action="store_true")
    ap.add_argument("--shots", default="", help="only render these tiles (e.g. card); keeps the others")
    ap.add_argument("--work", default=os.environ.get("ARK_ASSETS_WORK", "/tmp/ark-assets-work"))
    args = ap.parse_args(argv)
    only = [s for s in args.only.split(",") if s]
    work = os.path.abspath(args.work)
    raw_dir = os.path.join(work, "raw", args.set)
    tile_dir = os.path.join(work, "tiles", args.set)
    out_dir = os.path.join(OUT_BASE, args.set)
    for d in (raw_dir, tile_dir, out_dir):
        os.makedirs(d, exist_ok=True)

    factories = list(load_set(args.set)(only or None))
    env = None if args.no_render else blender_scene()
    attach_path = os.path.join(out_dir, "attach.json")
    attach_all = json.load(open(attach_path)) if os.path.exists(attach_path) else {}
    frag_path = os.path.join(work, f"manifest-{args.set}.json")
    frag = json.load(open(frag_path)) if os.path.exists(frag_path) else {}
    tiles = json.load(open(os.path.join(work, f"tiles-{args.set}.json"))) if os.path.exists(
        os.path.join(work, f"tiles-{args.set}.json")) else {}
    for make in factories:
        t0 = time.time()
        asset = make()
        aid = asset.id
        files = []
        levels = [(f"lod{i}", m) for i, m in enumerate(asset.lods)]
        if asset.card is not None and asset.card.parts:
            levels.append(("card", asset.card))
        for label, mesh in levels:
            name = f"{aid}.{label}"
            raw = os.path.join(raw_dir, name + ".glb")
            sided = asset.double_sided and label != "card"
            info = arkgeo.write_glb(raw, mesh, name, sided,
                                    target_names=asset.meta.get("morph_targets"))
            dst = os.path.join(out_dir, name + ".glb")
            if not args.no_pack:
                run_gltfpack(raw, dst)
            else:
                shutil.copy(raw, dst)
            files.append(dict(level=label, file=f"{args.set}/{name}.glb", tris=info["tris"], verts=info["verts"],
                              bytes=os.path.getsize(dst), doubleSided=sided, morph=mesh.has_morph()))
        lo, hi = asset.lods[0].bounds()
        public_meta = {k: v for k, v in asset.meta.items() if k not in ("view", "closeup", "sheet_lods")}
        frag[aid] = dict(set=args.set, kind=asset.kind, variant=asset.variant,
                         bounds=dict(min=[round(float(x), 3) for x in lo], max=[round(float(x), 3) for x in hi]),
                         lods=files, attach=len(asset.attach), **public_meta)
        attach_all[aid] = asset.attach
        if env is not None:
            import bpy
            tiles.setdefault(aid, {})
            only_shots = [s for s in args.shots.split(",") if s]
            shots = [("lod0", asset.lods[0], False)]
            if asset.lods[0].has_morph():
                shots.append(("closed", asset.lods[0], True))
            if asset.meta.get("closeup") is not None:
                shots.append(("head", asset.lods[0], False))
                if asset.lods[0].has_morph():
                    shots.append(("head-closed", asset.lods[0], True))
            if asset.variant == "a" or asset.meta.get("sheet_lods"):
                shots += [("lod1", asset.lods[1], False), ("lod2", asset.lods[2], False)]
                if asset.card is not None and asset.card.parts:
                    shots.append(("card", asset.card, False))
            for label, mesh, morph in shots:
                if only_shots and label not in only_shots:
                    continue
                ob = to_bpy(env, f"{aid}.{label}", mesh, morph, single=(label == "card" or not asset.double_sided))
                path = os.path.join(tile_dir, f"{aid}.{label}.png")
                view = dict(asset.meta.get("view", {}))
                if label.startswith("head"):
                    view = dict(elev=view.get("elev", 14) + 10, az=view.get("az", 35), box=asset.meta["closeup"])
                render_tile(env, ob, path, lo, hi, **view)
                tiles[aid][label] = dict(path=path, tris=mesh.tris)
                me = ob.data
                bpy.data.objects.remove(ob)
                bpy.data.meshes.remove(me)
        print(f"[ark-assets] {aid}: " + ", ".join(f"{f['level']} {f['tris']}t {f['bytes'] // 1024}KB" for f in files)
              + f", {len(asset.attach)} attach, {time.time() - t0:.1f}s", flush=True)
    with open(attach_path, "w") as fh:
        json.dump({k: attach_all[k] for k in sorted(attach_all)}, fh, separators=(",", ":"))
    with open(frag_path, "w") as fh:
        json.dump(frag, fh, indent=1)
    with open(os.path.join(work, f"tiles-{args.set}.json"), "w") as fh:
        json.dump(tiles, fh, indent=1)
    write_manifest(args.set, frag, attach_path)


def write_manifest(set_name, frag, attach_path):
    man = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    man.setdefault("version", 1)
    man["about"] = ("Ark scene asset library (scripts/ark-assets). Procedural, made in this repo (CC0, see "
                    "docs/ark-credits.md). Files are under `base`; every GLB is one mesh, one primitive, one "
                    "vertex-coloured material, meshopt-compressed (EXT_meshopt_compression, float positions: no "
                    "node transform), read with GLTFLoader + MeshoptDecoder.")
    man["base"] = "/ark/assets/v1"
    man["units"] = "metres, +Y up, origin at the ground contact (trees: trunk base at y=0)"
    man["attributes"] = {
        "COLOR_0": "linear RGBA vertex colour (the whole look: no textures). three: geometry 'color'",
        "COLOR_1": ("the wind weights, vec4 unorm8 (a colour slot only because gltfpack drops custom attributes; "
                    "not a colour). three: geometry 'color_1'. x sway weight (0 at the ground; trunk <=0.2, branches "
                  "0.2-0.9, leaves 0.9-1), y phase of the limb (0..1, a leaf shares its limb's), z flutter (0 at a "
                  "leaf's stalk -> 1 at its tip, 0 on wood), w the leaf's own phase (0..1)"),
        "morph": "flowers carry one morph target named 'closed' (weight 0 open, 1 closed)",
    }
    man["material"] = ("Each lod lists doubleSided. true (leaves, petals, blades are single sheets): side DoubleSide; "
                       "false (cards, which carry both faces as geometry; closed solids): side FrontSide")
    man["lods"] = ("lod0 near (attach points are real geometry here), lod1 mid, lod2 far, card = crossed "
                   "vertex-coloured silhouettes for the horizon. lod_distances (m) are suggestions: lod0 below "
                   "[0], lod1 below [1], lod2 below [2], card beyond")
    man["attach"] = ("Per set `<set>/attach.json`: {assetId: [{tag, p, n, f, q, size, spot, lod, ...}]} in asset "
                     "space. n = the animal's up (surface normal), f = its forward along the surface, q = the "
                     "quaternion (x,y,z,w) taking local +Y to n and +Z to f, size = [min, max] body length (m) "
                     "that fits. spot = the nearest micro.ts MicroSpot.")
    man["tags"] = TAGS
    sets = man.setdefault("sets", {})
    tris0 = [a["lods"][0]["tris"] for a in frag.values()]
    sets[set_name] = dict(attach=f"{set_name}/attach.json", assets=len(frag),
                          bytes=sum(f["bytes"] for a in frag.values() for f in a["lods"]) + os.path.getsize(attach_path),
                          lod0_tris_max=max(tris0) if tris0 else 0)
    assets = man.setdefault("assets", {})
    for k in [k for k, v in assets.items() if v.get("set") == set_name]:
        assets.pop(k)
    assets.update(frag)
    man["assets"] = {k: assets[k] for k in sorted(assets, key=lambda k: (assets[k]["set"], k))}
    man["sets"] = {k: sets[k] for k in sorted(sets)}
    man["totalBytes"] = sum(s["bytes"] for s in sets.values())
    with open(MANIFEST, "w") as fh:
        json.dump(man, fh, indent=1)
        fh.write("\n")


if __name__ == "__main__":
    main()
