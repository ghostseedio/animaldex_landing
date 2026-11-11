"""Plants: grass clumps and bare soil, ferns, bushes (some with berries), reeds, lily pads,
kelp, seagrass, mushrooms and fungi, moss mats, roots, wildflowers with real petal heads
(open, with a 'closed' morph target) and the dandelion (flower and seed head).
"""

import math

import numpy as np

import trees
from arkgeo import (UP, Asset, Mesh, attach, fbm, hexc, jitter, leaf_blade, mix, norm, perp, place_frame, rotate,
                    smoothstep, thin, tube, uv_sphere)

G = lambda *h: [hexc(x) for x in h]


def wind(n, sway, phase=0.0, flutter=0.0, lphase=0.0):
    W = np.zeros((n, 4))
    W[:, 0] = sway
    W[:, 1] = phase
    W[:, 2] = flutter
    W[:, 3] = lphase
    return W


# MARK: - Blades (grass, reeds, seagrass, kelp)

def blade(base, height, width, segs, lean_dir, curve, color_base, color_tip, phase, sway_k=1.0, twist=0.0,
          wave=0.0, rng=None, taper=1.3, up_normal=0.45, ao=0.55):
    """A tapered strip rising from base, bending toward lean_dir (curve = horizontal reach / height)."""
    lean_dir = norm(np.array([lean_dir[0], 0, lean_dir[2]]))
    t = np.linspace(0, 1, segs + 1)
    centre = base + UP * (height * (t - 0.18 * curve * t ** 2))[:, None] * 1.0 + lean_dir * (curve * height * t ** 2)[:, None]
    if wave:
        side0 = np.cross(lean_dir, UP)
        centre += side0 * (wave * height * np.sin(t * 9 + phase * 6) * t)[:, None]
    tang = np.gradient(centre, axis=0)
    tang = norm(tang)
    side = norm(np.cross(tang, lean_dir[None].repeat(len(t), 0)))
    if twist:
        side = np.array([rotate(side[i], tang[i], twist * t[i]) for i in range(len(t))])
    w = width * (1 - t ** taper) * 0.5
    w[-1] = 0
    P, F = [], []
    for i in range(segs):
        P += [centre[i] - side[i] * w[i], centre[i] + side[i] * w[i]]
    P.append(centre[-1])
    P = np.array(P)
    for i in range(segs - 1):
        a = 2 * i
        F += [[a, a + 1, a + 3], [a, a + 3, a + 2]]
    a = 2 * (segs - 1)
    F.append([a, a + 1, 2 * segs])
    tt = np.concatenate([np.repeat(t[:-1], 2), [1.0]])
    face = norm(np.cross(np.repeat(side[:-1], 2, 0).tolist() + [side[-2]], np.repeat(tang[:-1], 2, 0).tolist() + [tang[-1]]))
    N = norm(face * (1 - up_normal) + UP * up_normal)
    col = mix(color_base, color_tip, tt ** 0.8)
    col[:, :3] *= (ao + (1 - ao) * np.clip(tt * 1.6, 0, 1))[:, None]
    Wv = wind(len(P), np.clip(sway_k * tt ** 1.5, 0, 1), phase, tt, phase)
    return P, np.array(F), N, col, Wv


GRASS = {
    "grass-lawn": dict(n=110, h=(0.07, 0.17), w=(0.005, 0.008), r=0.14, curve=(0.15, 0.8), base=G("#3f6a26", "#4a7a2c"),
                       tip=G("#8ab04a", "#9cbc52"), seeds=0),
    "grass-meadow": dict(n=46, h=(0.3, 0.6), w=(0.008, 0.013), r=0.16, curve=(0.1, 0.45), base=G("#46702a", "#507a30"),
                         tip=G("#a8b850", "#b8bc62", "#98ae48"), seeds=6, seed_color=hexc("#a89a62")),
    "grass-broad": dict(n=24, h=(0.35, 0.7), w=(0.022, 0.034), r=0.12, curve=(0.3, 0.7), base=G("#2f5a24", "#386428"),
                        tip=G("#6a9a3a", "#7aa646"), seeds=0, segs=5),
    "grass-dry": dict(n=50, h=(0.45, 0.95), w=(0.006, 0.01), r=0.14, curve=(0.1, 0.4), base=G("#7a6a3a", "#8a7a44"),
                      tip=G("#d8c07a", "#e2cc88", "#c8b06a"), seeds=8, seed_color=hexc("#c8a868")),
    "sedge": dict(n=30, h=(0.35, 0.6), w=(0.01, 0.014), r=0.1, curve=(0.05, 0.25), base=G("#2a4a2a", "#30542e"),
                  tip=G("#5a7a3a", "#4e7036"), seeds=4, seed_color=hexc("#5a4632"), ao=0.6),
}


def grass_clump(kind, variant, seed):
    S = GRASS[kind]
    rng = np.random.default_rng(seed)
    dens = 1.0 if variant == "a" else 0.6
    hs = 1.0 if variant == "a" else 1.35
    blades = []
    for i in range(int(S["n"] * dens)):
        a = rng.uniform(0, 2 * math.pi)
        rr = S["r"] * math.sqrt(rng.uniform()) * (1 if variant == "a" else 1.4)
        base = np.array([math.cos(a) * rr, -0.01, math.sin(a) * rr])
        out = norm(np.array([math.cos(a), 0, math.sin(a)]) + rng.normal(0, 0.5, 3))
        blades.append(dict(base=base, h=rng.uniform(*S["h"]) * hs, w=rng.uniform(*S["w"]), lean=out,
                           curve=rng.uniform(*S["curve"]), cb=jitter(S["base"][i % len(S["base"])], rng, 0.08),
                           ct=jitter(S["tip"][int(rng.integers(len(S["tip"])))], rng, 0.08), phase=rng.uniform(),
                           twist=rng.uniform(-0.8, 0.8)))
    lods = []
    for detail, (segs, keep, widen) in enumerate([(S.get("segs", 4), 1.0, 1.0), (2, 0.4, 1.5), (1, 0.14, 2.6)]):
        m = Mesh()
        for j, b in enumerate(blades[: max(4, int(len(blades) * keep))]):
            P, F, N, C, W = blade(b["base"], b["h"], b["w"] * widen, segs, b["lean"], b["curve"], b["cb"], b["ct"],
                                  b["phase"], twist=b["twist"] if detail == 0 else 0, ao=S.get("ao", 0.55))
            m.add(P, F, N, C, W)
        for j in range(S["seeds"] if detail < 2 else 0):
            b = blades[j]
            h = b["h"] * 1.25
            stalk = np.array([b["base"], b["base"] + UP * h * 0.6 + b["lean"] * 0.03, b["base"] + UP * h + b["lean"] * h * 0.12])
            P, F, N, C, W = tube(stalk, [0.002, 0.0015, 0.001], 3, color=hexc("#8a9a50"),
                                 wind=wind(3, 0, b["phase"])[0], cap_end=False)
            W[:, 0] = np.clip((P[:, 1] / h) ** 1.5, 0, 1)
            m.add(P, F, N, C, W)
            top = stalk[-1]
            for k in range(6 if detail == 0 else 3):
                d = norm(UP * 1.4 + rotate(b["lean"], UP, k * 2.1) * 0.6)
                q = top - UP * k * h * 0.035
                spk = np.array([q - perp(d) * 0.006, q + perp(d) * 0.006, q + d * h * 0.07])
                m.add(spk, [[0, 1, 2]], None, np.tile(jitter(S["seed_color"], rng, 0.1), (3, 1)),
                      wind(3, min(1, (q[1] / h) ** 1.5 + 0.05), b["phase"], 0.6))
        lods.append(m)
    pts = []
    for b in blades[::max(1, len(blades) // 8)]:
        p = b["base"] + UP * b["h"] * 0.6 + b["lean"] * b["curve"] * b["h"] * 0.36
        pts.append(attach("stem", p, norm(b["lean"] + UP * 0.2), UP, (0.002, 0.03), lod=0, spot="flowers"))
    H = max(b["h"] for b in blades)
    return Asset("plants", kind, variant, lods, None, pts,
                 dict(height=round(H, 2), group="grass", lod_distances=[6.0, 15.0, 35.0]))


def soil_patch(variant, seed):
    """Bare soil: an irregular low mound that blends into the ground at its edge, crumbs and a few sprouts."""
    rng = np.random.default_rng(seed)
    R = 0.6 if variant == "a" else 0.9
    lods = []
    pts = []
    for detail, (rings, sides) in enumerate([(6, 22), (3, 12), (1, 8)]):
        m = Mesh()
        P = [[0, 0.025, 0]]
        for i in range(1, rings + 1):
            t = i / rings
            for j in range(sides):
                a = 2 * math.pi * j / sides
                jag = 1 + 0.25 * fbm(np.array([[math.cos(a) * 2, math.sin(a) * 2, seed]]), 2)[0]
                r = R * t * jag
                P.append([math.cos(a) * r, 0.025 * (1 - t ** 2) + 0.01 * fbm(np.array([[math.cos(a) * r * 6, 3, math.sin(a) * r * 6]]))[0], math.sin(a) * r])
        P = np.array(P)
        F = [[0, 1 + (j + 1) % sides, 1 + j] for j in range(sides)]
        for i in range(rings - 1):
            for j in range(sides):
                a0 = 1 + i * sides + j
                a1 = 1 + i * sides + (j + 1) % sides
                F += [[a0, a1, a1 + sides], [a0, a1 + sides, a0 + sides]]
        n = fbm(P * 7 + seed, 3)
        C = mix(hexc("#5a4230"), hexc("#7a5e44"), np.clip(0.5 + n * 1.4, 0, 1))
        dist = np.linalg.norm(P[:, [0, 2]], axis=1) / R
        C = mix(C, hexc("#4a5a2e"), smoothstep(0.75, 1.05, dist))
        m.add(P, F, None, C, np.zeros((len(P), 4)))
        if detail < 2:
            r2 = np.random.default_rng(seed + 1)
            for k in range(28 if detail == 0 else 10):
                a, r = r2.uniform(0, 2 * math.pi), R * 0.85 * math.sqrt(r2.uniform())
                c = np.array([math.cos(a) * r, 0.02, math.sin(a) * r])
                s = r2.uniform(0.008, 0.025)
                q = np.array([[0, s * 0.7, 0], [s, 0, 0], [-s * 0.5, 0, s * 0.8], [-s * 0.5, 0, -s * 0.8]]) + c
                m.add(q, [[0, 1, 2], [0, 2, 3], [0, 3, 1]], None,
                      np.tile(jitter(hexc("#8a7c6a" if k % 3 else "#6a5a48"), r2, 0.15), (4, 1)), np.zeros((4, 4)))
            for k in range(5 if variant == "b" else 3):
                a, r = r2.uniform(0, 2 * math.pi), R * 0.7 * math.sqrt(r2.uniform())
                base = np.array([math.cos(a) * r, 0.015, math.sin(a) * r])
                for side in (-1, 1):
                    fwd = norm(np.array([side * 0.8, 1.2, r2.uniform(-0.3, 0.3)]))
                    Pl, Fl, fl = leaf_blade(0.03, 0.012, 0.3, 0.1, 0.5, 0)
                    Pw, x, y, z = place_frame(Pl, base + UP * 0.02, fwd, UP)
                    m.add(Pw, Fl, np.tile(UP, (len(Pw), 1)), np.tile(hexc("#7aaa3a"), (len(Pw), 1)),
                          wind(len(Pw), 0.3, r2.uniform(), fl))
        lods.append(m)
    rng2 = np.random.default_rng(seed + 2)
    for k in range(6):
        a, r = rng2.uniform(0, 2 * math.pi), R * 0.6 * math.sqrt(rng2.uniform())
        pts.append(attach("soil", [math.cos(a) * r, 0.03, math.sin(a) * r], UP, [math.cos(a), 0, math.sin(a)],
                          (0.003, 0.3), lod=0, spot="leaf_litter"))
    return Asset("plants", "soil-patch", variant, lods, None, pts,
                 dict(height=0.03, group="ground", lod_distances=[8.0, 20.0, 50.0], view=dict(elev=40)))


# MARK: - Ferns

FERNS = {
    "fern-lady": dict(fronds=9, len=(0.6, 0.9), pinnae=16, plen=0.14, pw=0.035, rise=0.9, droop=1.0,
                      colors=G("#5a9a34", "#68a83a", "#4e8a2e"), lobed=True),
    "fern-sword": dict(fronds=12, len=(0.7, 1.0), pinnae=20, plen=0.11, pw=0.022, rise=1.3, droop=0.7,
                       colors=G("#2e5a26", "#38662c", "#2a5022"), lobed=False),
    "fern-bracken": dict(fronds=5, len=(0.9, 1.3), pinnae=10, plen=0.3, pw=0.05, rise=2.2, droop=1.6,
                         colors=G("#6a9a3a", "#7aa640", "#8aa848"), lobed=True, tall=True),
}


def fern(kind, variant, seed):
    S = FERNS[kind]
    rng = np.random.default_rng(seed)
    fronds = []
    nf = S["fronds"] + (2 if variant == "b" else 0)
    for i in range(nf):
        a = 2 * math.pi * i / nf + rng.uniform(-0.25, 0.25)
        out = np.array([math.cos(a), 0, math.sin(a)])
        L = rng.uniform(*S["len"]) * (1.15 if variant == "b" else 1.0)
        d0 = norm(out + UP * S["rise"] * rng.uniform(0.8, 1.2))
        pts = trees.grow_path(rng, np.array([0, 0.0, 0]) + out * 0.03, d0, L, 0.06, -S["droop"] * rng.uniform(0.8, 1.2), 0.02)
        fronds.append(dict(pts=pts, L=L, phase=rng.uniform(), col=jitter(S["colors"][i % len(S["colors"])], rng, 0.06)))
    lods = []
    for detail, (pn, sides, segs) in enumerate([(S["pinnae"], 3, 0), (max(5, S["pinnae"] // 3), 3, 0), (3, 0, 0)]):
        m = Mesh()
        for f in fronds:
            limb = trees.Limb(f["pts"], np.linspace(0.006, 0.002, len(f["pts"])), 1, f["phase"], 0.0, 0.9)
            if sides:
                P, F, N, C, W = tube(f["pts"][::2] if detail else f["pts"], 0.005, sides, color=hexc("#5a6a32"),
                                     cap_end=False)
                t = np.linspace(0, 1, len(P) // sides).repeat(sides)[:len(P)]
                m.add(P, F, N, C, wind(len(P), np.clip(t * 0.9, 0, 1), f["phase"]))
            for j in range(pn):
                t = 0.15 + 0.85 * (j + 0.5) / pn
                p, d, r = limb.at(t)
                size = (1 - abs(t - 0.4) / 0.6 * 0.75) * (1.0 if detail == 0 else 3.0 / max(1, pn / S["pinnae"] * 3))
                size = (1 - abs(t - 0.4) / 0.6 * 0.75)
                scale = 1.0 if detail == 0 else math.sqrt(S["pinnae"] / pn) * 0.9
                side = norm(np.cross(d, UP))
                if np.linalg.norm(side) < 1e-6:
                    side = perp(d)
                for sgn in (-1, 1):
                    fwd = norm(side * sgn + d * 0.35)
                    up = norm(np.cross(d, side * sgn) * sgn * -1 + UP * 0.5)
                    if up[1] < 0:
                        up = -up
                    if S.get("lobed") and detail == 0:
                        Pl, Fl, fl = lobed_pinna(S["plen"] * size * scale, S["pw"] * size * scale)
                    else:
                        Pl, Fl, fl = leaf_blade(S["plen"] * size * scale, S["pw"] * size * scale, 0.3, 0.15, 0.4, 0)
                    Pw, x, y, z = place_frame(Pl, p, fwd, up)
                    col = np.tile(f["col"], (len(Pw), 1))
                    col[:, :3] *= (0.7 + 0.35 * t + 0.1 * fl)[:, None]
                    m.add(Pw, Fl, np.tile(norm(up + UP * 0.6), (len(Pw), 1)), col,
                          wind(len(Pw), min(1, 0.3 + 0.7 * t), f["phase"], fl, rng.uniform()))
            if detail == 2:
                # A whole-frond silhouette strip.
                pts2 = f["pts"][:: max(1, len(f["pts"]) // 4)]
                k = len(pts2)
                T = norm(np.gradient(pts2, axis=0))
                side = norm(np.cross(T, UP[None].repeat(k, 0)))
                wd = S["plen"] * np.sin(np.linspace(0.3, 2.8, k)) * 0.9
                P = np.concatenate([pts2 - side * wd[:, None], pts2 + side * wd[:, None]])
                F = []
                for i in range(k - 1):
                    F += [[i, i + 1, k + i + 1], [i, k + i + 1, k + i]]
                m.add(P, F, np.tile(UP, (len(P), 1)), np.tile(f["col"] * np.array([0.85, 0.85, 0.85, 1]), (len(P), 1)),
                      wind(len(P), 0.6, f["phase"]))
        if variant == "b" and detail == 0:
            # Two fiddleheads uncurling in the middle.
            for k in range(2):
                a = rng.uniform(0, 2 * math.pi)
                base = np.array([math.cos(a) * 0.02, 0, math.sin(a) * 0.02])
                th = np.linspace(0, 1, 14)
                ang = th * 4.2
                rad = 0.05 * (1 - th * 0.85)
                stem_h = 0.18 + 0.08 * k
                pts = np.stack([base[0] + np.sin(ang) * rad * math.cos(a) * 0 + rad * np.sin(ang) * 0.3,
                                stem_h * np.minimum(th * 3, 1) + rad * np.cos(ang) * (th > 0.33),
                                base[2] + rad * np.sin(ang) * (th > 0.33)], 1)
                P, F, N, C, W = tube(pts, np.linspace(0.008, 0.004, len(pts)), 5, color=hexc("#7a9a3a"))
                m.add(P, F, N, C, wind(len(P), 0.2, 0.3))
        lods.append(m)
    pts = []
    for f in fronds[::2]:
        limb = trees.Limb(f["pts"], np.full(len(f["pts"]), 0.005), 1, 0, 0, 0)
        p, d, r = limb.at(0.45)
        pts.append(attach("leaf", p + UP * 0.01, norm(UP * 1.0 - d * 0.3), d, (0.002, S["plen"] * 0.8), lod=0,
                          spot="leaf_litter"))
    pts.append(attach("leaf_litter", [0, 0.01, 0], UP, [1, 0, 0], (0.003, 0.15), lod=0, spot="leaf_litter",
                      note="under the fronds"))
    H = float(max(f["pts"][:, 1].max() for f in fronds))
    return Asset("plants", kind, variant, lods, None, pts, dict(height=round(H, 2), group="fern",
                                                                 lod_distances=[8.0, 20.0, 45.0]))


def lobed_pinna(length, width):
    """A pinna with three lobe pairs along its midrib (a toothed outline)."""
    P = [[0, 0, 0]]
    F = []
    fl = [0]
    k = 4
    for i in range(1, k + 1):
        t = i / (k + 0.4)
        w = width * (1 - t) * 1.25
        z0 = length * t
        P += [[-w, -0.15 * w, z0 - length * 0.06], [0, 0.1 * width, z0], [w, -0.15 * w, z0 - length * 0.06]]
        fl += [t, t, t]
    P.append([0, 0, length])
    fl.append(1)
    prev_mid = 0
    for i in range(k):
        l, mid, r = 1 + 3 * i, 2 + 3 * i, 3 + 3 * i
        F += [[prev_mid, mid, l], [prev_mid, r, mid]]
        prev_mid = mid
    F.append([prev_mid, len(P) - 1, 1 + 3 * (k - 1)])
    F.append([prev_mid, 3 + 3 * (k - 1), len(P) - 1])
    return np.array(P, float), np.array(F), np.array(fl, float)


# MARK: - Bushes (the tree skeleton, small)

def bush_spec(height, stems, leaf, colors, bark="#5a4a3a", fruit=None, droop=0.0, per_m=40, width=1.0):
    return dict(
        H=height, trunk=dict(length=0.18, radius=0.03, taper=0.8, wobble=0.0, lean=0.0, flare=0.2),
        levels=[dict(count=stems, t=(0.2, 1.0), angle=35 * width, angle_var=15, ratio=1.0, shape="uniform", rratio=0.6,
                     bend=0.2 - droop, wobble=0.25, abs_length=height * 0.9, rmin=0.012),
                dict(per_m=4.5, t=(0.2, 1.0), angle=50, ratio=0.45, rratio=0.55, bend=-droop * 0.5, wobble=0.3,
                     rtip=0.003),
                dict(per_m=6, t=(0.2, 1.0), angle=45, ratio=0.35, rratio=0.6, bend=0.0, wobble=0.3, rtip=0.002)],
        leaves=dict(per_m=per_m, length=leaf[0], width=leaf[1], levels=[2, 3], t0=0.15, colors=colors,
                    tip=colors[0] * np.array([1.2, 1.15, 0.9, 1]), tilt=0.6),
        bark=dict(color=hexc(bark), dark=hexc("#2e261e"), fx=6, fy=2, contrast=0.8),
        fruit=fruit, budget=(2600, 800, 220), min_r=[0.0, 0.004, 0.01], no_card=True, lod_k=[3, 8, 18],
        card_lobes=4, n_branch=8, n_leaf=8, bark_top=0.3)


BUSHES = {
    "bush-hazel": [(201, bush_spec(1.6, (7, 9), (0.11, 0.07), G("#4e7e2e", "#5a8a34", "#46722a")))],
    "bush-holly": [(211, bush_spec(1.3, (6, 7), (0.07, 0.035), G("#1f4a24", "#24542a", "#1a3e20"),
                                   fruit=dict(count=40, radius=0.009, colors=G("#c01818", "#d02020", "#b01414")))),
                   (212, bush_spec(1.0, (5, 6), (0.07, 0.035), G("#24502a", "#2a5a2e"), per_m=46))],
    "bush-blueberry": [(221, bush_spec(0.6, (8, 10), (0.035, 0.02), G("#4e7a34", "#5a8a3a", "#6a7a30"),
                                       fruit=dict(count=50, radius=0.007, colors=G("#2a3a7a", "#334488", "#283670")),
                                       per_m=60))],
    "bush-bramble": [(231, bush_spec(1.1, (6, 8), (0.07, 0.045), G("#3e6a2a", "#4a762e"), bark="#6a3a3a", droop=1.4,
                                     fruit=dict(count=36, radius=0.011, colors=G("#1a1020", "#3a1424", "#8a1a2a")),
                                     width=1.6)),
                     (232, bush_spec(0.8, (5, 6), (0.07, 0.045), G("#4a762e", "#5a8034"), bark="#6a3a3a", droop=1.0,
                                     width=1.4))],
}


def bush(kind, variant_index):
    seed, spec = BUSHES[kind][variant_index]
    a = trees.build_from_spec(kind, "abc"[variant_index], spec, seed, set_="plants")
    a.meta.update(group="bush", view=dict(elev=18))
    if spec.get("fruit"):
        a.meta["berries"] = True
    return a


# MARK: - Reeds, cattails

def reeds(variant, seed):
    rng = np.random.default_rng(seed)
    cattail = variant == "a"
    lods = []
    blades = []
    for i in range(26):
        a = rng.uniform(0, 2 * math.pi)
        r = 0.18 * math.sqrt(rng.uniform())
        blades.append(dict(base=np.array([math.cos(a) * r, -0.02, math.sin(a) * r]),
                           h=rng.uniform(0.9, 1.6), w=rng.uniform(0.014, 0.022),
                           lean=norm(np.array([math.cos(a), 0, math.sin(a)]) + rng.normal(0, 0.4, 3)),
                           curve=rng.uniform(0.05, 0.3), phase=rng.uniform(),
                           cb=jitter(hexc("#3e6a2e"), rng, 0.08), ct=jitter(hexc("#9aae58"), rng, 0.1)))
    stalks = []
    for i in range(5 if cattail else 7):
        a = rng.uniform(0, 2 * math.pi)
        r = 0.12 * math.sqrt(rng.uniform())
        stalks.append(dict(base=np.array([math.cos(a) * r, -0.02, math.sin(a) * r]), h=rng.uniform(1.4, 1.9),
                           lean=np.array([math.cos(a), 0, math.sin(a)]) * rng.uniform(0.02, 0.1), phase=rng.uniform()))
    for detail, (segs, keep, sides) in enumerate([(5, 1.0, 5), (3, 0.45, 4), (1, 0.18, 3)]):
        m = Mesh()
        for b in blades[: max(4, int(len(blades) * keep))]:
            m.add(*blade(b["base"], b["h"], b["w"] * (1 + detail * 0.6), segs, b["lean"], b["curve"], b["cb"], b["ct"],
                         b["phase"], twist=0.6 if detail == 0 else 0, ao=0.6))
        for s in stalks[: (len(stalks) if detail < 2 else 2)]:
            top = s["base"] + UP * s["h"] + s["lean"] * s["h"]
            pts = np.array([s["base"], s["base"] + (top - s["base"]) * 0.5, top])
            P, F, N, C, W = tube(pts, [0.006, 0.005, 0.003], 3 if detail else 4, color=hexc("#6a8040"), cap_end=False)
            W = wind(len(P), np.clip((P[:, 1] / s["h"]) ** 1.5, 0, 1), s["phase"])
            m.add(P, F, N, C, W)
            if cattail:
                hp = np.array([top - UP * 0.32, top - UP * 0.29, top - UP * 0.14, top - UP * 0.1])
                P, F, N, C, W = tube(hp, [0.012, 0.019, 0.019, 0.01], sides + 2 if detail == 0 else 4,
                                     color=jitter(hexc("#5a3a22"), rng, 0.06), cap_start=True)
                n = fbm(P * 40, 2)
                C[:, :3] *= (0.85 + 0.3 * n)[:, None]
                m.add(P, F, N, C, wind(len(P), 0.95, s["phase"]))
                spike = np.array([top - UP * 0.1, top + UP * 0.08])
                P, F, N, C, W = tube(spike, [0.003, 0.0008], 3, color=hexc("#8a7a4a"), cap_end=False)
                m.add(P, F, N, C, wind(len(P), 1.0, s["phase"]))
            else:
                # A feathery plume: many thin drooping spikelets.
                for k in range(18 if detail == 0 else 6 if detail == 1 else 3):
                    t = k / 18
                    q = top - UP * t * 0.28
                    d = norm(rotate(np.array([1.0, 0, 0]), UP, k * 2.4 + s["phase"] * 6) + UP * 0.4 - UP * t * 0.3)
                    L = 0.12 * (1 - t * 0.5) * (1.6 if detail else 1)
                    tri = np.array([q - perp(d) * 0.01, q + perp(d) * 0.01, q + d * L - UP * L * 0.4])
                    m.add(tri, [[0, 1, 2]], np.tile(norm(UP + d), (3, 1)),
                          np.tile(jitter(hexc("#9a8068"), rng, 0.1), (3, 1)), wind(3, 1.0, s["phase"], 0.8))
        lods.append(m)
    pts = []
    for s in stalks[:4]:
        p = s["base"] + UP * s["h"] * 0.55 + s["lean"] * s["h"] * 0.55
        pts.append(attach("stem", p, norm(s["lean"] * 10 + np.array([0.0, 0, 1.0])), UP, (0.003, 0.12), lod=0,
                          spot="pond_surface", note="cling to the stalk"))
    return Asset("plants", "reeds-cattail" if cattail else "reeds-phragmites", "a", lods, None, pts,
                 dict(height=2.0, group="wetland", lod_distances=[8.0, 20.0, 45.0]))


# MARK: - Lily pads and water lily

def lily_pad_geo(radius, sides, rings, notch=0.35, rim=0.15):
    a = np.linspace(notch / 2, 2 * math.pi - notch / 2, sides)
    P = [[0, 0.004, 0]]
    for i in range(1, rings + 1):
        t = i / rings
        for aj in a:
            r = radius * t
            P.append([math.cos(aj) * r, 0.004 + rim * radius * t ** 4 * 0.3, math.sin(aj) * r])
    P = np.array(P)
    F = [[0, 1 + j + 1, 1 + j] for j in range(sides - 1)]
    for i in range(rings - 1):
        for j in range(sides - 1):
            a0 = 1 + i * sides + j
            a1 = a0 + 1
            F += [[a0, a1, a1 + sides], [a0, a1 + sides, a0 + sides]]
    return P, np.array(F)


def petal_ring(centre, axis, n, length, width, phi_open, phi_closed, cup, color, tip_color, segs, rng,
               az0=0.0, curl=0.0, shape="round", width_open=None):
    """n petals around `axis`. phi = angle from the axis (open/closed). Returns (P_open, P_closed, F, C, fl).
    Each petal is a strip of `segs` rows of three vertices (left, mid, right) with a pointed or round tip."""
    axis = norm(axis)
    x0 = perp(axis)
    Po, Pc, F, C, FL = [], [], [], [], []
    for i in range(n):
        az = az0 + 2 * math.pi * i / n + rng.uniform(-0.08, 0.08)
        out = rotate(x0, axis, az)
        side = norm(np.cross(axis, out))
        L = length * rng.uniform(0.92, 1.08)
        base = len(Po)
        for state, Plist in ((phi_open, Po), (phi_closed, Pc)):
            p = centre.copy()
            rows = []
            for k in range(segs + 1):
                t = k / segs
                ang = state + cup * t * (1 if state == phi_open else 0.3) + curl * t
                d = norm(axis * math.cos(ang) + out * math.sin(ang))
                if k > 0:
                    p = p + d * (L / segs)
                if shape == "round":
                    w = width * math.sin(math.pi * min(0.95, 0.2 + 0.8 * t)) * (1.0 if k < segs else 0.0)
                elif shape == "pointed":
                    w = width * math.sin(math.pi * t) ** 0.8
                elif shape == "strap":
                    w = width * (0.6 + 0.4 * math.sin(math.pi * 0.5 * t)) * (1 if k < segs else 0.6)
                else:
                    w = width * (0.5 + 0.5 * t)
                nrm = norm(np.cross(side, d))
                rows.append((p - side * w * 0.5, p + nrm * w * 0.06, p + side * w * 0.5))
            for row in rows:
                Plist.extend(row)
        for k in range(segs):
            a = base + 3 * k
            b = a + 3
            F += [[a, b, a + 1], [a + 1, b, b + 1], [a + 1, b + 1, a + 2], [a + 2, b + 1, b + 2]]
        col = jitter(color, rng, 0.05, 0.01)
        tipc = jitter(tip_color, rng, 0.05, 0.01)
        for k in range(segs + 1):
            t = k / segs
            c = mix(col, tipc, t)
            C += [c * np.array([0.92, 0.92, 0.92, 1]), c, c * np.array([0.92, 0.92, 0.92, 1])]
            FL += [t, t, t]
    return np.array(Po), np.array(Pc), np.array(F), np.array(C), np.array(FL)


def lily_pads(variant, seed):
    rng = np.random.default_rng(seed)
    pads = []
    for i in range(6 if variant == "a" else 9):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.0, 0.7) if i else 0.0
        pads.append(dict(c=np.array([math.cos(a) * r, 0, math.sin(a) * r]), R=rng.uniform(0.12, 0.22),
                         rot=rng.uniform(0, 2 * math.pi), col=jitter(hexc("#3e7a30" if i % 3 else "#4e8a34"), rng, 0.08),
                         phase=rng.uniform()))
    lods = []
    flower = variant == "a"
    fc = np.array([0.15, 0.02, 0.1])
    for detail, (sides, rings, psegs) in enumerate([(16, 3, 3), (9, 1, 1), (6, 1, 1)]):
        m = Mesh()
        for p in pads:
            P, F = lily_pad_geo(p["R"], sides, rings)
            P = P @ np.array([[math.cos(p["rot"]), 0, -math.sin(p["rot"])], [0, 1, 0], [math.sin(p["rot"]), 0, math.cos(p["rot"])]]) + p["c"]
            r = np.linalg.norm(P[:, [0, 2]] - p["c"][[0, 2]], axis=1) / p["R"]
            C = np.tile(p["col"], (len(P), 1))
            C[:, :3] *= (0.85 + 0.25 * r)[:, None]
            C = mix(C, hexc("#8a5a3a"), smoothstep(0.92, 1.0, r) * 0.6)
            m.add(P, F, np.tile(UP, (len(P), 1)), C, wind(len(P), 0.15 * r, p["phase"], 0.2 * r))
        if flower:
            Pos, Pcs, Fs, Cs, Ws = [], [], [], [], []
            off = 0
            for ring, (n, L, Wd, po, pc, col, tip) in enumerate([(10, 0.075, 0.03, 1.25, 0.25, "#f6f2f2", "#f8e8ee"),
                                                                 (8, 0.065, 0.028, 0.85, 0.15, "#fbf6f4", "#f6dde6"),
                                                                 (6, 0.05, 0.022, 0.45, 0.1, "#fff8f0", "#f8f0d8")]):
                if detail == 2 and ring:
                    continue
                if detail == 1 and ring == 2:
                    continue
                Po, Pc, F, C, fl = petal_ring(fc + UP * 0.01 * (1 + ring), UP, n if detail < 2 else 5, L, Wd, po, pc,
                                              -0.25, hexc(col), hexc(tip), psegs, rng, az0=ring * 0.3, shape="pointed")
                Pos.append(Po); Pcs.append(Pc); Fs.append(F + off); Cs.append(C); Ws.append(wind(len(Po), 0.2, 0.1, fl * 0.3))
                off += len(Po)
            Po, Pc = np.concatenate(Pos), np.concatenate(Pcs)
            m.add(Po, np.concatenate(Fs), None, np.concatenate(Cs), np.concatenate(Ws), M=Pc)
            stam = fc + UP * 0.025
            S = np.array([stam + np.array([math.cos(a) * 0.015, 0, math.sin(a) * 0.015]) for a in np.linspace(0, 6.28, 7)][:6] + [stam + UP * 0.01])
            Fsx = [[6, j, (j + 1) % 6] for j in range(6)]
            m.add(S, Fsx, None, np.tile(hexc("#e8c030"), (7, 1)), wind(7, 0.2, 0.1), M=S - UP * 0.005)
        lods.append(m)
    pts = [attach("pad", p["c"] + UP * 0.006 + np.array([math.cos(p["rot"] + math.pi), 0, math.sin(p["rot"] + math.pi)]) * p["R"] * 0.3,
                  UP, [math.cos(p["rot"]), 0, math.sin(p["rot"])], (0.005, p["R"] * 1.6), lod=0, spot="pond_surface")
           for p in pads]
    if flower:
        pts.append(attach("flower_head", fc + UP * 0.03, UP, [1, 0, 0], (0.003, 0.05), lod=0, spot="flowers"))
    meta = dict(height=0.05, group="water", note="floats: y=0 is the water surface", lod_distances=[8.0, 20.0, 45.0],
                view=dict(elev=45))
    if flower:
        meta["morph_targets"] = ["closed"]
    return Asset("plants", "lily-pads", variant, lods, None, pts, meta)


# MARK: - Kelp and seagrass

def kelp(variant, seed):
    """Giant kelp (a) rising from a holdfast with blades and floats along its stipe; bull kelp (b) with
    a single float at the top and streaming blades. the wind weights are the swell sway here."""
    rng = np.random.default_rng(seed)
    giant = variant == "a"
    H = 6.0 if giant else 3.2
    stipes = []
    for i in range(4 if giant else 2):
        a = rng.uniform(0, 2 * math.pi)
        lean = np.array([math.cos(a), 0, math.sin(a)]) * rng.uniform(0.05, 0.2)
        pts = trees.grow_path(rng, np.array([math.cos(a) * 0.05, 0.05, math.sin(a) * 0.05]), norm(UP + lean),
                              H * rng.uniform(0.8, 1.05), 0.25, 0.0, 0.06)
        stipes.append(dict(pts=pts, phase=rng.uniform()))
    lods = []
    for detail, (sides, bladeseg, keep) in enumerate([(4, 4, 1.0), (3, 2, 0.4), (3, 1, 0.15)]):
        m = Mesh()
        # Holdfast: a knot of short roots.
        if detail < 2:
            for k in range(8 if detail == 0 else 4):
                a = 2 * math.pi * k / 8
                pts = np.array([[0, 0.08, 0], [math.cos(a) * 0.1, 0.03, math.sin(a) * 0.1], [math.cos(a) * 0.18, -0.01, math.sin(a) * 0.18]])
                m.add(*tube(pts, [0.018, 0.012, 0.006], 4, color=hexc("#4a3a1e"), wind=np.zeros(4)))
        for s in stipes:
            pts = s["pts"] if detail == 0 else s["pts"][:: 2 + detail]
            P, F, N, C, W = tube(pts, 0.008, sides, color=hexc("#6a5a20"), cap_end=False)
            t = np.clip(P[:, 1] / H, 0, 1)
            m.add(P, F, N, C, wind(len(P), t ** 1.2, s["phase"]))
            limb = trees.Limb(s["pts"], np.full(len(s["pts"]), 0.008), 1, s["phase"], 0, 1)
            nb = int((22 if giant else 10) * keep) + 1
            for j in range(nb):
                t = (j + 0.5) / nb if giant else 0.97
                p, d, r = limb.at(t)
                lean = norm(rotate(perp(d), d, j * 2.4) * 0.8 + d * 0.5) if giant else norm(rotate(perp(d), d, j * 0.63) * 1.0 - UP * 0.3)
                L = (0.9 if giant else 1.6) * rng.uniform(0.8, 1.15)
                if not giant:
                    lean = norm(lean * 1.0 + UP * 0.6)
                bb = blade(p, L, 0.12 if giant else 0.09 * (1 + detail * 0.5), bladeseg + 1, lean, 1.2, hexc("#6a5a1c"),
                           hexc("#a88a2a"), s["phase"], wave=0.04 if detail == 0 else 0, taper=2.5, up_normal=0.2, ao=0.75)
                Pb, Fb, Nb, Cb, Wb = bb
                rel = Pb - p
                Pb = p + rel * np.array([1, 0.35 if giant else 0.25, 1])
                Pb += d * (np.linalg.norm(rel, axis=1) * 0.6)[:, None] if giant else UP * 0
                tt = np.clip(Pb[:, 1] / H, 0, 1)
                Wb[:, 0] = np.clip(tt ** 1.2 + 0.1, 0, 1)
                Wb[:, 1] = s["phase"]
                m.add(Pb, Fb, Nb, Cb, Wb)
                if giant and detail < 2 and j % 1 == 0:
                    S, Fs = uv_sphere(3, 5)
                    S = S * 0.022 + p + lean * 0.02
                    m.add(S, Fs, None, np.tile(hexc("#8a7a2a"), (len(S), 1)), wind(len(S), min(1, t + 0.1), s["phase"]))
            if not giant:
                top, d, r = limb.at(1.0)
                S, Fs = uv_sphere(5 if detail == 0 else 3, 8 if detail == 0 else 5)
                S = S * np.array([0.06, 0.08, 0.06]) + top
                m.add(S, Fs, None, np.tile(hexc("#7a6a24"), (len(S), 1)), wind(len(S), 1.0, s["phase"]))
        lods.append(m)
    pts = []
    for s in stipes:
        limb = trees.Limb(s["pts"], np.full(len(s["pts"]), 0.008), 1, 0, 0, 0)
        for t in (0.3, 0.6, 0.85):
            p, d, r = limb.at(t)
            n = perp(d)
            pts.append(attach("stem", p + n * 0.008, n, d, (0.005, 0.4), lod=0, spot="rocks", note="kelp stipe"))
    pts.append(attach("root", [0.12, 0.03, 0], UP, [1, 0, 0], (0.01, 0.3), lod=0, spot="rocks", note="holdfast"))
    return Asset("plants", "kelp-giant" if giant else "kelp-bull", "a", lods, None, pts,
                 dict(height=H, group="sea", note="COLOR_1.x (wind) is the swell sway (0 at the holdfast, 1 at the top)",
                      lod_distances=[10.0, 25.0, 60.0]))


def seagrass(variant, seed):
    rng = np.random.default_rng(seed)
    blades = []
    R = 0.35 if variant == "a" else 0.6
    for i in range(70 if variant == "a" else 110):
        a = rng.uniform(0, 2 * math.pi)
        r = R * math.sqrt(rng.uniform())
        blades.append(dict(base=np.array([math.cos(a) * r, -0.01, math.sin(a) * r]), h=rng.uniform(0.3, 0.75),
                           w=rng.uniform(0.008, 0.012), lean=norm(np.array([1.0, 0, 0.3]) + rng.normal(0, 0.35, 3)),
                           curve=rng.uniform(0.2, 0.6), phase=rng.uniform(),
                           cb=jitter(hexc("#3e6a2a"), rng, 0.08), ct=jitter(hexc("#8aa84a"), rng, 0.1)))
    lods = []
    for detail, (segs, keep, widen) in enumerate([(5, 1.0, 1.0), (2, 0.35, 1.6), (1, 0.12, 2.8)]):
        m = Mesh()
        for b in blades[: max(4, int(len(blades) * keep))]:
            m.add(*blade(b["base"], b["h"], b["w"] * widen, segs, b["lean"], b["curve"], b["cb"], b["ct"], b["phase"],
                         taper=4.0, wave=0.03 if detail == 0 else 0, ao=0.6))
        lods.append(m)
    pts = [attach("stem", b["base"] + UP * b["h"] * 0.4, norm(b["lean"] + UP * 0.3), UP, (0.003, 0.15), lod=0,
                  spot="rocks", note="seagrass blade") for b in blades[:: len(blades) // 6]]
    return Asset("plants", "seagrass", variant, lods, None, pts,
                 dict(height=0.75, group="sea", note="COLOR_1.x (wind) is the swell sway", lod_distances=[6.0, 15.0, 35.0],
                      view=dict(elev=25)))


# MARK: - Mushrooms, fungi

def lathe(profile, sides, color_fn=None):
    """Revolve [(r, y), ...] about +Y. Returns P, F (rings of `sides`, no caps)."""
    profile = np.asarray(profile, float)
    a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    P = np.concatenate([np.stack([np.cos(a) * r, np.full(sides, y), np.sin(a) * r], 1) for r, y in profile])
    F = []
    for i in range(len(profile) - 1):
        for j in range(sides):
            a0 = i * sides + j
            a1 = i * sides + (j + 1) % sides
            F += [[a0, a1 + sides, a1], [a0, a0 + sides, a1 + sides]]
    return P, np.array(F)


MUSHROOMS = {
    "mushroom-fly-agaric": dict(cap=(0.07, 0.045), stem=(0.012, 0.11), cap_color="#c42a1a", gill="#f2ecd8",
                                stem_color="#f0ead8", spots="#f6f2e8", ring=True, n=(1, 3), shape="dome"),
    "mushroom-porcini": dict(cap=(0.07, 0.04), stem=(0.025, 0.08), cap_color="#7a4a26", gill="#c8b060",
                             stem_color="#e0d4b0", n=(1, 3), shape="bun", stem_bulge=1.5),
    "mushroom-chanterelle": dict(cap=(0.035, 0.012), stem=(0.01, 0.045), cap_color="#e8a030", gill="#e8a838",
                                 stem_color="#e8a838", n=(4, 7), shape="funnel"),
    "mushroom-inkcap": dict(cap=(0.025, 0.07), stem=(0.007, 0.1), cap_color="#e8e2d8", gill="#4a4440",
                            stem_color="#f0ece4", n=(4, 7), shape="bell", cap_tip="#9a8a7a"),
    "mushroom-mycena": dict(cap=(0.012, 0.012), stem=(0.002, 0.06), cap_color="#9a7a5a", gill="#d8ccb8",
                            stem_color="#c8b49a", n=(9, 14), shape="cone"),
    "puffball": dict(cap=(0.04, 0.05), stem=(0.0, 0.0), cap_color="#ece6d8", gill="#ece6d8", stem_color="#ece6d8",
                     n=(2, 4), shape="ball"),
}


def cap_profile(shape, R, H, rings):
    t = np.linspace(0, 1, rings + 1)
    if shape == "dome":
        r = R * np.sin(t * math.pi / 2)
        y = H * np.cos(t * math.pi / 2)
    elif shape == "bun":
        r = R * np.sin(t * math.pi / 2) ** 0.7
        y = H * np.cos(t * math.pi / 2) ** 0.6
    elif shape == "funnel":
        r = R * t
        y = H * (t ** 2) * 1.2 - H * 0.2 * np.sin(t * math.pi)
    elif shape == "bell":
        r = R * np.sin(t * math.pi * 0.5) ** 0.6
        y = H * (1 - t ** 1.5)
    elif shape == "cone":
        r = R * t ** 0.8
        y = H * (1 - t)
    else:  # ball
        r = R * np.sin(t * math.pi * 0.85)
        y = H * (np.cos(t * math.pi * 0.85) + 1) * 0.5
    return list(zip(r, y))


def mushroom_one(S, base, scale, tilt, rng, detail, m, phase):
    sides = [14, 8, 5][detail]
    rings = [6, 3, 2][detail]
    R, Hc = S["cap"][0] * scale, S["cap"][1] * scale
    sr, sh = S["stem"][0] * scale, S["stem"][1] * scale
    up = norm(UP + tilt)
    rot = np.eye(3)
    x = perp(up)
    z = np.cross(x, up)
    rot = np.stack([x, up, z], 1)
    top = base + up * sh
    if sh > 0:
        bulge = S.get("stem_bulge", 1.0)
        prof = [(sr * bulge * 1.2, 0), (sr * bulge, sh * 0.25), (sr, sh * 0.7), (sr * 0.9, sh)]
        P, F = lathe(prof, max(4, sides // 2))
        P = P @ rot.T + base
        C = np.tile(hexc(S["stem_color"]), (len(P), 1))
        C[:, :3] *= (0.75 + 0.25 * np.clip(np.repeat(np.linspace(0, 1, len(prof)), max(4, sides // 2)), 0, 1))[:, None]
        m.add(P, F, None, C, wind(len(P), 0.0))
        if S.get("ring") and detail == 0:
            P, F = lathe([(sr * 1.05, sh * 0.72), (sr * 2.0, sh * 0.62)], sides)
            m.add(P @ rot.T + base, F, None, np.tile(hexc("#f4f0e4"), (len(P), 1)), wind(len(P), 0.0))
    prof = cap_profile(S["shape"], R, Hc, rings)
    if S["shape"] in ("dome", "bun", "bell", "cone"):
        # Underside: from the rim back in to the stem (gills).
        prof = prof + [(R * 0.92, prof[-1][1] - Hc * 0.08), (sr * 1.1 if sr else R * 0.1, -Hc * 0.05 if S["shape"] != "bell" else Hc * 0.2)]
    elif S["shape"] == "funnel":
        prof = [(sr, -Hc * 0.6)] + prof[1:] + [(R * 1.02, prof[-1][1] - Hc * 0.15)]
    P, F = lathe(prof, sides)
    n_ring = len(prof)
    k = np.repeat(np.arange(n_ring), sides)
    jag = 1 + 0.06 * np.sin(np.tile(np.linspace(0, 2 * math.pi, sides, endpoint=False), n_ring) * 3 + phase * 6)
    P[:, [0, 2]] *= jag[:, None]
    yoff = 0 if S["shape"] != "ball" else 0
    P = P @ rot.T + top + up * yoff
    cap_rings = rings + 1
    C = np.tile(hexc(S["cap_color"]), (len(P), 1))
    if S.get("cap_tip"):
        C[k < 2] = hexc(S["cap_tip"])
    C[k >= cap_rings] = hexc(S["gill"])
    t = np.clip(k / max(cap_rings - 1, 1), 0, 1)
    C[:, :3] *= np.where(k >= cap_rings, 0.75, 0.85 + 0.2 * (1 - t))[:, None]
    m.add(P, F, None, np.clip(C, 0, 1), wind(len(P), 0.0))
    spots = []
    if S.get("spots") and detail < 2:
        for j in range(14 if detail == 0 else 6):
            th = rng.uniform(0.15, 0.85) * math.pi / 2
            ph = rng.uniform(0, 2 * math.pi)
            dvec = np.array([math.sin(th) * math.cos(ph) * R, math.cos(th) * Hc, math.sin(th) * math.sin(ph) * R])
            c = dvec @ rot.T + top
            n = norm(np.array([dvec[0] / R ** 2, dvec[1] / Hc ** 2, dvec[2] / R ** 2]) @ rot.T)
            s = R * rng.uniform(0.08, 0.14)
            xx = perp(n)
            zz = np.cross(xx, n)
            ring = [c + n * s * 0.25] + [c + (xx * math.cos(a) + zz * math.sin(a)) * s for a in np.linspace(0, 6.28, 6, endpoint=False)]
            Fs = [[0, 1 + (q + 1) % 6, 1 + q] for q in range(6)]
            m.add(np.array(ring), Fs, None, np.tile(hexc(S["spots"]), (7, 1)), wind(7, 0.0))
    return top + up * prof[0][1], R


def mushrooms(kind, variant, seed):
    S = MUSHROOMS[kind]
    rng = np.random.default_rng(seed)
    n = int(rng.integers(S["n"][0], S["n"][1] + 1)) + (2 if variant == "b" else 0)
    items = []
    for i in range(n):
        a = rng.uniform(0, 2 * math.pi)
        r = (0 if i == 0 else rng.uniform(0.3, 1.0)) * S["cap"][0] * (2.5 if S["n"][1] > 3 else 3.5)
        items.append(dict(base=np.array([math.cos(a) * r, 0, math.sin(a) * r]), scale=rng.uniform(0.55, 1.1) if i else 1.0,
                          tilt=np.array([math.cos(a), 0, math.sin(a)]) * rng.uniform(0, 0.25), phase=rng.uniform()))
    lods = []
    pts = []
    for detail in range(3):
        m = Mesh()
        r2 = np.random.default_rng(seed + 5)
        for j, it in enumerate(items):
            if detail == 2 and j > 2:
                continue
            topc, R = mushroom_one(S, it["base"], it["scale"], it["tilt"], r2, detail, m, it["phase"])
            if detail == 0 and j < 3:
                pts.append(attach("flower_head" if False else "rock_face" if False else "fungus_cap", topc, UP,
                                  [1, 0, 0], (0.002, R * 1.6), lod=0, spot="leaf_litter"))
        lods.append(m)
    pts.append(attach("leaf_litter", [S["cap"][0] * 2.5, 0.005, 0], UP, [1, 0, 0], (0.002, 0.1), lod=0,
                      spot="leaf_litter"))
    lo, hi = lods[0].bounds()
    return Asset("plants", kind, variant, lods, None, pts,
                 dict(height=round(float(hi[1]), 3), group="fungi", lod_distances=[3.0, 8.0, 18.0],
                      view=dict(elev=22)), double_sided=False)


def brackets(variant, seed):
    """Bracket fungus shelves for a vertical surface: origin on the surface, +Z out of it, +Y up."""
    rng = np.random.default_rng(seed)
    shelves = []
    for i in range(5 if variant == "a" else 8):
        shelves.append(dict(y=rng.uniform(0, 0.35), x=rng.uniform(-0.15, 0.15), w=rng.uniform(0.06, 0.13),
                            col=jitter(hexc(["#b88a4a", "#a87a40", "#c8a060"][i % 3] if variant == "a" else
                                            ["#e8d8b8", "#d8c098", "#c89a5a"][i % 3]), rng, 0.06)))
    lods = []
    for detail, sides in enumerate([11, 6, 4]):
        m = Mesh()
        for s in shelves:
            ang = np.linspace(-math.pi / 2, math.pi / 2, sides)
            c = np.array([s["x"], s["y"], 0.0])
            bands = [(1.0, 0.012, 1.0), (0.66, 0.02, 0.85), (0.33, 0.026, 0.7)]
            P = [c + np.array([0, 0.03, 0])]
            C = [s["col"] * np.array([0.6, 0.55, 0.5, 1])]
            for sc, yy, k in reversed(bands):
                for a in ang:
                    P.append(c + np.array([math.sin(a) * s["w"] * sc, yy, math.cos(a) * s["w"] * sc * 0.8]))
                    C.append(s["col"] * np.array([k, k, k, 1]))
            for a in ang:
                P.append(c + np.array([math.sin(a) * s["w"] * 1.02, -0.004, math.cos(a) * s["w"] * 0.82]))
                C.append(hexc("#efe6d2"))
            P = np.array(P)
            F = [[0, 1 + j, 2 + j] for j in range(sides - 1)]
            for b in range(3):
                for j in range(sides - 1):
                    a0 = 1 + b * sides + j
                    F += [[a0, a0 + sides, a0 + 1], [a0 + 1, a0 + sides, a0 + sides + 1]]
            under = len(P)
            P = np.concatenate([P, [c + np.array([0, -0.004, 0.0])]])
            C.append(hexc("#e2d6bc"))
            for j in range(sides - 1):
                a0 = 1 + 3 * sides + j
                F.append([under, a0 + 1, a0])
            m.add(P, F, None, np.array(C), wind(len(P), 0.0))
        lods.append(m)
    pts = [attach("fungus_shelf", [s["x"], s["y"] + 0.03, s["w"] * 0.5], UP, [0, 0, 1], (0.002, s["w"]), lod=0,
                  spot="bark") for s in shelves]
    return Asset("plants", "fungus-bracket", variant, lods, None, pts,
                 dict(height=0.4, group="fungi", note="mount on a trunk or log: origin on the bark, +Z out of it",
                      lod_distances=[3.0, 8.0, 18.0], view=dict(elev=10, az=60)), double_sided=False)


# MARK: - Moss mats and roots

def mound(R, H, rings, sides, seed, rough=0.25):
    P = [[0, H, 0]]
    for i in range(1, rings + 1):
        t = i / rings
        for j in range(sides):
            a = 2 * math.pi * j / sides
            jag = 1 + rough * fbm(np.array([[math.cos(a) * 1.7 + seed, math.sin(a) * 1.7, t]]), 2)[0] * 2
            r = R * t * jag
            P.append([math.cos(a) * r, H * (1 - t ** 2.2) ** 0.8, math.sin(a) * r])
    P = np.array(P)
    P[:, 1] += fbm(P * np.array([14, 0, 14]) + seed, 3) * H * 0.35 * (P[:, 1] > 0.001)
    F = [[0, 1 + (j + 1) % sides, 1 + j] for j in range(sides)]
    for i in range(rings - 1):
        for j in range(sides):
            a0 = 1 + i * sides + j
            a1 = 1 + i * sides + (j + 1) % sides
            F += [[a0, a1, a1 + sides], [a0, a1 + sides, a0 + sides]]
    return P, np.array(F)


def moss(variant, seed):
    rng = np.random.default_rng(seed)
    blobs = [(np.zeros(3), 0.35, 0.06)]
    for i in range(3 if variant == "a" else 5):
        a = rng.uniform(0, 2 * math.pi)
        blobs.append((np.array([math.cos(a), 0, math.sin(a)]) * rng.uniform(0.2, 0.4), rng.uniform(0.12, 0.22),
                      rng.uniform(0.03, 0.06)))
    lods = []
    for detail, (rings, sides) in enumerate([(6, 20), (3, 10), (2, 6)]):
        m = Mesh()
        for k, (c, R, H) in enumerate(blobs):
            P, F = mound(R, H, rings, sides, seed + k)
            P += c
            n = fbm(P * 12 + seed, 3)
            C = mix(hexc("#3e6a1e"), hexc("#7aa034"), np.clip(0.5 + n * 1.5, 0, 1))
            C = mix(C, hexc("#a8b040"), smoothstep(0.3, 0.6, n) * 0.5)
            r = np.linalg.norm(P[:, [0, 2]] - c[[0, 2]], axis=1) / R
            C[:, :3] *= (0.7 + 0.3 * (1 - r ** 2))[:, None]
            m.add(P, F, None, C, np.zeros((len(P), 4)))
        if variant == "b" and detail < 2:
            for j in range(40 if detail == 0 else 12):
                a, r = rng.uniform(0, 2 * math.pi), 0.3 * math.sqrt(rng.uniform())
                b = np.array([math.cos(a) * r, 0.05 * (1 - (r / 0.35) ** 2), math.sin(a) * r])
                h = rng.uniform(0.02, 0.04)
                tri = np.array([b - np.array([0.0015, 0, 0]), b + np.array([0.0015, 0, 0]), b + UP * h])
                m.add(tri, [[0, 1, 2]], np.tile(UP, (3, 1)), np.tile(hexc("#8a5a2a"), (3, 1)), wind(3, 0.3, rng.uniform()))
                cap = np.array([b + UP * h + np.array([-0.003, 0, 0]), b + UP * h + np.array([0.003, 0, 0]),
                                b + UP * (h + 0.007)])
                m.add(cap, [[0, 1, 2]], np.tile(UP, (3, 1)), np.tile(hexc("#c8642a"), (3, 1)), wind(3, 0.35, rng.uniform()))
        lods.append(m)
    pts = [attach("moss", c + UP * H * 0.9, UP, [1, 0, 0], (0.001, R * 0.8), lod=0, spot="leaf_litter")
           for c, R, H in blobs]
    return Asset("plants", "moss-mat", variant, lods, None, pts,
                 dict(height=0.07, group="ground", lod_distances=[5.0, 12.0, 30.0], view=dict(elev=35)),
                 double_sided=False)


def roots(variant, seed):
    """Exposed roots: gnarly roots arching out of the ground from a stump base, dipping in and out."""
    rng = np.random.default_rng(seed)
    rs = []
    n = 6 if variant == "a" else 4
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-0.3, 0.3)
        out = np.array([math.cos(a), 0, math.sin(a)])
        L = rng.uniform(0.9, 1.6)
        t = np.linspace(0, 1, 12)
        side = np.cross(out, UP)
        wig = fbm(np.stack([t * 3, np.full(12, i), np.zeros(12)], 1), 2) * 0.25
        hump = 0.12 * np.sin(t * math.pi * (2 if variant == "b" else 1.4)) * (1 - t) + 0.25 * (1 - t) ** 3
        pts = out[None] * (t * L)[:, None] + side[None] * wig[:, None] + UP * (hump - 0.04)[:, None]
        rs.append(dict(pts=pts, r=np.linspace(0.09, 0.02, 12) * rng.uniform(0.8, 1.2)))
    lods = []
    bark = dict(bark=dict(color=hexc("#6a5644"), dark=hexc("#3a2e24"), fx=6, fy=2, contrast=1.0,
                          moss=dict(color=hexc("#5a7a2e"), lo=0.55, hi=1.0)))
    fn = trees.bark_color_fn(bark, 1.0)
    for detail, (sides, step) in enumerate([(7, 1), (5, 2), (4, 4)]):
        m = Mesh()
        stump = np.array([[0, -0.05, 0], [0, 0.2, 0], [0, 0.35, 0]])
        P, F, N, C, W = tube(stump, [0.22, 0.18, 0.16], sides + 3, color_fn=fn, cap_end=False)
        m.add(P, F, N, C, np.zeros((len(P), 4)))
        top = np.array([0, 0.35, 0])
        D = sides + 3
        a = np.linspace(0, 2 * math.pi, D, endpoint=False)
        ring = top + np.stack([np.cos(a) * 0.16, np.zeros(D), np.sin(a) * 0.16], 1)
        Pt = np.concatenate([[top + UP * 0.01], ring])
        rr = np.concatenate([[0], np.ones(D)])
        Ct = mix(hexc("#a88a60"), hexc("#6a5038"), rr)
        m.add(Pt, [[0, 1 + (j + 1) % D, 1 + j] for j in range(D)], np.tile(UP, (len(Pt), 1)), Ct, np.zeros((len(Pt), 4)))
        for r in rs:
            idx = list(range(0, 12, step))
            if idx[-1] != 11:
                idx.append(11)
            P, F, N, C, W = tube(r["pts"][idx], r["r"][idx], sides, color_fn=fn)
            m.add(P, F, N, C, np.zeros((len(P), 4)))
        lods.append(m)
    pts = []
    for r in rs:
        limb = trees.Limb(r["pts"], r["r"], 1, 0, 0, 0)
        p, d, rr = limb.at(0.25)
        n = norm(UP - d * (UP @ d))
        pts.append(attach("root", p + n * rr, n, d, (0.005, 0.4), lod=0, spot="bark"))
    # Between two roots, under the hump: a burrow mouth.
    p0 = (rs[0]["pts"][3] + rs[1]["pts"][3]) / 2
    out = norm(np.array([p0[0], 0, p0[2]]))
    pts.append(attach("burrow_entrance", [p0[0] * 0.7, 0.04, p0[2] * 0.7], out, -out, (0.02, 0.3), lod=0,
                      spot="leaf_litter", note="between the roots, facing out"))
    pts.append(attach("log_top", [0, 0.36, 0], UP, [1, 0, 0], (0.005, 0.35), lod=0, spot="bark", note="stump top"))
    return Asset("plants", "roots", variant, lods, None, pts,
                 dict(height=0.36, group="ground", lod_distances=[6.0, 15.0, 35.0], view=dict(elev=30)),
                 double_sided=False)


# MARK: - Wildflowers

# Flower heads are drawn ~1.5x life size so they read from the play camera (stylised, not botanical).
HEAD_SCALE = 1.5

FLOWERS = {
    # head: list of petal rings (n, length, width, phi_open, phi_closed, cup, color, tip, shape)
    "daisy": dict(h=(0.3, 0.45), head=[(22, 0.024, 0.006, 1.62, 0.25, -0.05, "#f8f6f0", "#ffffff", "strap")],
                  disc=(0.009, "#e8b820", 0.006), leaf=(0.06, 0.012), leaves=4, stem="#5a8a34"),
    "poppy": dict(h=(0.35, 0.55), head=[(4, 0.035, 0.05, 1.3, 0.12, -0.75, "#d8241a", "#e8382a", "round")],
                  disc=(0.008, "#2a2a1a", 0.012), eye="#1a1010", leaf=(0.07, 0.025), leaves=3, stem="#6a9a3a",
                  nod=0.3),
    "buttercup": dict(h=(0.2, 0.35), head=[(5, 0.013, 0.014, 1.25, 0.2, -0.55, "#f2c818", "#ffd820", "round")],
                      disc=(0.004, "#c8a010", 0.004), leaf=(0.035, 0.03), leaves=3, stem="#5a8a30", branches=2),
    "cornflower": dict(h=(0.3, 0.5), head=[(9, 0.02, 0.012, 1.2, 0.3, 0.2, "#3a5ad8", "#5a7aee", "flare"),
                                           (5, 0.01, 0.006, 0.6, 0.1, 0.1, "#3a2a8a", "#5a3aaa", "flare")],
                       disc=(0.006, "#3a2a6a", 0.006), leaf=(0.07, 0.006), leaves=5, stem="#6a8a5a", calyx=True),
    "wild-rose": dict(h=(0.3, 0.45), head=[(5, 0.03, 0.032, 1.4, 0.2, -0.25, "#f2a0b8", "#f8d0dc", "round")],
                      disc=(0.008, "#e8c040", 0.005), leaf=(0.05, 0.022), leaves=6, stem="#4a6a2a"),
    "coneflower": dict(h=(0.45, 0.65), head=[(14, 0.04, 0.01, 2.1, 0.35, -0.2, "#d86a9a", "#e88ab0", "strap")],
                       disc=(0.014, "#a8541a", 0.02), leaf=(0.09, 0.02), leaves=4, stem="#4a7a2e", cone=True),
    "black-eyed-susan": dict(h=(0.35, 0.55), head=[(13, 0.03, 0.01, 1.75, 0.3, -0.1, "#f2b010", "#f8c830", "strap")],
                             disc=(0.011, "#3a2210", 0.012), leaf=(0.08, 0.02), leaves=4, stem="#4a7a2e", cone=True),
    "cosmos": dict(h=(0.5, 0.75), head=[(8, 0.032, 0.016, 1.5, 0.25, 0.0, "#e870b0", "#f0a0cc", "flare")],
                   disc=(0.007, "#e8b820", 0.006), leaf=(0.06, 0.004), leaves=6, stem="#5a9a3a"),
    "bluebell": dict(h=(0.25, 0.4), bells=(7, 0.018, 0.011, "#4a54c8", "#6a74e0"), leaf=(0.2, 0.012), leaves=4,
                     basal=True, stem="#4a7a3a", arch=0.5),
    "foxglove": dict(h=(0.8, 1.2), bells=(16, 0.04, 0.016, "#b04aa0", "#d07ac0"), leaf=(0.16, 0.05), leaves=6,
                     basal=True, stem="#4a7a3a", spike=True, spots="#5a1a4a"),
    "lupine": dict(h=(0.5, 0.8), pea=(56, 0.02, "#6a4ad0", "#f0f0ff"), leaf=(0.06, 0.008), leaves=6, palmate=True,
                   stem="#4a7a3a"),
    "iris": dict(h=(0.5, 0.75), iris=("#5a3ab0", "#7a5ad8", "#f0c020"), leaf=(0.45, 0.02), leaves=5, basal=True,
                 stem="#4a7a3a", sword=True),
}


def stem_path(rng, h, nod=0.0, arch=0.0):
    lean = rotate(np.array([1.0, 0, 0]), UP, rng.uniform(0, 2 * math.pi)) * rng.uniform(0.02, 0.12)
    pts = trees.grow_path(rng, np.zeros(3), norm(UP + lean), h, h / 6, -arch * 2.5, 0.04)
    if nod:
        pts[-1] = pts[-2] + norm(pts[-1] - pts[-2] - UP * nod * np.linalg.norm(pts[-1] - pts[-2]) * 2) * np.linalg.norm(pts[-1] - pts[-2])
    return pts


def flower_head(m, S, centre, axis, rng, detail, phase, sway):
    """Petal rings + disc, open with a 'closed' morph."""
    segs = [3, 1, 1][detail]
    Pos, Pcs, Fs, Cs, Ws = [], [], [], [], []
    off = 0
    for ring, (n, L, Wd, po, pc, cup, col, tip, shape) in enumerate(S["head"]):
        if detail == 2 and ring:
            continue
        nn = n if detail == 0 else max(4, n // 2) if detail == 1 else max(4, n // 3)
        widen = 1.0 if detail == 0 else (n / nn) ** 0.5
        hs = S.get("hs", HEAD_SCALE)
        L, Wd = L * hs, Wd * hs
        Po, Pc, F, C, fl = petal_ring(centre + axis * 0.002 * ring, axis, nn, L, Wd * widen, po, pc, cup, hexc(col),
                                      hexc(tip), segs, rng, az0=ring * 0.4, shape=shape)
        if S.get("eye"):
            C[fl < 0.2] = mix(C[fl < 0.2], hexc(S["eye"]), 0.85)
        Pos.append(Po); Pcs.append(Pc); Fs.append(F + off); Cs.append(C)
        Ws.append(wind(len(Po), sway, phase, fl * 0.5, rng.uniform()))
        off += len(Po)
    r, dc, dh = S["disc"]
    r, dh = r * S.get("hs", HEAD_SCALE), dh * S.get("hs", HEAD_SCALE)
    x = perp(axis)
    z = np.cross(axis, x)
    sides = [10, 6, 4][detail]
    if S.get("cone"):
        prof = [(r * 1.1, 0), (r, dh * 0.5), (r * 0.6, dh * 0.9), (0.0, dh)]
    else:
        prof = [(r, 0), (r * 0.8, dh * 0.7), (0.0, dh)]
    Pd, Fd = lathe(prof, sides)
    Pd = centre + Pd[:, 0:1] * x + Pd[:, 1:2] * axis + Pd[:, 2:3] * z
    Cd = np.tile(hexc(dc), (len(Pd), 1))
    Cd[:, :3] *= np.linspace(0.75, 1.1, len(prof)).repeat(sides)[:, None]
    Fd = np.asarray(Fd)[:, [0, 2, 1]]
    Pos.append(Pd); Pcs.append(Pd - axis * dh * 0.2); Fs.append(Fd + off); Cs.append(Cd)
    Ws.append(wind(len(Pd), sway, phase))
    Po = np.concatenate(Pos)
    m.add(Po, np.concatenate(Fs), None, np.concatenate(Cs), np.concatenate(Ws), M=np.concatenate(Pcs))
    if S.get("calyx") and detail < 2:
        Pc_, Fc_ = lathe([(0.001, -0.014), (0.008, -0.006), (r * 1.1, 0.0)], 6)
        Pc_ = centre + Pc_[:, 0:1] * x + Pc_[:, 1:2] * axis + Pc_[:, 2:3] * z
        m.add(Pc_, Fc_, None, np.tile(hexc("#5a7a4a"), (len(Pc_), 1)), wind(len(Pc_), sway, phase), M=Pc_)


def bells(m, S, stem_pts, rng, detail, phase, spike=False, spots=None):
    n, L, R, col, tip = S["bells"]
    L, R = L * 1.35, R * 1.35
    limb = trees.Limb(stem_pts, np.full(len(stem_pts), 0.003), 1, phase, 0, 1)
    side_dir = rotate(np.array([1.0, 0, 0]), UP, rng.uniform(0, 6.28))
    nn = n if detail == 0 else max(3, n // 2) if detail == 1 else max(2, n // 4)
    sides = [8, 5, 4][detail]
    Pos, Pcs, Fs, Cs = [], [], [], []
    off = 0
    for i in range(nn):
        t = 0.55 + 0.42 * i / max(nn - 1, 1) if not spike else 0.35 + 0.6 * i / max(nn - 1, 1)
        p, d, r = limb.at(t)
        out = norm(side_dir if not spike else rotate(side_dir, UP, i * 0.5))
        size = (1 - 0.45 * i / nn) if spike else (1 - 0.3 * i / nn)
        hang = norm(out * 0.35 - UP * 1.0 + d * 0.1)
        att = p + out * 0.012
        x = perp(hang)
        z = np.cross(hang, x)
        prof_o = [(R * 0.35, 0), (R * 0.75, L * 0.35), (R * 0.8, L * 0.8), (R * 1.25, L), (R * 1.45, L * 0.94)]
        prof_c = [(R * 0.35, 0), (R * 0.55, L * 0.35), (R * 0.5, L * 0.8), (R * 0.32, L), (R * 0.25, L * 1.02)]
        if detail == 2:
            prof_o, prof_c = prof_o[::2], prof_c[::2]
        Po, F = lathe([(a * size, b * size) for a, b in prof_o], sides)
        Pc, _ = lathe([(a * size, b * size) for a, b in prof_c], sides)
        conv = lambda P: att + P[:, 0:1] * x + P[:, 1:2] * hang + P[:, 2:3] * z
        Po, Pc = conv(Po), conv(Pc)
        k = np.repeat(np.arange(len(prof_o)), sides)
        C = mix(hexc(col), hexc(tip), k / (len(prof_o) - 1))
        if spots and detail == 0:
            spot = (k >= 2) & (np.tile(np.arange(sides), len(prof_o)) % 3 == 0)
            C[spot] = hexc(spots)
        Pos.append(Po); Pcs.append(Pc); Fs.append(F + off); Cs.append(C)
        off += len(Po)
        if detail < 2:
            ped = np.array([p, p + out * 0.008 + UP * 0.002, att])
            Pp, Fp, Np, Cp, Wp = tube(ped, 0.0012, 3, color=hexc(S["stem"]), cap_end=False)
            m.add(Pp, Fp, Np, Cp, wind(len(Pp), 0.9, phase), M=Pp)
    Po = np.concatenate(Pos)
    m.add(Po, np.concatenate(Fs), None, np.concatenate(Cs), wind(len(Po), 0.95, phase, 0.4), M=np.concatenate(Pcs))


def pea_spike(m, S, stem_pts, rng, detail, phase):
    n, size, col, tip = S["pea"]
    limb = trees.Limb(stem_pts, np.full(len(stem_pts), 0.003), 1, phase, 0, 1)
    nn = n if detail == 0 else n // 3 if detail == 1 else n // 8
    grow = 1.0 if detail == 0 else (n / nn) ** 0.45
    Pos, Pcs, Fs, Cs = [], [], [], []
    off = 0
    for i in range(nn):
        t = 0.5 + 0.48 * i / nn
        p, d, r = limb.at(t)
        out = rotate(perp(d), d, i * 2.4)
        s = size * (1.1 - 0.6 * i / nn) * grow
        c = p + out * 0.008
        top = 1 - i / nn
        colr = mix(hexc(col), hexc(tip), 0.0)
        if i > nn * 0.8:
            colr = mix(hexc(col), hexc("#8a7ae0"), 0.5)
        # Banner petal (upright, wide) + keel (two small) — closed: folded to the stem.
        b0 = c
        q_open = [b0 - perp(out) * s * 0.6 + UP * s * 0.2, b0 + perp(out) * s * 0.6 + UP * s * 0.2,
                  b0 + UP * s * 1.1 + out * s * 0.2, b0 + out * s * 0.9 - UP * s * 0.2]
        q_closed = [b0 - perp(out) * s * 0.25 + UP * s * 0.2, b0 + perp(out) * s * 0.25 + UP * s * 0.2,
                    b0 + UP * s * 0.8, b0 + out * s * 0.4 + UP * s * 0.3]
        Po = np.array([b0] + q_open)
        Pc = np.array([b0] + q_closed)
        F = [[0, 1, 3], [0, 3, 2], [0, 2, 4], [0, 4, 1]]
        C = np.array([colr * np.array([0.7, 0.7, 0.7, 1]), colr, colr, mix(colr, hexc(tip), 0.6 * top), colr])
        Pos.append(Po); Pcs.append(Pc); Fs.append(np.array(F) + off); Cs.append(C)
        off += 5
    Po = np.concatenate(Pos)
    m.add(Po, np.concatenate(Fs), None, np.concatenate(Cs), wind(len(Po), 0.95, phase, 0.3), M=np.concatenate(Pcs))


def iris_head(m, S, centre, rng, detail, phase):
    fall, std, beard = S["iris"]
    segs = [3, 1, 1][detail]
    Po1, Pc1, F1, C1, fl1 = petal_ring(centre, UP, 3, 0.075, 0.045, 1.9, 0.35, 0.6, hexc(fall), hexc(fall), segs, rng,
                                       shape="round")
    if detail == 0:
        C1[(fl1 > 0.1) & (fl1 < 0.6)] = mix(C1[(fl1 > 0.1) & (fl1 < 0.6)], hexc(beard), 0.6)
    Po2, Pc2, F2, C2, fl2 = petal_ring(centre + UP * 0.005, UP, 3, 0.07, 0.038, 0.35, 0.1, -0.4, hexc(std), hexc(std),
                                       segs, rng, az0=math.pi / 3, shape="round")
    Po = np.concatenate([Po1, Po2])
    Pc = np.concatenate([Pc1, Pc2])
    F = np.concatenate([F1, F2 + len(Po1)])
    C = np.concatenate([C1, C2])
    m.add(Po, F, None, C, wind(len(Po), 0.95, phase, np.concatenate([fl1, fl2]) * 0.4), M=Pc)


def flower_plant(kind, variant, seed):
    S = FLOWERS[kind]
    rng = np.random.default_rng(seed)
    nstems = 1 if variant == "a" else int(rng.integers(3, 6))
    stems = []
    for i in range(nstems):
        a = rng.uniform(0, 2 * math.pi)
        r = 0 if i == 0 else rng.uniform(0.04, 0.12)
        base = np.array([math.cos(a) * r, 0, math.sin(a) * r])
        h = rng.uniform(*S["h"])
        pts = stem_path(rng, h, S.get("nod", 0) * rng.uniform(0.5, 1.2), S.get("arch", 0))
        stems.append(dict(base=base, pts=pts + base, h=h, phase=rng.uniform(), sub=rng.integers(0, 1 << 30)))
    lods = []
    pts = []
    for detail in range(3):
        m = Mesh()
        for si, st in enumerate(stems):
            r2 = np.random.default_rng(int(st["sub"]))
            sp = st["pts"] if detail == 0 else st["pts"][::2] if len(st["pts"]) > 3 else st["pts"]
            if detail == 2:
                sp = st["pts"][[0, len(st["pts"]) // 2, -1]]
            t = np.linspace(0, 1, len(sp))
            P, F, N, C, W = tube(sp, np.linspace(0.0028, 0.0018, len(sp)) * (1.6 if kind == "foxglove" else 1.0),
                                 [4, 3, 3][detail], color=hexc(S["stem"]), cap_end=False)
            ring_t = np.repeat(t, [4, 3, 3][detail])
            Wv = wind(len(P), np.clip(ring_t ** 1.5 * 0.95, 0, 1), st["phase"])
            m.add(P, F, N, C, Wv, M=P)
            top = st["pts"][-1]
            axis = norm(st["pts"][-1] - st["pts"][-2])
            # Leaves: along the stem, or a basal rosette.
            nl = S["leaves"] if detail == 0 else max(2, S["leaves"] // 2)
            if detail < 2 or si == 0:
                for j in range(nl):
                    if S.get("basal"):
                        a = 2 * math.pi * j / nl + r2.uniform(-0.3, 0.3)
                        fwd = norm(np.array([math.cos(a), 1.6 if S.get("sword") else 0.5, math.sin(a)]))
                        p0 = st["base"] + UP * 0.005
                    else:
                        tt = 0.12 + 0.6 * j / nl
                        limb = trees.Limb(st["pts"], np.full(len(st["pts"]), 0.003), 1, 0, 0, 0)
                        p0, d, _ = limb.at(tt)
                        a = j * 2.4 + r2.uniform(-0.3, 0.3)
                        fwd = norm(np.array([math.cos(a), 0.7, math.sin(a)]))
                    Ll, Lw = S["leaf"]
                    sc = 1.0 if detail == 0 else 1.3
                    if S.get("palmate") and detail == 0:
                        for q in range(5):
                            f2 = norm(rotate(fwd, UP, (q - 2) * 0.35) + UP * 0.1)
                            Pl, Fl, fl = leaf_blade(Ll, Lw, 0.3, 0.1, 0.5, 0)
                            Pw, x, y, z = place_frame(Pl, p0, f2, UP)
                            m.add(Pw, Fl, np.tile(norm(y + UP), (len(Pw), 1)), np.tile(jitter(hexc("#4e7e36"), r2, 0.06), (len(Pw), 1)),
                                  wind(len(Pw), 0.5, st["phase"], fl), M=Pw)
                        continue
                    Pl, Fl, fl = leaf_blade(Ll * sc, Lw * sc, 0.35, 0.25 if S.get("basal") else 0.12, 0.45,
                                            1 if detail == 0 and Ll > 0.1 else 0)
                    Pw, x, y, z = place_frame(Pl, p0, fwd, UP)
                    lc = jitter(hexc("#4a7a30" if not S.get("basal") else "#3e6e2c"), r2, 0.07)
                    Cl = mix(np.tile(lc, (len(Pw), 1)), np.tile(lc * np.array([1.2, 1.15, 0.9, 1]), (len(Pw), 1)), fl)
                    m.add(Pw, Fl, np.tile(norm(y + UP * 0.8), (len(Pw), 1)), Cl,
                          wind(len(Pw), 0.25 if S.get("basal") else 0.5, st["phase"], fl, r2.uniform()), M=Pw)
            sway = 0.95
            if "head" in S:
                flower_head(m, S, top, axis, r2, detail, st["phase"], sway)
                if detail == 0:
                    pts.append(attach("flower_head", top + axis * S["disc"][2] * 1.1, axis, perp(axis),
                                      (0.002, round(S["head"][0][1] * 2.2, 3)), lod=0, spot="flowers"))
                if S.get("branches") and detail < 2:
                    limb = trees.Limb(st["pts"], np.full(len(st["pts"]), 0.003), 1, 0, 0, 0)
                    for b in range(S["branches"]):
                        p0, d, _ = limb.at(0.6 + 0.15 * b)
                        out = rotate(perp(d), d, b * 2.6)
                        bp = np.array([p0, p0 + norm(out + UP * 1.2) * 0.05, p0 + norm(out * 0.6 + UP) * 0.09])
                        Pb, Fb, Nb, Cb, Wb = tube(bp, 0.0015, 3, color=hexc(S["stem"]), cap_end=False)
                        m.add(Pb, Fb, Nb, Cb, wind(len(Pb), 0.9, st["phase"]), M=Pb)
                        flower_head(m, S, bp[-1], norm(bp[-1] - bp[-2]), r2, detail, st["phase"], sway)
            elif "bells" in S:
                bells(m, S, st["pts"], r2, detail, st["phase"], spike=S.get("spike", False), spots=S.get("spots"))
                if detail == 0:
                    limb = trees.Limb(st["pts"], np.full(len(st["pts"]), 0.003), 1, 0, 0, 0)
                    p0, d, _ = limb.at(0.8)
                    pts.append(attach("flower_head", p0 - UP * S["bells"][1] * 0.8, -UP, d, (0.002, S["bells"][1] * 1.2),
                                      lod=0, spot="flowers", note="inside a hanging bell (normal points down)"))
            elif "pea" in S:
                pea_spike(m, S, st["pts"], r2, detail, st["phase"])
                if detail == 0:
                    pts.append(attach("flower_head", top - UP * 0.04, UP, axis, (0.002, 0.03), lod=0, spot="flowers"))
            elif "iris" in S:
                iris_head(m, S, top, r2, detail, st["phase"])
                if detail == 0:
                    pts.append(attach("flower_head", top + UP * 0.01, UP, [1, 0, 0], (0.002, 0.04), lod=0, spot="flowers"))
        lods.append(m)
    for st in stems[:2]:
        limb = trees.Limb(st["pts"], np.full(len(st["pts"]), 0.003), 1, 0, 0, 0)
        p0, d, _ = limb.at(0.5)
        n = perp(d)
        pts.append(attach("stem", p0 + n * 0.003, n, d, (0.002, 0.02), lod=0, spot="flowers"))
    H = max(float(st["pts"][:, 1].max()) for st in stems)
    top = stems[0]["pts"][-1]
    if "head" in S or "iris" in S:
        r = 0.075
        box = [list(top - r), list(top + r)]
    else:
        h = stems[0]["h"]
        box = [list(top - np.array([0.12, h * 0.5, 0.12])), list(top + np.array([0.12, 0.03, 0.12]))]
    return Asset("plants", f"flower-{kind}", variant, lods, None, pts,
                 dict(height=round(H, 2), group="flower", morph_targets=["closed"], lod_distances=[4.0, 10.0, 25.0],
                      view=dict(elev=16), closeup=box if variant == "a" else None,
                      sheet_lods=(variant == "a" and kind in ("daisy", "bluebell", "lupine"))))


# MARK: - Dandelion

def dandelion(variant, seed):
    """a: the yellow flower (open, 'closed' morph = the bud in its green bracts); b: the seed head
    (a clock of parachute seeds on radial stalks, no solid ball)."""
    rng = np.random.default_rng(seed)
    h = 0.24 if variant == "a" else 0.32
    stem = stem_path(rng, h)
    top = stem[-1]
    axis = norm(stem[-1] - stem[-2])
    lods = []
    pts = []
    for detail in range(3):
        m = Mesh()
        sp = stem if detail == 0 else stem[[0, len(stem) // 2, -1]]
        P, F, N, C, W = tube(sp, 0.003, [5, 3, 3][detail], color=hexc("#7a9a4a"), cap_end=False)
        t = np.repeat(np.linspace(0, 1, len(sp)), [5, 3, 3][detail])
        m.add(P, F, N, C, wind(len(P), t ** 1.5, 0.3), M=P if variant == "a" else None)
        # Basal rosette of toothed leaves.
        nl = 7 if detail == 0 else 4
        for j in range(nl):
            a = 2 * math.pi * j / nl + rng.uniform(-0.2, 0.2)
            fwd = norm(np.array([math.cos(a), 0.25, math.sin(a)]))
            L = rng.uniform(0.12, 0.18)
            if detail == 0:
                Pl, Fl, fl = toothed_leaf(L, 0.022, 5)
            else:
                Pl, Fl, fl = leaf_blade(L, 0.02, 0.2, 0.05, 0.5, 0)
            Pw, x, y, z = place_frame(Pl, np.zeros(3) + UP * 0.003, fwd, UP)
            Cl = np.tile(jitter(hexc("#4e8a30"), rng, 0.06), (len(Pw), 1))
            Cl[:, :3] *= (0.75 + 0.35 * fl)[:, None]
            m.add(Pw, Fl, np.tile(norm(y + UP), (len(Pw), 1)), Cl, wind(len(Pw), 0.15, 0.1, fl * 0.5),
                  M=Pw if variant == "a" else None)
        if variant == "a":
            S = dict(head=[(28, 0.018, 0.0045, 1.5, 0.15, -0.1, "#f2c010", "#ffd828", "strap"),
                           (20, 0.013, 0.004, 1.1, 0.1, -0.1, "#f0b808", "#ffd020", "strap"),
                           (12, 0.008, 0.0035, 0.6, 0.05, -0.1, "#e8a808", "#f8c818", "strap")],
                     disc=(0.004, "#d8a010", 0.003), calyx=True)
            flower_head(m, S, top, axis, np.random.default_rng(seed + 1), detail, 0.3, 0.95)
            if detail == 0:
                pts.append(attach("flower_head", top + axis * 0.006, axis, perp(axis), (0.002, 0.03), lod=0,
                                  spot="flowers"))
        else:
            n = [90, 34, 14][detail]
            golden = math.pi * (3 - math.sqrt(5))
            R = 0.032
            for i in range(n):
                yv = 1 - 2 * (i + 0.5) / n
                rr = math.sqrt(1 - yv * yv)
                th = golden * i
                d = norm(np.array([math.cos(th) * rr, yv, math.sin(th) * rr]) @ np.eye(3))
                if yv < -0.75:
                    continue
                d = norm(d * 1.0 + axis * 0.0)
                base = top + d * 0.004
                tipp = top + d * R * (1 if detail == 0 else 1.15)
                side = perp(d) * 0.0006 * (1 if detail == 0 else 3)
                stalk = np.array([base - side, base + side, tipp])
                m.add(stalk, [[0, 1, 2]], np.tile(d, (3, 1)), np.tile(hexc("#d8d0b8"), (3, 1)), wind(3, 1.0, 0.3, 0.5))
                # Parachute: a fan of fine rays (a shallow cone, open, not a disc).
                rays = 6 if detail == 0 else 3
                x = perp(d)
                z = np.cross(d, x)
                Pp = [tipp]
                Fp = []
                for k in range(rays):
                    a = 2 * math.pi * k / rays
                    rd = norm(d * 0.35 + x * math.cos(a) + z * math.sin(a))
                    w = norm(np.cross(rd, d)) * (0.0005 if detail == 0 else 0.0015)
                    Pp += [tipp + rd * 0.004 - w, tipp + rd * 0.004 + w, tipp + rd * 0.011]
                    q = 1 + 3 * k
                    Fp += [[0, q, q + 2], [0, q + 2, q + 1]]
                Pp = np.array(Pp)
                m.add(Pp, Fp, np.tile(d, (len(Pp), 1)), np.tile(hexc("#f4f2ea"), (len(Pp), 1)),
                      wind(len(Pp), 1.0, 0.3, 1.0, rng.uniform()))
            # The receptacle the seeds sit on (small, brown).
            S_, Fs = uv_sphere(3, 6)
            m.add(S_ * 0.005 + top, Fs, None, np.tile(hexc("#8a6a3a"), (len(S_), 1)), wind(len(S_), 0.95, 0.3))
            if detail == 0:
                pts.append(attach("flower_head", top + UP * 0.04, UP, [1, 0, 0], (0.002, 0.015), lod=0,
                                  spot="flowers", note="on top of the seed clock"))
        lods.append(m)
    meta = dict(height=round(float(top[1] + 0.04), 2), group="flower", lod_distances=[4.0, 10.0, 25.0],
                view=dict(elev=16), sheet_lods=True, closeup=[list(top - 0.06), list(top + 0.06)])
    if variant == "a":
        meta["morph_targets"] = ["closed"]
    return Asset("plants", "dandelion" if variant == "a" else "dandelion-seedhead", "a", lods, None, pts, meta)


def toothed_leaf(length, width, teeth):
    """A dandelion leaf: a folded strip with backward-pointing teeth along both edges."""
    K = teeth + 1
    P, fl, F = [], [], []
    ws = []
    for k in range(K):
        t = k / K
        w = width * (0.25 + 0.75 * math.sin(math.pi * min(0.15 + t * 0.95, 1.0)) ** 0.7)
        ws.append(w)
        P += [[-w, -0.12 * w, length * t], [0, 0.12 * width, length * t], [w, -0.12 * w, length * t]]
        fl += [t, t, t]
    tip = len(P)
    P.append([0, 0, length])
    fl.append(1)
    for k in range(K - 1):
        a, b = 3 * k, 3 * (k + 1)
        F += [[a, b, a + 1], [a + 1, b, b + 1], [a + 1, b + 1, a + 2], [a + 2, b + 1, b + 2]]
    a = 3 * (K - 1)
    F += [[a, tip, a + 1], [a + 1, tip, a + 2]]
    for k in range(1, K):
        t = k / K
        nxt_l = 3 * (k + 1) if k + 1 < K else tip
        nxt_r = 3 * (k + 1) + 2 if k + 1 < K else tip
        w = ws[k]
        for side, base, nxt in ((-1, 3 * k, nxt_l), (1, 3 * k + 2, nxt_r)):
            tt = len(P)
            P.append([side * (w + width * 0.55), -0.1 * w, length * (t - 0.06)])
            fl.append(t)
            F.append([base, nxt, tt])
    return np.array(P, float), np.array(F), np.array(fl, float)


# MARK: - Set

def all_plants(only=None):
    jobs = []
    for i, k in enumerate(GRASS):
        for v in "ab":
            jobs.append((k, lambda k=k, v=v, i=i: grass_clump(k, v, 300 + i * 10 + ord(v))))
    for v in "ab":
        jobs.append(("soil-patch", lambda v=v: soil_patch(v, 390 + ord(v))))
    for i, k in enumerate(FERNS):
        for v in "ab":
            jobs.append((k, lambda k=k, v=v, i=i: fern(k, v, 400 + i * 10 + ord(v))))
    for k in BUSHES:
        for j in range(len(BUSHES[k])):
            jobs.append((k, lambda k=k, j=j: bush(k, j)))
    jobs.append(("reeds-cattail", lambda: reeds("a", 501)))
    jobs.append(("reeds-phragmites", lambda: reeds("b", 502)))
    for v in "ab":
        jobs.append(("lily-pads", lambda v=v: lily_pads(v, 510 + ord(v))))
    jobs.append(("kelp-giant", lambda: kelp("a", 521)))
    jobs.append(("kelp-bull", lambda: kelp("b", 522)))
    for v in "ab":
        jobs.append(("seagrass", lambda v=v: seagrass(v, 530 + ord(v))))
    for i, k in enumerate(MUSHROOMS):
        for v in "ab":
            jobs.append((k, lambda k=k, v=v, i=i: mushrooms(k, v, 600 + i * 10 + ord(v))))
    for v in "ab":
        jobs.append(("fungus-bracket", lambda v=v: brackets(v, 690 + ord(v))))
        jobs.append(("moss-mat", lambda v=v: moss(v, 700 + ord(v))))
        jobs.append(("roots", lambda v=v: roots(v, 710 + ord(v))))
    for i, k in enumerate(FLOWERS):
        for v in "ab":
            jobs.append((f"flower-{k}", lambda k=k, v=v, i=i: flower_plant(k, v, 800 + i * 10 + ord(v))))
    jobs.append(("dandelion", lambda: dandelion("a", 901)))
    jobs.append(("dandelion-seedhead", lambda: dandelion("b", 902)))
    for name, job in jobs:
        if only and not any(name.startswith(o) for o in only):
            continue
        yield job
