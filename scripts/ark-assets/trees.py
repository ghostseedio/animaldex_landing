"""Trees: a branching skeleton per species (trunk -> limbs -> branches -> twigs,
Weber-Penn style), meshed at three levels of detail from the same skeleton,
with real leaf blades (or needle tufts, fronds), plus a far card made of
crossed vertex-coloured silhouettes. Attach points on branches, bark, leaves,
holes and roots.
"""

import math

import numpy as np

from arkgeo import (UP, Asset, Mesh, attach, fbm, hexc, icosphere, jitter, kmeans, leaf_blade, mix, norm, perp,
                    place_frame, resample, rotate, smoothstep, thin, tube, uv_sphere)

# Triangle budgets per level of detail (mid-range phone, instanced): the leaves fill what the wood leaves.
BUDGET = (7500, 2200, 600)

# Per level of detail: tube sides by limb level, metres per segment, deepest limb level drawn,
# leaf keep ratio and leaf scale.
DETAIL = [
    dict(sides=[9, 6, 4, 3, 3], seg=[0.45, 0.6, 0.85, 1.2, 1.2], max_level=4, keep=1.0, grow=1.0),
    dict(sides=[6, 4, 3, 3, 3], seg=[0.9, 0.8, 0.7, 0.7, 0.7], max_level=2, keep=0.26, grow=1.75),
    dict(sides=[5, 3, 3, 3, 3], seg=[2.0, 1.6, 1.4, 1.4, 1.4], max_level=1, keep=0.075, grow=3.1),
]


class Limb:
    def __init__(self, pts, rad, level, phase, sway0, gain):
        self.pts = np.asarray(pts, float)
        self.rad = np.asarray(rad, float)
        self.level = level
        self.phase = phase
        seg = np.linalg.norm(np.diff(self.pts, axis=0), axis=1)
        self.s = np.concatenate([[0], np.cumsum(seg)])
        self.length = float(self.s[-1])
        self.sway0 = sway0
        self.gain = gain
        self.broken = False

    def at(self, t):
        u = t * self.length
        p = np.array([np.interp(u, self.s, self.pts[:, i]) for i in range(3)])
        r = float(np.interp(u, self.s, self.rad))
        i = min(int(np.searchsorted(self.s, u)), len(self.pts) - 1)
        i0, i1 = max(i - 1, 0), max(i, 1)
        d = norm(self.pts[i1] - self.pts[i0])
        return p, d, r

    def sway(self, t):
        return np.clip(self.sway0 + self.gain * np.asarray(t, float) ** 1.3, 0, 0.92)


def grow_path(rng, start, d, length, seg, bend, wobble, toward=None, pull=0.0):
    n = max(2, int(math.ceil(length / seg)))
    pts = [np.asarray(start, float)]
    dd = norm(d)
    for i in range(n):
        dd = norm(dd + UP * (bend / n) + rng.normal(0, wobble, 3) / math.sqrt(n)
                  + (toward * pull / n if toward is not None else 0))
        pts.append(pts[-1] + dd * (length / n))
    return np.array(pts)


SHAPES = {
    "conical": lambda t: 1 - 0.82 * t,
    "spherical": lambda t: 0.35 + 0.65 * math.sin(math.pi * min(max(t, 0), 1)),
    "hemi": lambda t: 0.45 + 0.55 * math.sin(math.pi * 0.5 * (1 - t) + 0.25),
    "flame": lambda t: (0.25 + t / 0.7 * 0.75) if t < 0.7 else (1 - t) / 0.3 * 0.9 + 0.1,
    "inverse": lambda t: 0.45 + 0.55 * t,
    "uniform": lambda t: 1.0,
    "ovoid": lambda t: 0.3 + 0.7 * math.sin(math.pi * (0.15 + 0.85 * t)) ** 0.8,
}


class Tree:
    def __init__(self):
        self.limbs = []
        self.leaves = []   # dicts: p, fwd, up, length, width, color, sway, phase, kind
        self.parts = []    # extra meshes per detail: callables(detail) -> Mesh
        self.holes = []
        self.extra_attach = []
        self.H = 1.0


def build_skeleton(spec, rng):
    tree = Tree()
    T = spec["trunk"]
    H = spec["H"]
    tree.H = H
    start = np.array(T.get("base", [0, 0, 0]), float)
    lean = T.get("lean", 0.0)
    lean_dir = rotate(np.array([1.0, 0, 0]), UP, rng.uniform(0, 2 * math.pi))
    d0 = norm(UP + lean_dir * lean)
    pts = grow_path(rng, start, d0, T["length"], 0.12, T.get("bend", 0.0), T.get("wobble", 0.02))
    k = len(pts)
    t = np.linspace(0, 1, k)
    r0 = T["radius"]
    rad = r0 * (1 - t * (1 - T.get("taper", 0.35)))
    flare = T.get("flare", 0.0)
    rad *= 1 + flare * np.exp(-t * T["length"] / max(0.25, 0.12 * T["length"]))
    trunk = Limb(pts, rad, 0, rng.uniform(), 0.0, 0.0)
    trunk.sway = lambda tt, L=trunk: np.clip(0.2 * np.asarray(tt, float) ** 2, 0, 0.2)
    trunk.H = H
    tree.limbs.append(trunk)
    _children(spec, rng, tree, trunk, 1)
    _leaves(spec, rng, tree)
    return tree


def _children(spec, rng, tree, parent, level):
    levels = spec["levels"]
    if level > len(levels):
        return
    L = levels[level - 1]
    t0, t1 = L.get("t", (0.3, 1.0))
    if "count" in L:
        count = L["count"]
        if isinstance(count, (tuple, list)):
            count = int(rng.integers(count[0], count[1] + 1))
    else:
        count = int(round(L["per_m"] * parent.length * (t1 - t0) * rng.uniform(0.85, 1.15)))
    if count <= 0:
        return
    az = rng.uniform(0, 2 * math.pi)
    whorl = L.get("whorl", 0)
    for j in range(count):
        if whorl:
            ring = j // whorl
            rings = max(1, (count + whorl - 1) // whorl)
            tt = t0 + (t1 - t0) * (ring + 0.5 + rng.uniform(-0.15, 0.15)) / rings
            az_j = az + (j % whorl) * 2 * math.pi / whorl + ring * 0.6 + rng.uniform(-0.25, 0.25)
        else:
            tt = t0 + (t1 - t0) * (j + rng.uniform(0.2, 0.8)) / count
            az += math.radians(L.get("az_step", 137.5)) + rng.uniform(-0.35, 0.35)
            az_j = az
        tt = min(max(tt, 0.0), 0.995)
        p, d, r_parent = parent.at(tt)
        u = perp(d)
        # A stable azimuth reference: horizontal for upright parents.
        ref = norm(np.cross(d, np.array([0.0, 0.0, 1.0]))) if abs(d[2]) < 0.95 else u
        side = rotate(ref, d, az_j)
        if L.get("planar"):
            # Keep branches in the horizontal-ish plane of the parent (sprays).
            side = norm(side - UP * (side @ UP) * L["planar"])
        ang = math.radians(L["angle"] + rng.uniform(-1, 1) * L.get("angle_var", 10))
        cd = norm(d * math.cos(ang) + side * math.sin(ang))
        tc = (tt - t0) / max(t1 - t0, 1e-6)
        shape = SHAPES[L.get("shape", "uniform")](tc)
        length = parent.length * L["ratio"] * shape * rng.uniform(0.8, 1.2)
        if level == 1 and "abs_length" in L:
            length = L["abs_length"] * shape * rng.uniform(0.8, 1.2)
        if length < 0.05:
            continue
        r0 = min(r_parent * 0.92, max(L.get("rmin", 0.006), r_parent * L.get("rratio", 0.6)))
        pts = grow_path(rng, p - d * r_parent * 0.3, cd, length, 0.08 if length < 1.5 else 0.14,
                        L.get("bend", 0.0), L.get("wobble", 0.05))
        k = len(pts)
        tl = np.linspace(0, 1, k)
        rad = r0 * (1 - tl * (1 - L.get("taper", 0.25)))
        rad = np.maximum(rad, L.get("rtip", 0.004))
        limb = Limb(pts, rad, level, rng.uniform() if level <= 1 else (parent.phase + rng.uniform(-0.15, 0.15)) % 1,
                    float(parent.sway(tt)), L.get("gain", [0.35, 0.3, 0.22, 0.18][min(level - 1, 3)]))
        if L.get("break", 0) and rng.uniform() < L["break"]:
            limb.broken = True
        tree.limbs.append(limb)
        if not limb.broken:
            _children(spec, rng, tree, limb, level + 1)


def _leaves(spec, rng, tree):
    LV = spec.get("leaves")
    if not LV:
        return
    on = LV.get("levels", [len(spec["levels"])])
    for limb in tree.limbs:
        if limb.level not in on or limb.broken:
            continue
        lt0 = LV.get("t0", 0.25)
        n = int(round(LV["per_m"] * limb.length * (1 - lt0) * rng.uniform(0.8, 1.2)))
        for i in range(max(n, LV.get("min", 1))):
            t = lt0 + (1 - lt0) * (i + rng.uniform(0, 1)) / max(n, 1)
            t = min(t, 1.0)
            p, d, r = limb.at(t)
            side = rotate(perp(d), d, rng.uniform(0, 2 * math.pi))
            ang = math.radians(LV.get("angle", 50) + rng.uniform(-15, 15))
            fwd = norm(d * math.cos(ang) + side * math.sin(ang))
            droop = LV.get("droop", 0.0)
            if droop:
                fwd = norm(fwd - UP * droop * rng.uniform(0.6, 1.2))
            up = norm(UP * LV.get("face_up", 1.0) + rng.normal(0, LV.get("tilt", 0.5), 3) + side * 0.3)
            s = rng.uniform(0.8, 1.2)
            tree.leaves.append(dict(p=p + side * r, fwd=fwd, up=up, length=LV["length"] * s, width=LV["width"] * s,
                                    color=jitter(LV["colors"][int(rng.integers(len(LV["colors"])))], rng,
                                                 LV.get("jit", 0.08), LV.get("hue", 0.025)),
                                    sway=float(limb.sway(t)), phase=limb.phase, lphase=rng.uniform(),
                                    kind=LV.get("kind", "blade"), limb=limb))


# MARK: - Meshing

def bark_color_fn(spec, H):
    B = spec["bark"]
    base = np.asarray(B["color"], float)
    dark = np.asarray(B.get("dark", base * np.array([0.55, 0.55, 0.55, 1])), float)
    moss = B.get("moss")
    marks = B.get("marks")
    rings = B.get("rings")

    def fn(P, N, ring, angles):
        n = len(P)
        f = fbm(P * np.array([B.get("fx", 3.0), B.get("fy", 0.9), B.get("fx", 3.0)]), 3, seed=B.get("seed", 1))
        k = np.clip(0.5 + f * B.get("contrast", 1.1), 0, 1)
        C = mix(dark, base, k)
        ground = 0.62 + 0.38 * smoothstep(0, 0.9, P[:, 1])
        under = 0.82 + 0.18 * np.clip(N[:, 1] * 0.5 + 0.5, 0, 1)
        C[:, :3] *= (ground * under)[:, None]
        if marks is not None:
            m = fbm(P * np.array([7.0, 2.2, 7.0]) + 3, 2, seed=5)
            hm = smoothstep(marks["lo"], marks["hi"], m)
            C = mix(C, np.asarray(marks["color"]), hm * smoothstep(0.1 * H, 0.25 * H, P[:, 1]) * 0.95 + 0.0)
            base_dark = 1 - smoothstep(0.0, 0.14 * H, P[:, 1])
            C = mix(C, np.asarray(marks.get("foot", dark)), base_dark * 0.85)
        if rings is not None:
            band = 0.5 + 0.5 * np.sin(P[:, 1] * rings["freq"] * 2 * math.pi)
            C[:, :3] *= (1 - rings["depth"] * band ** 6)[:, None]
        if moss is not None:
            m = fbm(P * 2.5 + 7, 2, seed=9)
            cover = smoothstep(moss["lo"], moss["hi"], N[:, 1] * 0.7 + m * 0.8) * (1 - smoothstep(moss.get("top", 99), moss.get("top", 99) + 1, P[:, 1]))
            C = mix(C, np.asarray(moss["color"]), cover)
        return C

    return fn


def mesh_wood(spec, tree, detail, out, min_r=0.0):
    D = DETAIL[detail]
    fn = bark_color_fn(spec, tree.H)
    for limb in tree.limbs:
        lvl = min(limb.level, 4)
        if limb.level > D["max_level"] and not getattr(limb, "root", False):
            continue
        if limb.rad[0] < max(min_r, spec.get("min_r", [0.0, 0.018, 0.04])[detail]) and not getattr(limb, "root", False):
            continue
        if detail == 0:
            limb.meshed = True
        seg = D["seg"][lvl] * spec.get("seg_scale", 1.0)
        count = max(2, int(math.ceil(limb.length / seg)) + 1)
        if limb.level == 0:
            count = max(count, spec.get("trunk_rings", [12, 6, 3])[detail])
        pts, (rad, s) = resample(limb.pts, [limb.rad, limb.s / max(limb.length, 1e-6)], count)
        sides = spec.get("sides", D["sides"])[lvl] if "sides" in spec and detail == 0 else D["sides"][lvl]
        if limb.level == 0 and "trunk_sides" in spec:
            sides = spec["trunk_sides"][detail]
        if limb.level == 0:
            sw = np.clip(0.2 * ((pts[:, 1] - pts[0, 1]) / max(tree.H, 1)) ** 2, 0, 0.2)
        else:
            sw = limb.sway(s)
        W = np.stack([sw, np.full(len(sw), limb.phase), np.zeros(len(sw)), np.zeros(len(sw))], 1)
        ring_shape = None
        if limb.level == 0 and spec.get("buttress") and detail < 2:
            B = spec["buttress"]
            hts = pts[:, 1]

            def ring_shape(i, a, B=B, hts=hts):
                h = max(hts[i], 0)
                k = B["amount"] * math.exp(-h / B["height"])
                return 1 + k * np.maximum(0, np.cos(B["fins"] * (a - B["offset"]))) ** 6
        elif spec["bark"].get("rough") and limb.level <= 1:
            rough = spec["bark"]["rough"]

            def ring_shape(i, a, rough=rough, sides=sides):
                return 1 + rough * np.cos(a * max(3, sides // 2) + i * 1.7)
        cap = not (limb.level == 0 and spec.get("open_top")) and rad[-1] > 0.012
        P, F, N, C, W2 = tube(pts, rad, sides, wind=W, color_fn=fn, ring_shape=ring_shape, cap_end=cap)
        if limb.broken and detail == 0:
            C[-1:] = hexc("#c9b48a")
        out.add(P, F, N, C, W2)


def mesh_leaves(spec, tree, detail, out, rng, target=None):
    D = DETAIL[detail]
    LV = spec.get("leaves")
    if not LV or not tree.leaves:
        return
    leaves = tree.leaves
    order = np.random.default_rng(7).permutation(len(leaves))
    keep = max(1, int(len(leaves) * D["keep"] * LV.get("keep_scale", [1, 1, 1])[detail]))
    if target is not None:
        keep = max(8, min(len(leaves), int(target)))
    chosen = [leaves[i] for i in order[:keep]]
    allp = np.array([l["p"] for l in leaves])
    centre = allp.mean(0)
    centre[1] = np.percentile(allp[:, 1], 45)
    spread = np.percentile(np.linalg.norm(allp - centre, axis=1), 92) + 1e-3
    ymin, ymax = allp[:, 1].min(), allp[:, 1].max()
    grow = D["grow"] * LV.get("grow_scale", [1, 1, 1])[detail]
    if target is not None:
        grow = max(1.0, math.sqrt(len(leaves) / keep) * 0.92) * LV.get("grow_scale", [1, 1, 1])[detail]
    segs = LV.get("segs", 0) if detail == 0 else 0
    kind = LV.get("kind", "blade")
    Ps, Fs, Ns, Cs, Ws = [], [], [], [], []
    off = 0
    for leaf in chosen:
        L, Wd = leaf["length"] * grow, leaf["width"] * grow * (1.15 if detail else 1.0)
        if kind == "needles":
            P, F, fl = needle_tuft(L, Wd, LV.get("needles", 7) if detail == 0 else 4, rng, LV.get("spread", (0.45, 0.85)))
        else:
            P, F, fl = leaf_blade(L, Wd, LV.get("fold", 0.3), LV.get("curl", 0.1), LV.get("wpos", 0.45), segs)
        Pw, x, y, z = place_frame(P, leaf["p"], leaf["fwd"], leaf["up"])
        radial = norm(Pw - centre)
        facing = np.sign(radial @ y)[:, None]
        facing[facing == 0] = 1
        Nw = norm(y * facing * 0.4 + radial * 0.6)
        depth = np.clip(np.linalg.norm(Pw - centre, axis=1) / spread, 0, 1.15)
        ao = (0.5 + 0.5 * depth ** 0.9) * (0.82 + 0.18 * (Pw[:, 1] - ymin) / max(ymax - ymin, 1e-3))
        col = np.tile(leaf["color"], (len(P), 1))
        tipc = mix(leaf["color"], np.asarray(LV.get("tip", leaf["color"] * np.array([1.12, 1.12, 0.9, 1]))), 0.6)
        col = mix(col, np.tile(tipc, (len(P), 1)), fl)
        col[:, :3] *= ao[:, None]
        Wv = np.stack([np.full(len(P), min(1.0, leaf["sway"] + 0.15)), np.full(len(P), leaf["phase"]), fl,
                       np.full(len(P), leaf["lphase"])], 1)
        Ps.append(Pw); Fs.append(F + off); Ns.append(Nw); Cs.append(np.clip(col, 0, 1)); Ws.append(Wv)
        off += len(P)
    out.add(np.concatenate(Ps), np.concatenate(Fs), np.concatenate(Ns), np.concatenate(Cs), np.concatenate(Ws))


def needle_tuft(length, width, n, rng, spread_range=(0.45, 0.85)):
    """A star of needles: thin triangles radiating forward from the twig tip (+Z), in a cone."""
    P, F, fl = [], [], []
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-0.2, 0.2)
        spread = rng.uniform(*spread_range)
        d = np.array([math.cos(a) * spread, math.sin(a) * spread, 1.0])
        d = d / np.linalg.norm(d)
        side = np.array([-math.sin(a), math.cos(a), 0.0]) * width
        base = len(P)
        P += [-side * 0.5, side * 0.5, d * length * rng.uniform(0.8, 1.1)]
        fl += [0, 0, 1]
        F.append([base, base + 1, base + 2])
    return np.array(P), np.array(F), np.array(fl, float)


def two_sided(out, P, F, N, C, W, pn):
    """Adds a flat sheet twice: once facing +pn, once facing -pn (normals mirrored through the
    plane), so a single-sided material lights both faces the same way."""
    eps = 0.006
    out.add(P + pn * eps, F, N, C, W)
    Nb = N - 2 * (N @ pn)[:, None] * pn
    out.add(P - pn * eps, np.asarray(F)[:, [0, 2, 1]], Nb, C, W)


def mesh_card(spec, tree, rng):
    """Two crossed planes through the trunk; foliage lobes as soft jagged polygons, wood as flat
    ribbons. Vertex coloured; every sheet is in it twice (front and back), so the material is
    single sided (no normal flip on back faces)."""
    out = Mesh()
    planes = [(np.array([1.0, 0, 0]), np.array([0, 0, 1.0])), (np.array([0, 0, 1.0]), np.array([1.0, 0, 0]))]
    woody = [l for l in tree.limbs if l.level <= spec.get("card_wood_level", 1) and l.rad[0] >= 0.04
             and not getattr(l, "liana", False)]
    woody = sorted(woody, key=lambda l: -l.rad[0] * l.length)[:spec.get("card_ribbons", 4)]
    for limb in woody:
        pts, (rad,) = resample(limb.pts, [limb.rad], max(2, min(3, int(limb.length / 2.5) + 2)))
        col = np.asarray(spec["bark"]["color"]) * np.array([0.75, 0.75, 0.75, 1])
        for axis, nrm in planes:
            T = np.diff(pts, axis=0)
            T = norm(np.concatenate([T, T[-1:]]))
            side = norm(np.cross(T, nrm[None].repeat(len(T), 0)))
            side[np.linalg.norm(side, axis=1) < 1e-6] = axis
            P = np.concatenate([pts - side * rad[:, None], pts + side * rad[:, None]])
            P -= nrm * (P @ nrm)[:, None]
            k = len(pts)
            F = []
            for i in range(k - 1):
                F += [[i, i + 1, k + i + 1], [i, k + i + 1, k + i]]
            N = np.tile(norm(nrm * 0.8 + UP * 0.2), (len(P), 1))
            W = np.zeros((len(P), 4))
            W[:, 0] = 0.15 * np.clip(P[:, 1] / tree.H, 0, 1) ** 2
            two_sided(out, P, F, N, np.tile(col, (len(P), 1)), W, nrm)
    style = spec.get("card_style", "lobes")
    if style == "cone" and tree.leaves:
        # Conifer: stacked tiers with a ragged lower edge, dark at the bottom of each tier.
        X = np.array([l["p"] for l in tree.leaves])
        col = np.median(np.array([l["color"] for l in tree.leaves]), 0)
        ylo, yhi = np.percentile(X[:, 1], 2), X[:, 1].max() + 0.3
        tiers = 6
        for axis, nrm in planes:
            for i in range(tiers):
                y0 = ylo + (yhi - ylo) * i / tiers * 0.92
                y1 = min(yhi, y0 + (yhi - ylo) / tiers * 1.9)
                band = X[(X[:, 1] > y0 - 0.3) & (X[:, 1] < y0 + 0.5)]
                w = np.percentile(np.abs(band @ axis), 90) + 0.2 if len(band) > 3 else (1 - i / tiers) * 2
                k = 5
                base = [axis * (-w + 2 * w * j / (k - 1)) + UP * (y0 - (0.25 if j % 2 else 0.0)) for j in range(k)]
                P = np.array(base + [UP * y1])
                F = [[j, j + 1, k] for j in range(k - 1)]
                C = np.tile(col, (len(P), 1))
                C[:k, :3] *= 0.62
                C[k, :3] *= 1.12
                N = norm(np.tile(nrm * 0.5 + UP * 0.4, (len(P), 1)) + (P - UP * y0) * 0.05)
                W = np.zeros((len(P), 4))
                W[:, 0] = 0.5
                two_sided(out, P, F, N, np.clip(C, 0, 1), W, nrm)
    elif style == "fronds":
        fronds = getattr(tree, "fronds", [])[::2]
        col = np.median(np.array([l["color"] for l in tree.leaves]), 0)
        for axis, nrm in planes:
            for limb in fronds:
                pts, (_,) = resample(limb.pts, [limb.rad], 4)
                pts = pts - nrm * (pts @ nrm)[:, None]
                T = norm(np.gradient(pts, axis=0))
                side = norm(np.cross(T, nrm[None].repeat(len(T), 0)))
                wd = np.array([0.1, 0.45, 0.4, 0.05]) * spec["leaves"]["length"] * 1.3
                P = np.concatenate([pts - side * wd[:, None], pts + side * wd[:, None]])
                F = []
                for i in range(3):
                    F += [[i, i + 1, 5 + i], [i, 5 + i, 4 + i]]
                C = np.tile(col, (len(P), 1))
                C[:, :3] *= np.tile(np.array([0.7, 0.95, 1.0, 0.9]), 2)[:, None]
                N = np.tile(norm(nrm * 0.5 + UP * 0.5), (len(P), 1))
                W = np.zeros((len(P), 4))
                W[:, 0] = 0.7
                two_sided(out, P, F, N, np.clip(C, 0, 1), W, nrm)
    elif tree.leaves:
        X = np.array([l["p"] for l in tree.leaves])
        cols = np.array([l["color"] for l in tree.leaves])
        k = min(spec.get("card_lobes", 7), 8)
        C, lab = kmeans(X, k, rng)
        centre = X.mean(0)
        ylo, yhi = X[:, 1].min(), X[:, 1].max()
        sides = 8
        for axis, nrm in planes:
            for i in range(len(C)):
                pts = X[lab == i]
                if len(pts) < 3:
                    continue
                c = C[i] - nrm * (C[i] @ nrm)
                rel = pts - C[i]
                rel -= nrm * (rel @ nrm)[:, None]
                base_col = np.median(cols[lab == i], 0)
                ang = np.linspace(0, 2 * math.pi, sides, endpoint=False) + rng.uniform(0, 1)
                ring = []
                for j, a in enumerate(ang):
                    dirv = axis * math.cos(a) + UP * math.sin(a)
                    proj = rel @ dirv
                    reach = np.percentile(proj, 85) + spec["leaves"]["length"] * 0.5
                    # Scalloped: alternate points pulled in, so the outline reads as leaf clumps.
                    ring.append(c + dirv * max(reach, 0.2) * (1.0 if j % 2 == 0 else 0.7) * rng.uniform(0.85, 1.1))
                P = np.concatenate([[c], np.array(ring)])
                F = [[0, 1 + (j + 1) % sides, 1 + j] for j in range(sides)]
                inplane = P - centre
                inplane -= nrm * (inplane @ nrm)[:, None]
                N = norm(norm(inplane) * 0.55 + UP * 0.35 + nrm * 0.45)
                h = np.clip((P[:, 1] - ylo) / max(yhi - ylo, 1e-3), 0, 1)
                col = np.tile(base_col, (len(P), 1))
                col[:, :3] *= (0.62 + 0.4 * h)[:, None]
                col[1:, :3] *= 1.06
                W = np.zeros((len(P), 4))
                W[:, 0] = 0.6
                W[1:, 2] = 0.5
                two_sided(out, P, F, N, np.clip(col, 0, 1), W, nrm)
    return out


# MARK: - Attach points

def tree_attach(spec, tree, rng):
    pts = []
    H = tree.H
    for limb in tree.limbs:
        if limb.broken and limb.level > 1:
            continue
        if limb.level == 0:
            top = min(spec.get("bark_top", 0.75), 0.95)
            for t in np.linspace(0.06, top, 10):
                p, d, r = limb.at(t)
                side = rotate(perp(d), d, rng.uniform(0, 2 * math.pi))
                side = norm(side - d * (side @ d))
                pts.append(attach("bark", p + side * r, side, d, (0.005, min(1.0, 2.5 * r + 0.15)), lod=0,
                                  spot="bark"))
            continue
        if limb.level > 3 or limb.rad[0] < 0.008 or not getattr(limb, "meshed", False):
            continue
        for t in np.linspace(0.15, 0.85, 4):
            p, d, r = limb.at(t)
            if abs(d[1]) > 0.6 or r < 0.006:
                continue
            n = norm(UP - d * (UP @ d))
            pts.append(attach("branch", p + n * r, n, d, (max(0.01, 1.5 * 2 * r), min(1.5, 15 * 2 * r)), lod=0,
                              spot="bark"))
    branch = thin([a for a in pts if a["tag"] == "branch"], spec.get("n_branch", 18), rng)
    bark = thin([a for a in pts if a["tag"] == "bark"], 8, rng)
    leaf_pts = []
    for leaf in tree.leaves:
        if leaf.get("kind", "blade") != "blade" or leaf["up"][1] < 0.45 or leaf["length"] < 0.05:
            continue
        P, F, fl = leaf_blade(leaf["length"], leaf["width"], 0, 0, 0.45, 1)
        c = leaf["p"] + leaf["fwd"] * leaf["length"] * 0.45 + leaf["up"] * 0.004
        leaf_pts.append(attach("leaf", c, leaf["up"], leaf["fwd"], (0.002, round(0.6 * leaf["length"], 3)), lod=0,
                               spot="flowers"))
    leaf_pts = thin(leaf_pts, spec.get("n_leaf", 12), rng)
    return branch + bark + leaf_pts + tree.extra_attach


# MARK: - Species extras

def add_hole(tree, spec, t, rng, size=0.07):
    trunk = tree.limbs[0]
    p, d, r = trunk.at(t)
    side = rotate(perp(d), d, rng.uniform(0, 2 * math.pi))
    side = norm(side - d * (side @ d))
    tree.holes.append(dict(p=p, d=d, side=side, r=r, size=size))
    tree.extra_attach.append(attach("tree_hollow", p + side * r * 0.98, side, d, (0.02, size * 4.5), lod=0,
                                    spot="bark", depth=round(size * 2.5, 3)))


def mesh_holes(tree, out, detail):
    for h in tree.holes:
        sides = 10 if detail == 0 else 6
        a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
        x = norm(np.cross(h["d"], h["side"]))
        ring = h["p"] + h["side"] * h["r"] * 1.03 + (np.cos(a)[:, None] * x * h["size"] * 0.8 +
                                                    np.sin(a)[:, None] * h["d"] * h["size"] * 1.25)
        inner = h["p"] + h["side"] * h["r"] * 0.5
        lip = h["p"] + h["side"] * h["r"] * 1.06 + (np.cos(a)[:, None] * x * h["size"] * 1.05 +
                                                   np.sin(a)[:, None] * h["d"] * h["size"] * 1.5)
        P = np.concatenate([[inner], ring, lip])
        F = [[0, 1 + j, 1 + (j + 1) % sides] for j in range(sides)]
        for j in range(sides):
            a0, a1 = 1 + j, 1 + (j + 1) % sides
            b0, b1 = a0 + sides, a1 + sides
            F += [[a0, b0, b1], [a0, b1, a1]]
        C = np.concatenate([[hexc("#120c08")], np.tile(hexc("#2a1d14"), (sides, 1)), np.tile(hexc("#6b5640"), (sides, 1))])
        W = np.zeros((len(P), 4))
        W[:, 0] = 0.2 * np.clip(P[:, 1] / tree.H, 0, 1) ** 2
        out.add(P, F, None, C, W)


def fruit_parts(tree, spec, rng, detail, out, kind="fruit"):
    F_ = spec.get(kind) or dict(radius=spec.get("palm", {}).get("nut_radius", 0.1))
    rings, sides = [(5, 7), (3, 5), (2, 4)][detail]
    for i, fr in enumerate(tree.fruits):
        if detail == 2 and i % 3:
            continue
        if detail == 1 and i % 2:
            continue
        if kind == "fruit":
            P, F = uv_sphere(rings, sides)
            r = F_["radius"] * fr["s"] * (1.0 if detail == 0 else 1.25)
            P = P * np.array([r, r * 0.92, r]) + fr["p"]
            C = np.tile(fr["color"], (len(P), 1))
            C[:, :3] *= (0.75 + 0.3 * np.clip((P[:, 1] - fr["p"][1]) / r * 0.5 + 0.5, 0, 1))[:, None]
            N = norm(P - fr["p"])
        else:
            P, F, N, C = blossom(fr, rng, detail)
        W = np.zeros((len(P), 4))
        W[:, 0] = min(1.0, fr["sway"] + 0.1)
        W[:, 1] = fr["phase"]
        out.add(P, F, N, C, W)


def blossom(fr, rng, detail):
    """A five-petal blossom facing out from the twig."""
    n = 5 if detail == 0 else 4
    r = fr["s"] * 0.05 * (1 if detail == 0 else 1.6)
    centre = fr["p"]
    up = fr["up"]
    x = perp(up)
    z = np.cross(x, up)
    P, F, C = [centre + up * r * 0.1], [], [hexc("#e8d06a")]
    for i in range(n):
        a = 2 * math.pi * i / n
        d = x * math.cos(a) + z * math.sin(a)
        e = x * math.cos(a + math.pi / 2) + z * math.sin(a + math.pi / 2)
        base = len(P)
        P += [centre + d * r * 0.2 - e * r * 0.25, centre + d * r * 1.0 + up * r * 0.25, centre + d * r * 0.2 + e * r * 0.25]
        C += [fr["color"] * np.array([0.9, 0.85, 0.88, 1]), fr["color"], fr["color"] * np.array([0.9, 0.85, 0.88, 1])]
        F += [[0, base, base + 1], [0, base + 1, base + 2]]
    P = np.array(P)
    N = np.tile(up, (len(P), 1))
    return P, np.array(F), N, np.array(C)


def add_fruits(tree, spec, rng, kind="fruit"):
    F_ = spec[kind]
    tips = [l for l in tree.limbs if l.level == len(spec["levels"]) and not l.broken]
    tree.fruits = []
    for i in range(F_["count"]):
        limb = tips[int(rng.integers(len(tips)))]
        p, d, r = limb.at(rng.uniform(0.5, 1.0))
        if kind == "fruit":
            p = p - UP * F_["radius"] * 1.3
            col = jitter(F_["colors"][int(rng.integers(len(F_["colors"])))], rng, 0.08)
            up = UP
        else:
            up = norm(UP * 0.6 + rng.normal(0, 0.6, 3))
            col = jitter(F_["colors"][int(rng.integers(len(F_["colors"])))], rng, 0.04, 0.01)
        tree.fruits.append(dict(p=p, s=rng.uniform(0.85, 1.15), color=col, sway=float(limb.sway(0.8)),
                                phase=limb.phase, up=up))
        if kind == "fruit" and i % 3 == 0:
            tree.extra_attach.append(attach("fruit", p + UP * F_["radius"], UP, d, (0.004, F_["radius"] * 3), lod=0,
                                            spot="flowers"))
        if kind == "blossom" and i % 6 == 0:
            tree.extra_attach.append(attach("flower_head", p + up * 0.01, up, perp(up), (0.003, 0.03), lod=0,
                                            spot="flowers"))


def palm_crown(tree, spec, rng):
    """Pinnate fronds from the trunk top: a drooping rachis with leaflet pairs."""
    trunk = tree.limbs[0]
    top, d, r = trunk.at(1.0)
    P_ = spec["palm"]
    fronds = []
    for i in range(P_["fronds"]):
        az = 2 * math.pi * i / P_["fronds"] + rng.uniform(-0.2, 0.2)
        out = np.array([math.cos(az), 0, math.sin(az)])
        rise = rng.uniform(-0.1, 0.9) if i % 3 else rng.uniform(0.8, 1.4)
        start_dir = norm(out + UP * rise)
        length = P_["length"] * rng.uniform(0.8, 1.1)
        pts = grow_path(rng, top, start_dir, length, 0.15, -P_["droop"] * rng.uniform(0.7, 1.3), 0.02)
        k = len(pts)
        rad = np.linspace(0.05, 0.012, k)
        limb = Limb(pts, rad, 1, rng.uniform(), 0.2, 0.75)
        tree.limbs.append(limb)
        fronds.append(limb)
    tree.fronds = fronds
    LV = spec["leaves"]
    for limb in fronds:
        n = int(LV["per_m"] * limb.length)
        for j in range(n):
            t = 0.12 + 0.88 * j / n
            p, d, r = limb.at(t)
            side = norm(np.cross(d, UP))
            if np.linalg.norm(side) < 1e-6:
                side = perp(d)
            lam = 1 - 0.55 * abs(t - 0.45) / 0.55
            for sgn in (-1, 1):
                fwd = norm(side * sgn * 0.9 + d * 0.45 - UP * 0.35)
                up = norm(np.cross(fwd, d) * sgn + UP * 0.3)
                if up[1] < 0:
                    up = -up
                s = rng.uniform(0.9, 1.1) * lam
                tree.leaves.append(dict(p=p, fwd=fwd, up=up, length=LV["length"] * s, width=LV["width"] * (0.6 + 0.4 * s),
                                        color=jitter(LV["colors"][int(rng.integers(len(LV["colors"])))], rng, 0.06),
                                        sway=float(limb.sway(t)), phase=limb.phase, lphase=rng.uniform(), kind="blade",
                                        limb=limb))
    # Coconuts / dates under the crown.
    tree.fruits = []
    for i in range(P_.get("nuts", 0)):
        a = rng.uniform(0, 2 * math.pi)
        p = top + np.array([math.cos(a), 0, math.sin(a)]) * r * 1.4 - UP * rng.uniform(0.15, 0.4)
        tree.fruits.append(dict(p=p, s=rng.uniform(0.9, 1.1), color=jitter(hexc(P_.get("nut_color", "#6f7a2c")), rng, 0.1),
                                sway=0.2, phase=0, up=UP))
    tree.extra_attach.append(attach("crown", top + UP * 0.1, UP, np.array([1.0, 0, 0]), (0.05, 0.6), lod=0, spot="bark"))
    for limb in fronds[::2]:
        p, d, r = limb.at(0.3)
        n = norm(UP - d * (UP @ d))
        tree.extra_attach.append(attach("frond", p + n * r, n, d, (0.01, 0.25), lod=0, spot="bark"))


def prop_roots(tree, spec, rng):
    trunk = tree.limbs[0]
    R = spec["roots"]
    for i in range(R["count"]):
        h = rng.uniform(*R["from"])
        t = h / trunk.length
        p, d, r = trunk.at(t)
        a = 2 * math.pi * i / R["count"] + rng.uniform(-0.3, 0.3)
        out = np.array([math.cos(a), 0, math.sin(a)])
        reach = rng.uniform(*R["reach"])
        end = np.array([out[0] * reach, -0.15, out[2] * reach])
        mid = (p + end) / 2 + out * reach * 0.2 + UP * h * 0.35
        ts = np.linspace(0, 1, 9)[:, None]
        pts = (1 - ts) ** 2 * p + 2 * (1 - ts) * ts * mid + ts ** 2 * end
        pts += rng.normal(0, 0.03, pts.shape)
        rad = np.linspace(R["radius"], R["radius"] * 0.6, len(pts))
        limb = Limb(pts, rad, 1, 0, 0, 0)
        limb.sway = lambda tt: np.zeros_like(np.asarray(tt, float))
        limb.root = True
        tree.limbs.append(limb)
        q, dd, rr = limb.at(0.8)
        n = norm(UP - dd * (UP @ dd))
        tree.extra_attach.append(attach("root", q + n * rr, n, dd, (0.01, 0.4), lod=0, spot="rocks"))


def lianas(tree, spec, rng, out_list):
    big = [l for l in tree.limbs if l.level == 1]
    for i in range(spec.get("lianas", 0)):
        limb = big[int(rng.integers(len(big)))]
        p, d, r = limb.at(rng.uniform(0.4, 0.9))
        drop = rng.uniform(0.35, 0.8) * p[1]
        sway_x = rng.normal(0, 0.4, 2)
        ts = np.linspace(0, 1, 10)
        pts = np.stack([p[0] + sway_x[0] * np.sin(ts * math.pi), p[1] - drop * ts, p[2] + sway_x[1] * np.sin(ts * math.pi)], 1)
        limb2 = Limb(pts, np.full(10, 0.018), 4, rng.uniform(), float(limb.sway(0.6)), 0.5)
        limb2.liana = True
        tree.limbs.append(limb2)


def bromeliads(tree, spec, rng):
    big = [l for l in tree.limbs if l.level in (1, 2) and l.rad[0] > 0.06]
    tree.rosettes = []
    for i in range(spec.get("bromeliads", 0)):
        limb = big[int(rng.integers(len(big)))]
        t = rng.uniform(0.2, 0.7)
        p, d, r = limb.at(t)
        n = norm(UP - d * (UP @ d))
        tree.rosettes.append(dict(p=p + n * r * 0.8, sway=float(limb.sway(t)), phase=limb.phase,
                                  color=jitter(hexc(["#5f8f3a", "#8a9a35", "#a04a3a"][i % 3]), rng, 0.05)))
        tree.extra_attach.append(attach("bromeliad", p + n * (r + 0.08), UP, d, (0.005, 0.08), lod=0, spot="pond_surface"))


def mesh_rosettes(tree, out, detail, rng):
    for ro in getattr(tree, "rosettes", []):
        n = [9, 5, 0][detail]
        if not n:
            continue
        Ps, Fs, Cs, Ws = [], [], [], []
        off = 0
        for i in range(n):
            a = 2 * math.pi * i / n
            fwd = norm(np.array([math.cos(a), 1.1, math.sin(a)]))
            P, F, fl = leaf_blade(0.28, 0.045, 0.4, 0.25, 0.4, 1)
            Pw, x, y, z = place_frame(P, ro["p"], fwd, UP)
            Ps.append(Pw); Fs.append(F + off); off += len(P)
            C = np.tile(ro["color"], (len(P), 1))
            C[:, :3] *= (0.7 + 0.4 * fl)[:, None]
            Cs.append(C)
            Ws.append(np.stack([np.full(len(P), ro["sway"]), np.full(len(P), ro["phase"]), fl * 0.4, np.zeros(len(P))], 1))
        out.add(np.concatenate(Ps), np.concatenate(Fs), None, np.concatenate(Cs), np.concatenate(Ws))


def snag_extras(tree, spec, rng, out, detail):
    """Splinters at the broken top and bracket fungi shelves."""
    trunk = tree.limbs[0]
    top, d, r = trunk.at(1.0)
    if detail < 2:
        for i in range(5 if detail == 0 else 3):
            a = 2 * math.pi * i / 5 + rng.uniform(-0.3, 0.3)
            side = np.array([math.cos(a), 0, math.sin(a)])
            base = top - d * 0.05 + side * r * 0.75
            tipp = base + d * rng.uniform(0.15, 0.55) + side * 0.04
            w = norm(np.cross(side, d)) * r * 0.35
            P = np.array([base - w, base + w, base - side * r * 0.4, tipp])
            F = np.array([[0, 1, 3], [1, 2, 3], [2, 0, 3]])
            C = np.array([hexc("#8a7a62"), hexc("#8a7a62"), hexc("#6c5f4c"), hexc("#d2c3a0")])
            W = np.zeros((4, 4)); W[:, 0] = 0.18
            out.add(P, F, None, C, W)
        for k in range(spec.get("brackets", 3)):
            t = rng.uniform(0.12, 0.45)
            p, d2, r2 = trunk.at(t)
            a = rng.uniform(0, 2 * math.pi)
            side = np.array([math.cos(a), 0, math.sin(a)])
            sides = 9 if detail == 0 else 5
            w = rng.uniform(0.12, 0.22)
            ang = np.linspace(-math.pi / 2, math.pi / 2, sides)
            tang = norm(np.cross(UP, side))
            rim = p + side * r2 * 0.9 + (np.cos(ang)[:, None] * side * w + np.sin(ang)[:, None] * tang * w * 1.2)
            topc = p + side * r2 * 0.9 + UP * 0.03
            P = np.concatenate([[topc], rim + UP * 0.01, rim - UP * 0.02])
            F = [[0, 1 + j + 1, 1 + j] for j in range(sides - 1)]
            for j in range(sides - 1):
                a0, a1 = 1 + j, 2 + j
                F += [[a0, a1, a1 + sides], [a0, a1 + sides, a0 + sides]]
            C = np.concatenate([[hexc("#7a5a32")], np.tile(hexc("#c8a466"), (sides, 1)), np.tile(hexc("#e8dcc0"), (sides, 1))])
            W = np.zeros((len(P), 4)); W[:, 0] = 0.05
            out.add(P, F, None, C, W)
            if detail == 0:
                tree.extra_attach.append(attach("fungus_shelf", p + side * (r2 + w * 0.6) + UP * 0.03, UP, side,
                                                (0.003, 0.08), lod=0, spot="bark"))


# MARK: - Species

G = lambda *h: [hexc(x) for x in h]

SPECIES = {
    "oak": dict(
        H=8.5, trunk=dict(length=6.2, radius=0.36, taper=0.42, wobble=0.07, lean=0.06, flare=0.55),
        levels=[dict(count=(6, 8), t=(0.32, 0.98), angle=58, angle_var=14, ratio=0.62, shape="hemi", rratio=0.55,
                     bend=0.25, wobble=0.18, taper=0.3),
                dict(per_m=2.0, t=(0.25, 1.0), angle=48, ratio=0.5, rratio=0.5, bend=0.15, wobble=0.22),
                dict(per_m=4.0, t=(0.3, 1.0), angle=45, ratio=0.38, rratio=0.5, bend=0.2, wobble=0.25, rtip=0.005)],
        leaves=dict(per_m=26, length=0.27, width=0.12, levels=[2, 3], t0=0.35, colors=G("#4f7a2e", "#5c8a33", "#3f6a28", "#6a9238"),
                    tip=hexc("#8fb04a"), fold=0.35, curl=0.15, angle=55, tilt=0.55),
        bark=dict(color=hexc("#6e5a44"), dark=hexc("#3a2d22"), fx=4, fy=1.2, contrast=1.3, rough=0.07,
                  moss=dict(color=hexc("#5e7a2e"), lo=0.45, hi=0.95, top=4.0)),
        holes=1, card_lobes=7, n_branch=20),
    "beech": dict(
        H=11, trunk=dict(length=9.0, radius=0.3, taper=0.35, wobble=0.03, lean=0.03, flare=0.35),
        levels=[dict(count=(8, 10), t=(0.35, 0.98), angle=38, angle_var=10, ratio=0.5, shape="ovoid", rratio=0.5,
                     bend=0.45, wobble=0.1),
                dict(per_m=2.2, t=(0.3, 1.0), angle=52, ratio=0.45, rratio=0.5, bend=0.05, wobble=0.12, planar=0.6),
                dict(per_m=4.5, t=(0.3, 1.0), angle=55, ratio=0.32, rratio=0.5, bend=-0.05, wobble=0.15, planar=0.7)],
        leaves=dict(per_m=22, length=0.22, width=0.1, levels=[2, 3], t0=0.35, colors=G("#6a9a34", "#7aa83c", "#5b8a2c"),
                    tip=hexc("#a6c656"), fold=0.25, curl=0.08, angle=70, tilt=0.3),
        bark=dict(color=hexc("#9a9a8e"), dark=hexc("#6c6c62"), fx=2, fy=0.6, contrast=0.6), n_branch=20),
    "pine": dict(
        H=13, trunk=dict(length=12.0, radius=0.26, taper=0.25, wobble=0.035, lean=0.07, flare=0.25),
        levels=[dict(count=(12, 16), t=(0.55, 0.99), angle=78, angle_var=12, ratio=0.3, shape="flame", rratio=0.4,
                     bend=0.5, wobble=0.12, abs_length=3.4),
                dict(per_m=3.2, t=(0.2, 1.0), angle=45, ratio=0.42, rratio=0.5, bend=0.4, wobble=0.15),
                dict(per_m=2.0, t=(0.3, 1.0), angle=40, ratio=0.4, rratio=0.5, bend=0.5, wobble=0.15)],
        leaves=dict(kind="needles", per_m=16, length=0.42, width=0.05, needles=8, levels=[2, 3], t0=0.3, angle=12, spread=(0.35, 1.3),
                    colors=G("#3d5e34", "#466a3a", "#35532e"), tip=hexc("#6a8a4a"), keep_scale=[1, 1.3, 1.6]),
        bark=dict(color=hexc("#a8603a"), dark=hexc("#4a3428"), fx=3, fy=1.5, contrast=1.0,
                  marks=dict(color=hexc("#4f4038"), lo=-0.2, hi=0.3, foot=hexc("#3b2f28"))),
        bark_top=0.55, card_lobes=8),
    "spruce": dict(
        H=12, trunk=dict(length=11.5, radius=0.24, taper=0.12, wobble=0.015, lean=0.015, flare=0.3),
        levels=[dict(count=(40, 48), whorl=4, t=(0.08, 0.98), angle=100, angle_var=8, ratio=0.4, shape="conical",
                     rratio=0.35, bend=0.25, wobble=0.06, abs_length=3.3),
                dict(per_m=4.0, t=(0.15, 1.0), angle=60, ratio=0.4, rratio=0.5, bend=-0.4, wobble=0.1, planar=0.3)],
        leaves=dict(per_m=34, length=0.32, width=0.05, levels=[1, 2], t0=0.15, angle=35, fold=0.6, curl=0.1, face_up=0.6,
                    droop=0.2, colors=G("#2c4a34", "#33553a", "#284430"), tip=hexc("#4d6e4a"), keep_scale=[1, 1.3, 1.6]),
        bark=dict(color=hexc("#6b5040"), dark=hexc("#3c2c24"), fx=3, fy=1.2, contrast=1.0), bark_top=0.3, card_style="cone",
        card_ribbons=1),
    "palm": dict(
        H=8, trunk=dict(length=7.6, radius=0.2, taper=0.7, wobble=0.0, lean=0.22, bend=0.35, flare=0.4),
        levels=[], palm=dict(fronds=13, length=3.2, droop=1.6, nuts=6),
        leaves=dict(per_m=12, length=0.85, width=0.06, levels=[], colors=G("#5a8a32", "#6a9a3a", "#4c7a2c"),
                    tip=hexc("#a8b860"), fold=0.6, curl=0.25, keep_scale=[1, 1.2, 1.2]),
        bark=dict(color=hexc("#8a7a62"), dark=hexc("#5a4c3c"), fx=1, fy=0.5, contrast=0.6,
                  rings=dict(freq=4.5, depth=0.35)), trunk_sides=[10, 6, 5], bark_top=0.85, card_style="fronds",
        card_ribbons=1),
    "acacia": dict(
        H=6.5, trunk=dict(length=2.4, radius=0.22, taper=0.6, wobble=0.08, lean=0.12, flare=0.3),
        levels=[dict(count=(4, 5), t=(0.75, 1.0), angle=38, angle_var=12, ratio=1.25, shape="uniform", rratio=0.7,
                     bend=0.6, wobble=0.15, abs_length=3.4),
                dict(per_m=1.6, t=(0.5, 1.0), angle=65, ratio=0.6, rratio=0.5, bend=-0.35, wobble=0.15, planar=0.85),
                dict(per_m=5, t=(0.2, 1.0), angle=60, ratio=0.3, rratio=0.5, bend=-0.1, wobble=0.15, planar=0.95)],
        leaves=dict(per_m=60, length=0.17, width=0.07, levels=[2, 3], t0=0.3, colors=G("#7a8a3a", "#6c7e32", "#8a9842"),
                    tip=hexc("#b0b85a"), angle=75, tilt=0.15, face_up=1.5, fold=0.1, curl=0.05),
        bark=dict(color=hexc("#5c5048"), dark=hexc("#2e2824"), fx=3, fy=1.5, contrast=1.2, rough=0.05),
        bark_top=0.9, card_lobes=7),
    "willow": dict(
        H=8.5, trunk=dict(length=3.2, radius=0.38, taper=0.55, wobble=0.08, lean=0.08, flare=0.4),
        levels=[dict(count=(6, 7), t=(0.7, 1.0), angle=35, angle_var=10, ratio=1.0, shape="uniform", rratio=0.6,
                     bend=0.8, wobble=0.15, abs_length=3.8),
                dict(per_m=2.0, t=(0.3, 1.0), angle=55, ratio=0.5, rratio=0.45, bend=-0.3, wobble=0.15),
                dict(per_m=5.0, t=(0.2, 1.0), angle=70, ratio=1.2, rratio=0.4, bend=-5.5, wobble=0.04, rtip=0.004,
                     gain=0.45)],
        leaves=dict(per_m=26, length=0.15, width=0.02, levels=[3], t0=0.05, colors=G("#7a9a48", "#8aaa52", "#6a8a40"),
                    tip=hexc("#b8c878"), angle=30, droop=0.6, tilt=0.6, fold=0.2, curl=0.05, keep_scale=[1, 1, 1.1]),
        bark=dict(color=hexc("#6a5c4a"), dark=hexc("#3a3028"), fx=5, fy=0.8, contrast=1.4, rough=0.06),
        bark_top=0.9, card_lobes=7, n_branch=16),
    "birch": dict(
        H=10, trunk=dict(length=9.4, radius=0.15, taper=0.35, wobble=0.04, lean=0.06, flare=0.2),
        levels=[dict(count=(9, 12), t=(0.35, 0.98), angle=40, angle_var=12, ratio=0.38, shape="ovoid", rratio=0.45,
                     bend=0.35, wobble=0.12),
                dict(per_m=2.6, t=(0.25, 1.0), angle=48, ratio=0.5, rratio=0.45, bend=-0.35, wobble=0.15),
                dict(per_m=4, t=(0.25, 1.0), angle=40, ratio=0.4, rratio=0.45, bend=-0.8, wobble=0.12, rtip=0.004)],
        leaves=dict(per_m=36, length=0.13, width=0.08, levels=[2, 3], t0=0.3, colors=G("#82ad3c", "#93b848", "#71a036"),
                    tip=hexc("#c0d468"), wpos=0.35, angle=60, droop=0.25, tilt=0.6, fold=0.2),
        bark=dict(color=hexc("#ecead8"), dark=hexc("#c9c6b4"), fx=2, fy=0.5, contrast=0.5,
                  marks=dict(color=hexc("#2a2622"), lo=0.28, hi=0.4, foot=hexc("#3a3430"))),
        min_r=[0.0, 0.012, 0.03], n_branch=16),
    "apple": dict(
        H=5.0, trunk=dict(length=2.0, radius=0.16, taper=0.6, wobble=0.1, lean=0.1, flare=0.3),
        levels=[dict(count=(4, 5), t=(0.6, 1.0), angle=48, angle_var=12, ratio=1.1, shape="uniform", rratio=0.7,
                     bend=0.35, wobble=0.22, abs_length=2.4),
                dict(per_m=2.5, t=(0.2, 1.0), angle=50, ratio=0.5, rratio=0.5, bend=0.0, wobble=0.25),
                dict(per_m=4.5, t=(0.25, 1.0), angle=45, ratio=0.4, rratio=0.5, bend=-0.1, wobble=0.25, rtip=0.004)],
        leaves=dict(per_m=40, length=0.15, width=0.07, levels=[2, 3], t0=0.3, colors=G("#5a8a32", "#699838", "#4f7c2c"),
                    tip=hexc("#99b850"), fold=0.3, curl=0.12),
        bark=dict(color=hexc("#6a5848"), dark=hexc("#3c3028"), fx=4, fy=1.0, contrast=1.2, rough=0.05),
        fruit=dict(count=34, radius=0.045, colors=G("#c0302a", "#d24a2a", "#b8382c", "#c8a030")),
        bark_top=0.9, n_branch=18),
    "mangrove": dict(
        H=6.5, trunk=dict(base=[0, 1.1, 0], length=3.0, radius=0.18, taper=0.6, wobble=0.07, lean=0.05, flare=0.0),
        levels=[dict(count=(5, 6), t=(0.5, 1.0), angle=48, angle_var=12, ratio=0.9, shape="uniform", rratio=0.6,
                     bend=0.3, wobble=0.18, abs_length=2.4),
                dict(per_m=2.5, t=(0.25, 1.0), angle=50, ratio=0.5, rratio=0.5, bend=0.05, wobble=0.2),
                dict(per_m=4.5, t=(0.25, 1.0), angle=45, ratio=0.35, rratio=0.5, bend=0.1, wobble=0.2, rtip=0.004)],
        leaves=dict(per_m=40, length=0.18, width=0.08, levels=[2, 3], t0=0.3, colors=G("#3f6e34", "#4a7a3a", "#36622e"),
                    tip=hexc("#7a9a52"), fold=0.2, curl=0.05, tilt=0.4),
        bark=dict(color=hexc("#7a6a58"), dark=hexc("#4a3e32"), fx=3, fy=1.0, contrast=0.9),
        roots=dict(count=11, **{"from": (1.2, 2.6)}, reach=(1.4, 2.6), radius=0.045), bark_top=0.6, n_branch=16),
    "emergent": dict(
        H=24, trunk=dict(length=19.0, radius=0.55, taper=0.45, wobble=0.02, lean=0.02, flare=0.0),
        levels=[dict(count=(7, 8), t=(0.8, 1.0), angle=72, angle_var=10, ratio=0.4, shape="inverse", rratio=0.5,
                     bend=0.15, wobble=0.12, abs_length=9.0),
                dict(per_m=1.2, t=(0.3, 1.0), angle=55, ratio=0.45, rratio=0.5, bend=0.1, wobble=0.15, planar=0.5),
                dict(per_m=3.0, t=(0.3, 1.0), angle=50, ratio=0.4, rratio=0.5, bend=0.15, wobble=0.2, rtip=0.006)],
        leaves=dict(per_m=30, length=0.42, width=0.18, levels=[2, 3], t0=0.3, colors=G("#4e7e2e", "#5a8a36", "#43702a"),
                    tip=hexc("#8aac4a"), fold=0.3, curl=0.1, keep_scale=[1, 1, 1], grow_scale=[1, 1, 1]),
        bark=dict(color=hexc("#a49a86"), dark=hexc("#6e6656"), fx=2, fy=0.6, contrast=0.7,
                  moss=dict(color=hexc("#6a7a3a"), lo=0.3, hi=1.1, top=99)),
        buttress=dict(fins=5, amount=3.2, height=1.4, offset=0.3), trunk_sides=[20, 12, 6], trunk_rings=[22, 10, 4],
        lianas=4, bromeliads=7, bark_top=0.75, budget=(9500, 2800, 800), seg_scale=1.5, card_lobes=7, n_branch=24),
    "snag": dict(
        H=7, trunk=dict(length=6.0, radius=0.3, taper=0.6, wobble=0.04, lean=0.05, flare=0.45),
        levels=[dict(count=(5, 7), t=(0.35, 0.95), angle=60, angle_var=15, ratio=0.4, shape="hemi", rratio=0.45,
                     bend=0.25, wobble=0.2, **{"break": 0.35}),
                dict(per_m=1.6, t=(0.3, 1.0), angle=50, ratio=0.45, rratio=0.45, bend=0.1, wobble=0.25, **{"break": 0.3})],
        leaves=None,
        bark=dict(color=hexc("#a8a092"), dark=hexc("#6a5a48"), fx=3, fy=0.7, contrast=1.3, rough=0.04,
                  marks=dict(color=hexc("#7a5e42"), lo=0.15, hi=0.35, foot=hexc("#4a3e32"))),
        open_top=False, holes=3, brackets=3, bark_top=0.9, card_wood_level=2, card_ribbons=14, n_branch=18),
}

# Variants: (seed, tweaks). Tweaks scale the trunk/H or swap a few settings.
VARIANTS = {
    "oak": [(11, {}), (12, {"H": 7.5, "trunk.length": 5.4, "levels.0.count": (5, 6), "bark.moss": None}),
            (13, {"H": 9.5, "trunk.length": 7.0, "trunk.lean": 0.12})],
    "beech": [(21, {}), (22, {"H": 9.5, "trunk.length": 7.6, "leaves.colors": G("#8aa83a", "#9aae42", "#a0a03a")}),
              (23, {"H": 12.5, "trunk.length": 10.2})],
    "pine": [(31, {}), (32, {"H": 10, "trunk.length": 9.2, "trunk.lean": 0.15, "levels.0.t": (0.45, 0.99)}),
             (33, {"H": 15, "trunk.length": 14.0, "levels.0.abs_length": 3.0})],
    "spruce": [(41, {}), (42, {"H": 8, "trunk.length": 7.6, "levels.0.abs_length": 2.4, "levels.0.count": (32, 36)}),
               (43, {"H": 15, "trunk.length": 14.5, "levels.0.abs_length": 3.6, "levels.0.count": (48, 52)})],
    "palm": [(51, {}), (52, {"H": 10, "trunk.length": 9.6, "trunk.lean": 0.35, "trunk.bend": 0.6}),
             (53, {"H": 6, "trunk.length": 5.6, "trunk.lean": 0.08, "palm.fronds": 11})],
    "acacia": [(61, {}), (62, {"trunk.length": 3.0, "levels.0.abs_length": 4.2, "levels.0.count": (3, 4)}),
               (63, {"trunk.length": 1.8, "levels.0.abs_length": 2.8, "leaves.colors": G("#9a9a48", "#8a8c3e", "#a8a452")})],
    "willow": [(71, {}), (72, {"trunk.length": 2.6, "trunk.lean": 0.2, "levels.0.abs_length": 3.2})],
    "birch": [(81, {}), (82, {"H": 8, "trunk.length": 7.4, "trunk.lean": 0.12}),
              (83, {"H": 11.5, "trunk.length": 10.8, "leaves.colors": G("#c8b03a", "#d8bc42", "#b89a30")})],
    "apple": [(91, {}), (92, {"fruit.colors": G("#8ab038", "#9ab840", "#c8b040"), "fruit.count": 26}),
              (93, {"fruit": None, "blossom": dict(count=240, colors=G("#f6e4ea", "#f2cfd8", "#fbf2f2")),
                    "leaves.per_m": 22})],
    "mangrove": [(101, {}), (102, {"trunk.length": 2.4, "roots.count": 14, "roots.reach": (1.6, 3.0)})],
    "emergent": [(111, {}), (112, {"H": 20, "trunk.length": 15.5, "levels.0.abs_length": 6.0, "lianas": 6})],
    "snag": [(121, {}), (122, {"H": 5, "trunk.length": 4.2, "levels.0.count": (3, 4), "holes": 2}),
             (123, {"trunk.length": 7.5, "trunk.radius": 0.36, "holes": 4, "brackets": 5,
                     "levels": [dict(count=(4, 5), t=(0.3, 0.9), angle=75, angle_var=15, ratio=0.12, shape="uniform",
                                     rratio=0.4, bend=0.1, wobble=0.1, **{"break": 1.0})]})],
}


def apply_tweaks(spec, tweaks):
    import copy
    spec = copy.deepcopy(spec)
    for key, val in tweaks.items():
        parts = key.split(".")
        node = spec
        for p in parts[:-1]:
            node = node[int(p)] if p.isdigit() else node[p]
        last = parts[-1]
        if val is None and not last.isdigit():
            node.pop(last, None)
        elif last.isdigit():
            node[int(last)] = val
        else:
            node[last] = val
    return spec


def build_tree(kind, variant_index):
    seed, tweaks = VARIANTS[kind][variant_index]
    spec = apply_tweaks(SPECIES[kind], tweaks)
    return build_from_spec(kind, "abc"[variant_index], spec, seed)


def build_from_spec(kind, variant, spec, seed, set_="trees"):
    """Any branching plant from a spec (trees here; bushes in plants.py)."""
    rng = np.random.default_rng(seed)
    if kind == "palm":
        tree = build_skeleton(dict(spec, leaves=None), rng)
        palm_crown(tree, spec, rng)
    else:
        tree = build_skeleton(spec, rng)
    if spec.get("roots"):
        prop_roots(tree, spec, rng)
    if spec.get("lianas"):
        lianas(tree, spec, rng, None)
    if spec.get("bromeliads"):
        bromeliads(tree, spec, rng)
    for i in range(spec.get("holes", 0)):
        add_hole(tree, spec, rng.uniform(0.25, 0.7), rng, rng.uniform(0.05, 0.08))
    if spec.get("fruit"):
        add_fruits(tree, spec, rng, "fruit")
    if spec.get("blossom"):
        add_fruits(tree, spec, rng, "blossom")
    lods = []
    budget = spec.get("budget", BUDGET)
    for detail in range(3):
        for min_r in (0.0, 0.006, 0.009, 0.012, 0.016, 0.022, 0.03, 0.045, 0.07):
            m = Mesh()
            mesh_wood(spec, tree, detail, m, min_r)
            if m.tris <= budget[detail] * (0.62 if tree.leaves else 0.95):
                break
        mesh_holes(tree, m, detail)
        mesh_rosettes(tree, m, detail, rng)
        if getattr(tree, "fruits", None):
            fruit_parts(tree, spec, rng, detail, m, "blossom" if spec.get("blossom") else "fruit")
        if kind == "snag":
            snag_extras(tree, spec, np.random.default_rng(seed), m, detail)
        wood = m.tris
        if tree.leaves:
            LV = spec["leaves"]
            per = (LV.get("needles", 7) if detail == 0 else 4) if LV.get("kind") == "needles" else \
                {0: 2, 1: 4, 2: 8}[LV.get("segs", 0) if detail == 0 else 0]
            mesh_leaves(spec, tree, detail, m, np.random.default_rng(seed + detail),
                        target=max(budget[detail] * 0.3, budget[detail] - wood) / per)
        lods.append(m)
        tree.wood_tris = getattr(tree, "wood_tris", []) + [wood]
    card = mesh_card(spec, tree, np.random.default_rng(seed))
    pts = tree_attach(spec, tree, np.random.default_rng(seed))
    lo, hi = lods[0].bounds()
    H = float(hi[1])
    meta = dict(wood_tris=tree.wood_tris, leaves=len(tree.leaves), height=round(H, 2), crown_radius=round(float(max(-lo[0], hi[0], -lo[2], hi[2])), 2),
                trunk_radius=round(float(tree.limbs[0].rad[0]), 3),
                lod_distances=[round(2.5 * H, 1), round(6 * H, 1), round(14 * H, 1)])
    if spec.get("no_card"):
        card = None
    if "lod_k" in spec:
        meta["lod_distances"] = [round(k * H, 1) for k in spec["lod_k"]]
    return Asset(set_, kind, variant, lods, card, pts, meta)


def all_trees(only=None):
    for kind in SPECIES:
        if only and kind not in only:
            continue
        for i in range(len(VARIANTS[kind])):
            yield lambda kind=kind, i=i: build_tree(kind, i)
