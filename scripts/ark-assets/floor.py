"""Forest floor: fallen logs in three stages of decay (fresh, mossy, rotten), twig sets,
pinecones and leaf-litter patches (decals made of real lying leaves, with a mottled base).
"""

import math

import numpy as np

import plants
import trees
from arkgeo import (UP, Asset, Mesh, attach, fbm, hexc, jitter, leaf_blade, mix, norm, perp, place_frame, rotate,
                    smoothstep, thin, tube, uv_sphere, vertex_normals)

G = lambda *h: [hexc(x) for x in h]


def end_cap(centre, axis, radius, sides, rings, rot, heart, sap, bark, rng, hollow=0.0):
    """A sawn or broken end: concentric growth rings in vertex colour (or a dark hollow)."""
    axis = norm(axis)
    x = perp(axis)
    z = np.cross(axis, x)
    P = [centre - axis * hollow * radius * 1.5]
    C = [hexc("#140e0a") if hollow else heart]
    for i in range(1, rings + 1):
        t = i / rings
        for j in range(sides):
            a = 2 * math.pi * j / sides
            r = radius * t * (1 + 0.04 * math.sin(a * 3 + i))
            depth = (1 - t) * hollow * radius * 1.5
            P.append(centre + (x * math.cos(a) + z * math.sin(a)) * r - axis * depth)
            if hollow:
                C.append(mix(hexc("#140e0a"), sap, smoothstep(0.55, 1.0, t)))
            else:
                ring = 0.5 + 0.5 * math.sin(t * 22 + rng.uniform(0, 0.3))
                C.append(mix(heart, sap, t) * np.array([0.88 + 0.12 * ring] * 3 + [1]))
    C[-sides:] = [bark] * sides
    P = np.array(P)
    F = [[0, 1 + j, 1 + (j + 1) % sides] for j in range(sides)]
    for i in range(rings - 1):
        for j in range(sides):
            a0 = 1 + i * sides + j
            a1 = 1 + i * sides + (j + 1) % sides
            F += [[a0, a0 + sides, a1 + sides], [a0, a1 + sides, a1]]
    N = np.tile(axis, (len(P), 1))
    if hollow:
        N = vertex_normals(P, np.array(F))
        if (N.mean(0) @ axis) < 0:
            N = -N
    return P, np.array(F), N, np.array(C)


LOGS = {
    "fresh": dict(bark=hexc("#5e4a36"), dark=hexc("#2e241a"), moss=None, heart=hexc("#c8a070"), sap=hexc("#e2c494"),
                  stubs=6, sag=0.0, hollow=0.0, broken=False, fungi=0, rough=0.06),
    "mossy": dict(bark=hexc("#4e4234"), dark=hexc("#2a221a"), moss=dict(color=hexc("#4e7a26"), lo=0.15, hi=0.6),
                  heart=hexc("#9a7a52"), sap=hexc("#b49268"), stubs=3, sag=0.04, hollow=0.0, broken=False, fungi=6,
                  rough=0.05),
    "rotten": dict(bark=hexc("#4a3a2c"), dark=hexc("#1e1812"), moss=dict(color=hexc("#5a7a2a"), lo=0.0, hi=0.55),
                   heart=hexc("#7a5a3a"), sap=hexc("#8a6a48"), stubs=1, sag=0.12, hollow=0.62, broken=True, fungi=10,
                   rough=0.1, peel=True),
}


def log(stage, variant, seed):
    S = LOGS[stage]
    rng = np.random.default_rng(seed)
    L = rng.uniform(3.0, 4.2) * (1 if variant == "a" else 0.7)
    R0 = rng.uniform(0.26, 0.34) * (1 if variant == "a" else 0.8)
    # The axis: along X, lying on the ground, with a gentle bend and (rotten) a sag in the middle.
    t = np.linspace(0, 1, 16)
    bend = rng.uniform(-0.25, 0.25)
    pieces = [(0.0, 0.58), (0.62, 1.0)] if S["broken"] else [(0.0, 1.0)]
    bark_spec = dict(bark=dict(color=S["bark"], dark=S["dark"], fx=5, fy=5, contrast=1.3, moss=S["moss"]))
    base_fn = trees.bark_color_fn(bark_spec, 1.0)

    def color_fn(P, N, ring, angles):
        C = base_fn(P, N, ring, angles)
        if S.get("peel"):
            pe = fbm(P * 2.2 + seed, 2)
            C = mix(C, hexc("#9a6a3e"), smoothstep(0.15, 0.3, pe) * (1 - smoothstep(0.3, 0.8, N[:, 1])) * 0.85)
        C[:, :3] *= (0.6 + 0.4 * smoothstep(-0.1, R0 * 1.2, P[:, 1]))[:, None]
        return C

    lods, pts = [], []
    for detail, (sides, rings_k) in enumerate([(12, 1.0), (8, 0.5), (5, 0.25)]):
        m = Mesh()
        for pi, (t0, t1) in enumerate(pieces):
            k = max(3, int(26 * (t1 - t0) * rings_k) + 1)
            tt = np.linspace(t0, t1, k)
            x = (tt - 0.5) * L
            sag = S["sag"] * np.sin(tt * math.pi) * R0 * 3
            r = R0 * (1 - 0.25 * tt) * (1 + 0.05 * np.sin(tt * 13 + seed))
            y = r - 0.12 * R0 - sag
            z = bend * (tt - 0.5) ** 2 * L * 0.4
            path = np.stack([x, y, z], 1)
            ring_shape = (lambda i, a: 1 + S["rough"] * np.cos(a * 5 + i * 2.1) + 0.03 * np.cos(a * 11)) if detail < 2 else None
            P, F, N, C, W = tube(path, r, sides, cap_end=False, color_fn=color_fn, ring_shape=ring_shape)
            m.add(P, F, N, C, np.zeros((len(P), 4)))
            # Ends: sawn rings (fresh), or broken/hollow (rotten).
            for end, idx in ((0, 0), (1, -1)):
                c = path[idx]
                ax = norm(path[1] - path[0]) * (-1 if end == 0 else 1) if end == 0 else norm(path[-1] - path[-2])
                hollow = S["hollow"] if (S["broken"] and ((pi == 0 and end == 1) or (pi == 1 and end == 0))) or \
                    (S["hollow"] and end == 1 and pi == len(pieces) - 1) else 0.0
                EP, EF, EN, EC = end_cap(c, ax, r[idx] * 0.97, sides, [4, 2, 1][detail], 0, S["heart"], S["sap"],
                                         S["bark"], rng, hollow=hollow)
                m.add(EP, EF, EN, EC, np.zeros((len(EP), 4)))
                if detail == 0 and hollow:
                    pts.append(attach("burrow_entrance", c - ax * r[idx] * 0.3 + UP * (-r[idx] * 0.45), ax, -ax,
                                      (0.02, round(float(r[idx]) * 1.1, 3)), lod=0, spot="leaf_litter",
                                      note="into the hollow log"))
            if detail == 0:
                limb = trees.Limb(path, r, 1, 0, 0, 0)
                for tq in np.linspace(0.15, 0.85, 4):
                    p, d, rr = limb.at(tq)
                    pts.append(attach("log_top", p + UP * rr, UP, d, (0.005, round(float(rr) * 2.5, 3)), lod=0,
                                      spot="bark"))
                    side = norm(np.cross(d, UP))
                    pts.append(attach("bark", p + side * rr, side, UP, (0.003, round(float(rr), 3)), lod=0, spot="bark"))
                p, d, rr = limb.at(0.5)
                side = norm(np.cross(d, UP))
                pts.append(attach("burrow_entrance" if stage != "fresh" else "crevice",
                                  p + side * rr * 0.9 - UP * (p[1] - 0.02), side, -side, (0.01, round(float(rr), 3)),
                                  lod=0, spot="leaf_litter", note="the gap under the log"))
        # Branch stubs.
        r2 = np.random.default_rng(seed + 1)
        for s in range(S["stubs"] if detail < 2 else min(2, S["stubs"])):
            tq = r2.uniform(0.15, 0.85)
            x0 = (tq - 0.5) * L
            a = r2.uniform(-0.6, 3.7)
            d = norm(np.array([r2.uniform(-0.3, 0.6), math.sin(a) * 0.9 + 0.3, math.cos(a)]))
            rr = R0 * (1 - 0.25 * tq)
            base = np.array([x0, rr - 0.12 * R0, bend * (tq - 0.5) ** 2 * L * 0.4])
            ln = r2.uniform(0.25, 0.6) * (0.4 if stage == "rotten" else 1)
            sp = np.array([base, base + d * ln * 0.5, base + d * ln])
            P, F, N, C, W = tube(sp, [rr * 0.3, rr * 0.22, rr * 0.18], max(4, sides // 2), cap_end=False,
                                 color_fn=color_fn)
            m.add(P, F, N, C, np.zeros((len(P), 4)))
            EP, EF, EN, EC = end_cap(sp[-1], d, rr * 0.18, max(4, sides // 2), 1, 0, S["heart"], S["sap"], S["bark"], r2)
            m.add(EP, EF, EN, EC, np.zeros((len(EP), 4)))
        # Fungi on the mossy and rotten logs.
        if detail < 2 and S["fungi"]:
            r3 = np.random.default_rng(seed + 2)
            M = plants.MUSHROOMS["mushroom-mycena" if stage == "rotten" else "mushroom-inkcap"]
            for f in range(S["fungi"] if detail == 0 else S["fungi"] // 2):
                tq = r3.uniform(0.1, 0.9)
                ang = r3.uniform(-1.2, 1.2)
                rr = R0 * (1 - 0.25 * tq)
                cen = np.array([(tq - 0.5) * L, rr - 0.12 * R0, bend * (tq - 0.5) ** 2 * L * 0.4])
                n = np.array([0, math.cos(ang), math.sin(ang)])
                plants.mushroom_one(M, cen + n * rr * 0.95, r3.uniform(0.6, 1.0), n - UP, r3, detail, m, r3.uniform())
                if detail == 0 and f < 3:
                    pts.append(attach("fungus_cap", cen + n * (rr + 0.06), UP, [1, 0, 0], (0.002, 0.02), lod=0,
                                      spot="leaf_litter"))
        lods.append(m)
    return Asset("floor", f"log-{stage}", variant, lods, None, thin(pts, 20, rng),
                 dict(height=round(float(lods[0].bounds()[1][1]), 2), length=round(L, 2), group="log",
                      decay=stage, lod_distances=[10.0, 25.0, 60.0], view=dict(elev=25)), double_sided=False)


# MARK: - Twigs, pinecones

def twigs(variant, seed):
    rng = np.random.default_rng(seed)
    sticks = []
    for i in range(14 if variant == "a" else 24):
        a, r = rng.uniform(0, 2 * math.pi), 0.6 * math.sqrt(rng.uniform())
        c = np.array([math.cos(a) * r, 0, math.sin(a) * r])
        d = norm(np.array([math.cos(rng.uniform(0, 6.28)), 0, math.sin(rng.uniform(0, 6.28))]))
        L = rng.uniform(0.15, 0.55)
        R = rng.uniform(0.006, 0.016)
        pts = trees.grow_path(rng, c - d * L / 2, d, L, L / 5, 0, 0.12)
        pts[:, 1] = R + np.abs(rng.normal(0, 0.006, len(pts)))
        kids = []
        for k in range(int(rng.integers(0, 3))):
            tq = rng.uniform(0.3, 0.8)
            limb = trees.Limb(pts, np.full(len(pts), R), 1, 0, 0, 0)
            p, dd, _ = limb.at(tq)
            cd = norm(rotate(dd, UP, rng.choice([-1, 1]) * rng.uniform(0.4, 0.9)))
            kp = np.array([p, p + cd * L * 0.2, p + cd * L * 0.35])
            kp[:, 1] = R * 0.7
            kids.append(kp)
        sticks.append(dict(pts=pts, R=R, kids=kids, col=jitter(G("#6a5038", "#7a6046", "#5a4434", "#8a7a64")[i % 4], rng, 0.1)))
    lods = []
    for detail, sides in enumerate([4, 3, 3]):
        m = Mesh()
        keep = sticks if detail < 2 else sticks[::3]
        for st in keep:
            sp = st["pts"] if detail == 0 else st["pts"][[0, len(st["pts"]) // 2, -1]]
            P, F, N, C, W = tube(sp, np.linspace(st["R"], st["R"] * 0.6, len(sp)) * (1 if detail < 2 else 1.6), sides,
                                 color=st["col"], cap_end=False)
            m.add(P, F, N, C, np.zeros((len(P), 4)))
            if detail == 0:
                for kp in st["kids"]:
                    P, F, N, C, W = tube(kp, [st["R"] * 0.6, st["R"] * 0.45, st["R"] * 0.3], 3, color=st["col"], cap_end=False)
                    m.add(P, F, N, C, np.zeros((len(P), 4)))
        lods.append(m)
    pts = [attach("leaf_litter", st["pts"][len(st["pts"]) // 2] + UP * st["R"], UP, st["pts"][-1] - st["pts"][0],
                  (0.002, 0.05), lod=0, spot="leaf_litter") for st in sticks[:8]]
    return Asset("floor", "twigs", variant, lods, None, pts,
                 dict(height=0.04, group="litter", lod_distances=[4.0, 10.0, 20.0], view=dict(elev=40)),
                 double_sided=False)


def pinecone(m, c, axis, L, R, kind, detail, rng):
    axis = norm(axis)
    x = perp(axis)
    z = np.cross(axis, x)
    col = hexc("#7a5434" if kind == "pine" else "#8a6440")
    tipc = hexc("#a87c50" if kind == "pine" else "#b08a5a")
    if detail == 0:
        n = 44 if kind == "pine" else 56
        golden = math.pi * (3 - math.sqrt(5))
        # Core.
        P, F = uv_sphere(4, 6)
        core = P * np.array([R * 0.45, L * 0.48, R * 0.45])
        core = c + core[:, 0:1] * x + (core[:, 1:2] + L * 0.5) * axis + core[:, 2:3] * z
        m.add(core, F, None, np.tile(col * np.array([0.6, 0.6, 0.6, 1]), (len(core), 1)), np.zeros((len(core), 4)))
        for i in range(n):
            t = (i + 0.5) / n
            a = i * golden
            prof = math.sin(math.pi * min(1.0, 0.1 + t * 0.95)) ** 0.7
            out = x * math.cos(a) + z * math.sin(a)
            base = c + axis * (t * L) + out * R * 0.35 * prof
            sc = R * (0.35 + 0.65 * prof) * (0.9 if kind == "pine" else 0.7)
            tip = base + out * sc + axis * sc * (0.25 if kind == "pine" else 0.5)
            side = np.cross(axis, out) * sc * 0.45
            P = np.array([base - side, base + side, tip + side * 0.3, tip - side * 0.3, base + axis * sc * 0.4])
            F = [[0, 1, 2], [0, 2, 3], [4, 3, 2], [4, 2, 1], [4, 0, 3]]
            C = np.array([col * np.array([0.7, 0.7, 0.7, 1]), col * np.array([0.7, 0.7, 0.7, 1]), tipc, tipc, col])
            m.add(P, F, None, C, np.zeros((5, 4)))
    else:
        sides = 8 if detail == 1 else 5
        t = np.linspace(0, 1, 6 if detail == 1 else 3)
        prof = R * (0.25 + 0.75 * np.sin(np.pi * np.clip(0.1 + t * 0.95, 0, 1)) ** 0.7)
        prof[-1] = R * 0.15
        pts = c + np.outer(t * L, axis)
        P, F, N, C, W = tube(pts, prof, sides, color=col)
        m.add(P, F, N, C, np.zeros((len(P), 4)))


def pinecones(variant, seed):
    rng = np.random.default_rng(seed)
    kind = "pine" if variant == "a" else "spruce"
    items = []
    for i in range(7):
        a, r = rng.uniform(0, 2 * math.pi), 0.45 * math.sqrt(rng.uniform())
        c = np.array([math.cos(a) * r, 0, math.sin(a) * r])
        L = rng.uniform(0.05, 0.07) if kind == "pine" else rng.uniform(0.09, 0.13)
        R = L * (0.38 if kind == "pine" else 0.25)
        ax = norm(np.array([math.cos(rng.uniform(0, 6.28)), rng.uniform(-0.1, 0.25), math.sin(rng.uniform(0, 6.28))]))
        items.append(dict(c=c + UP * R * 0.9 - ax * L * 0.5, ax=ax, L=L, R=R))
    lods = []
    for detail in range(3):
        m = Mesh()
        for it in (items if detail < 2 else items[:3]):
            pinecone(m, it["c"], it["ax"], it["L"], it["R"], kind, detail, rng)
        lods.append(m)
    pts = [attach("leaf_litter", it["c"] + UP * it["R"] * 1.6, UP, it["ax"], (0.002, 0.04), lod=0, spot="leaf_litter")
           for it in items[:4]]
    return Asset("floor", f"pinecones-{kind}", "a", lods, None, pts,
                 dict(height=0.06, group="litter", lod_distances=[3.0, 8.0, 16.0], view=dict(elev=35)),
                 double_sided=False)


# MARK: - Leaf litter

LITTER = {
    "autumn": dict(colors=G("#a8582a", "#c87a2a", "#d8a03a", "#8a4a26", "#b86a30", "#6a4a2a", "#c8b04a", "#7a8a3a"),
                   base=(hexc("#4a3424"), hexc("#6a4a30")), shapes=["maple", "oak", "blade"], size=(0.07, 0.12), n=150),
    "conifer": dict(colors=G("#8a5a30", "#a06a3a", "#7a4a28", "#9a7a4a"), base=(hexc("#4a3020"), hexc("#7a5030")),
                    shapes=["needle"], size=(0.03, 0.05), n=260, cones=4),
    "tropical": dict(colors=G("#6a5a2a", "#8a6a30", "#4a5a2a", "#a07a3a", "#5a4a24"),
                     base=(hexc("#3a2c1e"), hexc("#5a4028")), shapes=["blade"], size=(0.18, 0.32), n=60),
}


def lying_leaf(shape, L, rng):
    if shape == "maple":
        # Five pointed lobes around the stalk end.
        P, F = [[0, 0, 0]], []
        k = 10
        for j in range(k):
            a = -math.pi * 0.95 + 2 * math.pi * 0.95 * j / (k - 1)
            r = L * (1.0 if j % 2 == 0 else 0.45)
            P.append([math.sin(a) * r, 0, math.cos(a) * r * 0.9 + L * 0.2])
        for j in range(k - 1):
            F.append([0, 1 + j, 2 + j])
        P = np.array(P, float)
        fl = np.linalg.norm(P, axis=1) / L
        P[:, 1] = 0.12 * L * (fl ** 2) * rng.uniform(0.3, 1.0)
        return P, np.array(F), fl
    if shape == "oak":
        P, F, fl = plants.toothed_leaf(L, L * 0.3, 3)
        P[:, 1] *= -1
        P[:, 1] += 0.08 * L * fl ** 2
        return P, F, fl
    if shape == "needle":
        w = 0.0015
        P = np.array([[-w, 0, 0], [w, 0, 0], [0, 0, L]])
        return P, np.array([[0, 1, 2]]), np.array([0, 0, 1.0])
    P, F, fl = leaf_blade(L, L * 0.22, -0.2, -0.15, 0.45, 1)
    return P, F, fl


def litter(variant, seed):
    kind = {"a": "autumn", "b": "conifer", "c": "tropical"}[variant]
    S = LITTER[kind]
    rng = np.random.default_rng(seed)
    R = 1.0
    leaves = []
    for i in range(S["n"]):
        a, r = rng.uniform(0, 2 * math.pi), R * math.sqrt(rng.uniform()) * 0.95
        c = np.array([math.cos(a) * r, 0.004 + rng.uniform(0, 0.012), math.sin(a) * r])
        fwd = np.array([math.cos(rng.uniform(0, 6.28)), rng.uniform(-0.15, 0.15), math.sin(rng.uniform(0, 6.28))])
        up = norm(UP + rng.normal(0, 0.15, 3))
        leaves.append(dict(c=c, fwd=fwd, up=up, L=rng.uniform(*S["size"]), shape=S["shapes"][i % len(S["shapes"])],
                           col=jitter(S["colors"][int(rng.integers(len(S["colors"])))], rng, 0.1, 0.03)))
    lods, pts = [], []
    for detail, (rings, sides, keep) in enumerate([(4, 20, 1.0), (2, 12, 0.3), (1, 8, 0.0)]):
        m = Mesh()
        # The base: a mottled, slightly domed disc that fades into the ground at its edge.
        P = [[0, 0.003, 0]]
        for i in range(1, rings + 1):
            t = i / rings
            for j in range(sides):
                aa = 2 * math.pi * j / sides
                jag = 1 + 0.18 * fbm(np.array([[math.cos(aa) * 2, math.sin(aa) * 2, seed]]), 2)[0]
                P.append([math.cos(aa) * R * t * jag, 0.003 * (1 - t), math.sin(aa) * R * t * jag])
        P = np.array(P)
        F = [[0, 1 + (j + 1) % sides, 1 + j] for j in range(sides)]
        for i in range(rings - 1):
            for j in range(sides):
                a0 = 1 + i * sides + j
                a1 = 1 + i * sides + (j + 1) % sides
                F += [[a0, a1, a1 + sides], [a0, a1 + sides, a0 + sides]]
        n = fbm(P * 6 + seed, 3)
        C = mix(S["base"][0], S["base"][1], np.clip(0.5 + n * 1.5, 0, 1))
        if detail == 2:
            # Far: the leaves' colour folded into the base.
            avg = np.mean([l["col"] for l in leaves], 0)
            C = mix(C, avg, np.clip(0.5 + fbm(P * 9 + 3, 2) * 2, 0, 1) * 0.7)
        m.add(P, F, np.tile(UP, (len(P), 1)), C, np.zeros((len(P), 4)))
        for l in leaves[: int(len(leaves) * keep)]:
            Pl, Fl, fl = lying_leaf(l["shape"] if detail == 0 else ("needle" if l["shape"] == "needle" else "blade"),
                                    l["L"] * (1 if detail == 0 else 1.4), rng)
            Pw, x, y, z = place_frame(Pl, l["c"], l["fwd"], l["up"])
            Cl = np.tile(l["col"], (len(Pw), 1))
            Cl[:, :3] *= (0.85 + 0.2 * fl)[:, None]
            m.add(Pw, Fl, np.tile(norm(y + UP), (len(Pw), 1)), Cl, np.zeros((len(Pw), 4)))
        if S.get("cones") and detail < 2:
            for k in range(S["cones"]):
                a, r = rng.uniform(0, 6.28), rng.uniform(0.1, 0.8)
                ax = np.array([math.cos(a + 1), 0.1, math.sin(a + 1)])
                pinecone(m, np.array([math.cos(a) * r, 0.025, math.sin(a) * r]) - ax * 0.05, ax, 0.1, 0.025, "spruce",
                         detail + 1, rng)
        lods.append(m)
    for l in leaves[:: max(1, len(leaves) // 10)]:
        pts.append(attach("leaf_litter", l["c"] + UP * 0.01, UP, l["fwd"], (0.001, 0.12), lod=0, spot="leaf_litter"))
    return Asset("floor", f"litter-{kind}", "a", lods, None, pts,
                 dict(height=0.03, group="litter", decal=True,
                      note="a flat decal patch (radius 1 m): lay it on the terrain, scale freely",
                      lod_distances=[6.0, 15.0, 40.0], view=dict(elev=55)))


def all_floor(only=None):
    jobs = [
        ("log-fresh", lambda: log("fresh", "a", 1101)), ("log-fresh", lambda: log("fresh", "b", 1102)),
        ("log-mossy", lambda: log("mossy", "a", 1111)), ("log-mossy", lambda: log("mossy", "b", 1112)),
        ("log-rotten", lambda: log("rotten", "a", 1121)), ("log-rotten", lambda: log("rotten", "b", 1122)),
        ("twigs", lambda: twigs("a", 1131)), ("twigs", lambda: twigs("b", 1132)),
        ("pinecones-pine", lambda: pinecones("a", 1141)), ("pinecones-spruce", lambda: pinecones("b", 1142)),
        ("litter-autumn", lambda: litter("a", 1151)), ("litter-conifer", lambda: litter("b", 1152)),
        ("litter-tropical", lambda: litter("c", 1153)),
    ]
    for name, job in jobs:
        if only and not any(name.startswith(o) for o in only):
            continue
        yield job
