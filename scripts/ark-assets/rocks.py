"""Rocks: shore boulders and clusters, cliff faces with strata ledges, scree, pebble and
shell sets, a tide-pool rock with a hollow, a cave mouth and stalactites/stalagmites.
Mossy and barnacle variants. Every rock is one noise function evaluated on an icosphere
of three resolutions, so the LODs keep the same shape. Closed solids: single sided.
"""

import math

import numpy as np

from arkgeo import (UP, Asset, Mesh, attach, fbm, hexc, icosphere, jitter, mix, norm, perp, ridged, rotate,
                    smoothstep, thin, tube, uv_sphere, vertex_normals)

G = lambda *h: [hexc(x) for x in h]

PALETTES = {
    "granite": dict(a=hexc("#8a8682"), b=hexc("#5e5a56"), top=hexc("#a6a29c"), crack=hexc("#3a3632")),
    "sandstone": dict(a=hexc("#b08a62"), b=hexc("#8a6646"), top=hexc("#c8a47a"), crack=hexc("#5a3e2a"),
                      strata=hexc("#9a6a46")),
    "basalt": dict(a=hexc("#4a4a4c"), b=hexc("#2e2e30"), top=hexc("#626264"), crack=hexc("#1a1a1c")),
    "limestone": dict(a=hexc("#c2bcae"), b=hexc("#9a948a"), top=hexc("#d8d2c4"), crack=hexc("#6a645a")),
    "shore": dict(a=hexc("#7a766e"), b=hexc("#56524c"), top=hexc("#9a958a"), crack=hexc("#34302c")),
}
MOSS = hexc("#5a7a2a")
LICHEN = hexc("#c8a83a")
BARNACLE = hexc("#d8d2c0")
WET = hexc("#2e2a26")
ALGAE = hexc("#4a6a2a")

LOD_SUBDIV = (3, 2, 1)


def rock_shape(subdiv, seed, size, sharp=0.5, cuts=6, rough=0.2, sink=0.15, flat_top=0.0):
    """A rock: icosphere -> noise -> planar chisel cuts -> flattened base. Returns P, F, cavity (0..1)."""
    V, F = icosphere(subdiv)
    rng = np.random.default_rng(seed)
    d = V
    n1 = fbm(d * 1.2 + seed * 0.37, 3)
    n2 = ridged(d * 2.5 + seed * 0.11, 3)
    r = 1 + rough * n1 + rough * 0.5 * (n2 - 0.5) * sharp * 2
    P = d * r[:, None] * np.asarray(size)
    # Chisel: planar cuts make flat facets and crisp edges.
    for k in range(cuts):
        nrm = norm(rng.normal(0, 1, 3) * np.array([1, 0.6, 1]))
        if nrm[1] < -0.3:
            nrm[1] = -nrm[1]
        dd = (P @ nrm).max() * rng.uniform(0.58, 0.82)
        over = P @ nrm - dd
        P = P - nrm * np.maximum(over, 0)[:, None] * rng.uniform(0.85, 1.0)
    if flat_top:
        top = P[:, 1].max() * (1 - flat_top)
        P[:, 1] = np.where(P[:, 1] > top, top + (P[:, 1] - top) * 0.15, P[:, 1])
    lo = P[:, 1].min()
    P[:, 1] -= lo + sink * (P[:, 1].max() - lo)
    P[:, 1] = np.maximum(P[:, 1], -0.25 * np.asarray(size)[1])
    cavity = np.clip(0.5 - (r - 1) / (rough * 2 + 1e-6), 0, 1)
    return P, F, cavity


def facet(P, F, N, C, k=0.6):
    """Unweld so each triangle carries its own normal (blended with the smooth one): crisp
    facets and edges, the stylised rock look. Colours stay continuous."""
    Pf = P[F].reshape(-1, 3)
    fn = norm(np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]))
    Nf = norm(np.repeat(fn, 3, axis=0) * k + N[F].reshape(-1, 3) * (1 - k))
    Cf = C[F].reshape(-1, 4)
    return Pf, np.arange(len(Pf)).reshape(-1, 3), Nf, Cf


def rock_colors(P, N, cavity, pal, seed, moss=0.0, lichen=0.0, barnacle_band=None, strata=None):
    p = PALETTES[pal]
    n = fbm(P * 1.7 + seed, 3)
    C = mix(p["b"], p["a"], np.clip(0.5 + n * 1.6, 0, 1))
    fine = fbm(P * 9 + seed * 2, 2)
    C[:, :3] *= (0.9 + 0.2 * fine)[:, None]
    C = mix(C, p["top"], smoothstep(0.5, 1.0, N[:, 1]) * 0.45)
    C = mix(C, p["crack"], np.clip(cavity * 0.9, 0, 1) * 0.55)
    if strata is not None:
        band = 0.5 + 0.5 * np.sin(P[:, 1] * strata + fbm(P * 0.6 + seed, 2) * 3)
        C = mix(C, p.get("strata", p["b"]), smoothstep(0.55, 0.95, band) * 0.6)
    ground = smoothstep(-0.1, 0.5, P[:, 1])
    C[:, :3] *= (0.6 + 0.4 * ground)[:, None]
    if barnacle_band is not None:
        lo, hi = barnacle_band
        wet = 1 - smoothstep(lo, hi, P[:, 1])
        C = mix(C, WET, wet * 0.55)
        speck = smoothstep(0.25, 0.45, fbm(P * 32 + seed, 2)) * (1 - smoothstep(hi * 0.8, hi * 1.25, P[:, 1])) * \
            smoothstep(lo - 0.1, lo + 0.15, P[:, 1])
        C = mix(C, BARNACLE, speck * 0.8)
        C = mix(C, ALGAE, (1 - smoothstep(lo - 0.2, lo + 0.1, P[:, 1])) * 0.5)
    if moss:
        m = fbm(P * 2.2 + seed + 5, 3)
        cover = smoothstep(0.35, 0.75, N[:, 1] * 0.8 + m * 1.2 + (moss - 0.5)) * smoothstep(-0.1, 0.2, P[:, 1])
        mc = mix(MOSS, hexc("#7a9a34"), np.clip(0.5 + m * 2, 0, 1))
        C = mix(C, mc, cover)
    if lichen:
        l = fbm(P * 6 + seed + 9, 2)
        C = mix(C, LICHEN, smoothstep(0.32, 0.42, l) * lichen * smoothstep(0.2, 0.7, N[:, 1] + 0.3))
    return np.clip(C, 0, 1)


def barnacles(m, P, N, band, rng, count, scale=1.0):
    lo, hi = band
    cand = np.where((P[:, 1] > lo) & (P[:, 1] < hi) & (N[:, 1] > -0.4))[0]
    if len(cand) == 0:
        return []
    pick = rng.choice(cand, min(count, len(cand)), replace=False)
    pts = []
    for i in pick:
        c, n = P[i], N[i]
        s = rng.uniform(0.012, 0.025) * scale
        x = perp(n)
        z = np.cross(n, x)
        sides = 6
        a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
        base = c + (np.cos(a)[:, None] * x + np.sin(a)[:, None] * z) * s
        top = c + n * s * 0.9 + (np.cos(a)[:, None] * x + np.sin(a)[:, None] * z) * s * 0.4
        Pc = np.concatenate([base, top, [c + n * s * 0.75]])
        F = []
        for j in range(sides):
            j1 = (j + 1) % sides
            F += [[j, j1, sides + j1], [j, sides + j1, sides + j]]
            F.append([sides + j, sides + j1, 2 * sides])
        C = np.concatenate([np.tile(BARNACLE, (sides, 1)), np.tile(hexc("#ece6d6"), (sides, 1)), [hexc("#6a6258")]])
        m.add(Pc, F, None, C, np.zeros((len(Pc), 4)))
        pts.append((c, n))
    return pts


def rock_attach(P, N, rng, size, tag_flat="ledge", count=8, spot="rocks"):
    pts = []
    up = np.where(N[:, 1] > 0.86)[0]
    steep = np.where(np.abs(N[:, 1]) < 0.3)[0]
    over = np.where((N[:, 1] < -0.35) & (P[:, 1] < size * 0.35) & (P[:, 1] > -0.05))[0]
    for i in rng.choice(up, min(len(up), count * 3), replace=False) if len(up) else []:
        pts.append(attach(tag_flat, P[i] + N[i] * 0.005, N[i], perp(N[i]), (0.005, size * 0.6), lod=0, spot=spot))
    for i in rng.choice(steep, min(len(steep), count * 2), replace=False) if len(steep) else []:
        pts.append(attach("rock_face", P[i] + N[i] * 0.005, N[i], UP, (0.003, size * 0.25), lod=0, spot=spot))
    out = thin([a for a in pts if a["tag"] == tag_flat], count, rng) + \
        thin([a for a in pts if a["tag"] == "rock_face"], count // 2 + 1, rng)
    if len(over):
        i = over[int(np.argmin(P[over, 1]))]
        n = norm(np.array([N[i][0], 0, N[i][2]]))
        out.append(attach("burrow_entrance", [P[i][0], 0.02, P[i][2]], n, -n, (0.02, size * 0.4), lod=0,
                          spot="leaf_litter", note="under the overhang"))
    return out


# MARK: - Boulders and clusters

def boulders(kind, variant, seed, n, pal, moss=0.0, barnacle=False, lichen=0.3, spread=1.6, big=1.4):
    rng = np.random.default_rng(seed)
    stones = []
    for i in range(n):
        if i == 0:
            c = np.zeros(3)
            s = big
        else:
            a = rng.uniform(0, 2 * math.pi)
            s = big * rng.uniform(0.35, 0.75)
            c = np.array([math.cos(a), 0, math.sin(a)]) * (big * 0.7 + s * 0.6) * rng.uniform(0.8, spread / 1.4)
        stones.append(dict(c=c, size=np.array([s * rng.uniform(1.0, 1.4), s * rng.uniform(0.6, 0.9), s * rng.uniform(0.9, 1.2)]),
                           rot=rng.uniform(0, 2 * math.pi), seed=seed * 7 + i, sharp=rng.uniform(0.3, 0.9),
                           cuts=int(rng.integers(7, 12))))
    band = (0.0, big * 0.55) if barnacle else None
    lods, pts = [], []
    for detail in range(3):
        m = Mesh()
        for k, st in enumerate(stones):
            sub = LOD_SUBDIV[detail] - (1 if (k and detail == 0 and n > 3) else 0)
            if detail == 2 and k >= 4:
                continue
            P, F, cav = rock_shape(max(sub, 1), st["seed"], st["size"], st["sharp"], st["cuts"])
            ca, sa = math.cos(st["rot"]), math.sin(st["rot"])
            P = P @ np.array([[ca, 0, -sa], [0, 1, 0], [sa, 0, ca]]) + st["c"]
            N = vertex_normals(P, F)
            C = rock_colors(P, N, cav, pal, seed + k, moss=moss, lichen=lichen, barnacle_band=band,
                            strata=9.0 if pal == "sandstone" else None)
            m.add(*facet(P, F, N, C, 0.55 if detail < 2 else 0.3), np.zeros((len(F) * 3, 4)))
            if detail == 0:
                pts += rock_attach(P, N, np.random.default_rng(st["seed"]), float(st["size"].max()), count=3)
                if barnacle:
                    for c, nn in barnacles(m, P, N, band, np.random.default_rng(st["seed"]), 45 if k == 0 else 15)[:3]:
                        pts.append(attach("rock_face", c + nn * 0.03, nn, UP, (0.005, 0.15), lod=0, spot="rocks",
                                          note="barnacles"))
        lods.append(m)
    if n > 1:
        # Crevices: between the big stone and its neighbours, at ground level.
        for st in stones[1:4]:
            mid = (stones[0]["c"] + st["c"]) / 2
            out = norm(np.cross(st["c"] - stones[0]["c"], UP))
            pts.append(attach("crevice", [mid[0], 0.05, mid[2]], out, UP, (0.01, 0.25), lod=0, spot="rocks"))
    meta = dict(height=round(float(lods[0].bounds()[1][1]), 2), group="rock",
                lod_distances=[round(6 * big + 6, 1), round(15 * big + 10, 1), round(40 * big + 20, 1)])
    if barnacle:
        meta["note"] = "intertidal: barnacles and wet rock below y=%.2f" % band[1]
    return Asset("rocks", kind, variant, lods, None, thin(pts, 24, rng), meta, double_sided=False)


# MARK: - Cliff face

def cliff(variant, seed):
    """A cliff section, 8 m wide and 6 m tall, facing +Z: a displaced sheet that runs up the face,
    over a rounded lip and back across the top, its two ends curling back into the hill. Layered
    strata step in and out (ledges and overhangs), with vertical cracks. Open at the back: set it
    into terrain."""
    rng = np.random.default_rng(seed)
    pal = {"a": "sandstone", "b": "granite", "c": "basalt"}[variant]
    W, H, D = 8.0, 6.0, 2.5
    nlayers = int(rng.integers(6, 10))
    cuts = np.sort(rng.uniform(0, H, nlayers - 1))
    layer_off = rng.uniform(-0.35, 0.35, nlayers) * (1.0 if variant != "b" else 0.5)
    lods, pts = [], []
    for detail, (nu, nv) in enumerate([(56, 44), (28, 20), (12, 9)]):
        u = np.linspace(0, 1, nu + 1)
        v = np.linspace(0, 1, nv + 1)
        U, V = np.meshgrid(u, v, indexing="ij")
        # Profile along v: 0..0.72 up the face (y 0 -> H), 0.72..0.82 the lip, 0.82..1 back over the top.
        face = np.clip(V / 0.72, 0, 1)
        lip = np.clip((V - 0.72) / 0.1, 0, 1)
        top = np.clip((V - 0.82) / 0.18, 0, 1)
        y = face * H + lip * 0.25 - top * 0.3
        z = -lip * 0.6 - top * D
        x = (U - 0.5) * W
        end = np.abs(2 * U - 1) ** 5
        z = z - end * D * 1.2
        x = x * (1 - 0.08 * end)
        P = np.stack([x, y, z], -1).reshape(-1, 3)
        Vf = V.ravel()
        frontness = (1 - lip.ravel()) * (1 - end.ravel())
        # Strata: each layer pushed in or out as a block, edges softened.
        li = np.searchsorted(cuts, P[:, 1] + fbm(P * 0.3 + seed, 2) * 0.25)
        off = layer_off[np.clip(li, 0, nlayers - 1)]
        n1 = fbm(P * np.array([0.35, 0.5, 0.35]) + seed, 4)
        crack = smoothstep(0.8, 0.96, ridged(P * np.array([0.9, 0.12, 0.9]) + seed + 3, 2))
        bump = fbm(P * 1.6 + seed * 2, 3)
        dz = (off + n1 * 0.45 + bump * 0.12 - crack * 0.35) * frontness
        P[:, 2] += dz
        P[:, 1] += (fbm(P * 0.5 + seed + 7, 3) * 0.35) * (1 - frontness)
        F = []
        for i in range(nu):
            for j in range(nv):
                a0 = i * (nv + 1) + j
                b0 = a0 + nv + 1
                F += [[a0, b0, b0 + 1], [a0, b0 + 1, a0 + 1]]
        F = np.array(F)
        N = vertex_normals(P, F)
        if N[np.argmin(np.abs(Vf - 0.35)), 2] < 0:
            F = F[:, [0, 2, 1]]
            N = -N
        cav = np.clip(crack * 1.5 + np.maximum(-dz, 0) * 0.8, 0, 1)
        C = rock_colors(P * 0.6, N, cav, pal, seed, moss=0.35 if variant == "c" else 0.2, lichen=0.4,
                        strata=2 * math.pi / 0.9 if variant == "a" else None,
                        barnacle_band=(0.0, 1.1) if variant == "c" else None)
        # Grass on the top, a damp foot.
        C = mix(C, hexc("#5a7a32"), smoothstep(0.8, 0.86, Vf) * 0.85)
        m = Mesh().add(*facet(P, F, N, C, 0.35 if detail == 0 else 0.2), np.zeros((len(F) * 3, 4)))
        if detail == 0:
            if variant == "c":
                barnacles(m, P, N, (0.0, 1.0), rng, 80, 1.6)
            r2 = np.random.default_rng(seed)
            onface = (frontness > 0.6) & (P[:, 1] > 0.4) & (P[:, 1] < H - 0.3)
            ledges = np.where((N[:, 1] > 0.6) & onface)[0]
            for i in r2.choice(ledges, min(len(ledges), 40), replace=False) if len(ledges) else []:
                pts.append(attach("ledge", P[i] + N[i] * 0.01, N[i], [0, 0, 1], (0.01, 0.8), lod=0, spot="rocks"))
            cracks = np.where((crack > 0.3) & onface)[0]
            for i in r2.choice(cracks, min(len(cracks), 20), replace=False) if len(cracks) else []:
                pts.append(attach("crevice", P[i], N[i], UP, (0.01, 0.3), lod=0, spot="rocks"))
            under = np.where((N[:, 1] < -0.5) & onface)[0]
            for i in r2.choice(under, min(len(under), 10), replace=False) if len(under) else []:
                pts.append(attach("cave_ceiling", P[i] + N[i] * 0.01, N[i], [1, 0, 0], (0.01, 0.2), lod=0,
                                  spot="rocks", note="under an overhang"))
            faces = np.where((np.abs(N[:, 1]) < 0.3) & onface)[0]
            for i in r2.choice(faces, min(len(faces), 30), replace=False) if len(faces) else []:
                pts.append(attach("rock_face", P[i] + N[i] * 0.01, N[i], UP, (0.003, 0.4), lod=0, spot="rocks"))
            tops = np.where(Vf > 0.88)[0]
            for i in r2.choice(tops, 4, replace=False):
                pts.append(attach("ledge", P[i] + UP * 0.02, UP, [0, 0, 1], (0.01, 1.5), lod=0, spot="rocks",
                                  note="cliff top"))
        lods.append(m)
    r3 = np.random.default_rng(seed + 1)
    keep = []
    for tag, n in (("ledge", 12), ("crevice", 6), ("cave_ceiling", 3), ("rock_face", 8)):
        keep += thin([a for a in pts if a["tag"] == tag], n, r3)
    return Asset("rocks", "cliff-face", variant, lods, None, keep,
                 dict(height=round(float(lods[0].bounds()[1][1]), 2), group="cliff", face="+Z",
                      note="open at the back and below the top edge: set it into the terrain",
                      lod_distances=[40.0, 90.0, 220.0], view=dict(elev=12, az=25)), double_sided=False)


# MARK: - Scree, pebbles, shells

def scree(variant, seed):
    rng = np.random.default_rng(seed)
    pal = "granite" if variant == "a" else "limestone"
    stones = []
    for i in range(56):
        # A fan-shaped apron, thicker at the back (-Z), as if fallen from a slope.
        x = rng.uniform(-1.8, 1.8)
        z = rng.uniform(-1.4, 1.2)
        heap = 0.35 * (1 - (z + 1.4) / 2.6) * (1 - abs(x) / 2.2)
        s = rng.uniform(0.06, 0.22) * (1.3 if z < 0 else 1)
        stones.append(dict(c=np.array([x, heap, z]), s=np.array([s * 1.3, s * 0.8, s]), seed=seed * 13 + i,
                           rot=rng.uniform(0, 6.28)))
    stones.sort(key=lambda d: -d["s"][0])
    lods, pts = [], []
    for detail in range(3):
        m = Mesh()
        # Gravel bed: a low wedge mound.
        gr, gf = icosphere(2 if detail == 0 else 1)
        gp = gr * np.array([2.2, 0.4, 1.7])
        gp[:, 1] = np.maximum(gp[:, 1], -0.05) * (1 - (gp[:, 2] + 1.7) / 3.4 * 0.8) * 1.0
        gp[:, 1] -= 0.04
        gn = vertex_normals(gp, gf)
        gc = rock_colors(gp, gn, np.zeros(len(gp)), pal, seed)
        gc[:, :3] *= (0.75 + 0.25 * fbm(gp * 20, 2))[:, None]
        m.add(gp, gf, gn, gc, np.zeros((len(gp), 4)))
        keep = stones if detail == 0 else stones[:30] if detail == 1 else stones[:10]
        for st in keep:
            P, F, cav = rock_shape(1 if (detail == 0 and st["s"][0] > 0.14) else 0, st["seed"], st["s"], 0.9, 5, 0.25, 0.1)
            ca, sa = math.cos(st["rot"]), math.sin(st["rot"])
            P = P @ np.array([[ca, 0, -sa], [0, 1, 0], [sa, 0, ca]]) + st["c"]
            N = vertex_normals(P, F)
            m.add(P, F, N, rock_colors(P, N, cav, pal, st["seed"], lichen=0.2), np.zeros((len(P), 4)))
        lods.append(m)
    for st in stones[:10]:
        pts.append(attach("rock_face", st["c"] + UP * st["s"][1] * 0.7, UP, [1, 0, 0], (0.003, float(st["s"][0])),
                          lod=0, spot="rocks"))
    for st in stones[10:14]:
        pts.append(attach("crevice", st["c"] + np.array([st["s"][0], 0, 0]), [1, 0, 0], UP, (0.005, 0.12), lod=0,
                          spot="rocks", note="between stones"))
    return Asset("rocks", "scree", variant, lods, None, pts,
                 dict(height=0.6, group="rock", lod_distances=[12.0, 30.0, 70.0], view=dict(elev=30)),
                 double_sided=False)


def pebble(m, c, s, rot, seed, detail, color):
    rings, sides = [(4, 8), (3, 6), (2, 4)][detail]
    P, F = uv_sphere(rings, sides)
    P = P * s
    n = fbm(P * 8 + seed, 2)
    P *= (1 + 0.08 * n)[:, None]
    P[:, 1] = np.maximum(P[:, 1], -s[1] * 0.4)
    ca, sa = math.cos(rot), math.sin(rot)
    P = P @ np.array([[ca, 0, -sa], [0, 1, 0], [sa, 0, ca]]) + c
    N = vertex_normals(P, F)
    C = np.tile(color, (len(P), 1))
    C[:, :3] *= (0.8 + 0.3 * np.clip(N[:, 1], 0, 1) + 0.1 * n)[:, None]
    m.add(P, F, N, np.clip(C, 0, 1), np.zeros((len(P), 4)))


def shell(m, kind, c, s, rot, rng, detail):
    """cockle (ribbed fan dome), mussel (dark elongated valve), whelk (spiral cone), scallop (fan with ears)."""
    ca, sa = math.cos(rot), math.sin(rot)
    R = np.array([[ca, 0, -sa], [0, 1, 0], [sa, 0, ca]])
    if kind in ("cockle", "scallop", "mussel"):
        ribs = [12, 8, 5][detail]
        rings = [4, 2, 2][detail]
        P = [[0, 0, -0.45]]
        C = []
        base = hexc({"cockle": "#e8d8b8", "scallop": "#e8a888", "mussel": "#283a5a"}[kind])
        C.append(base * np.array([0.8, 0.8, 0.8, 1]))
        for i in range(1, rings + 1):
            t = i / rings
            for j in range(ribs):
                a = math.pi * (0.1 + 0.8 * j / (ribs - 1))
                rib = 1 + (0.06 * (j % 2) if kind != "mussel" else 0)
                rr = t * rib
                if kind == "mussel":
                    x, z = math.cos(a) * rr * 0.45, -0.45 + math.sin(a) * rr * 1.1
                else:
                    x, z = math.cos(a) * rr, -0.45 + math.sin(a) * rr
                P.append([x, 0.35 * math.sqrt(max(0, 1 - t ** 2)) * rib + 0.02, z])
                band = 0.85 + 0.15 * math.sin(t * 9) if kind != "mussel" else 0.9 + 0.1 * t
                C.append(base * np.array([band, band, band, 1]))
        P = np.array(P)
        F = [[0, 1 + j + 1, 1 + j] for j in range(ribs - 1)]
        for i in range(rings - 1):
            for j in range(ribs - 1):
                a0 = 1 + i * ribs + j
                F += [[a0, a0 + 1, a0 + 1 + ribs], [a0, a0 + 1 + ribs, a0 + ribs]]
        P = (P * s) @ R.T + c
        m.add(P, F, None, np.array(C), np.zeros((len(P), 4)))
    else:  # whelk
        turns = 3.2
        k = [24, 12, 6][detail]
        t = np.linspace(0, 1, k)
        ang = t * turns * 2 * math.pi
        rad = 0.35 * (1 - t) + 0.02
        pts = np.stack([np.cos(ang) * rad * 0.6, 0.1 + 0.15 * (1 - t), -0.2 + t * 0.9], 1)
        P, F, N, C, W = tube(pts, rad * 0.8, [6, 5, 4][detail], color=hexc("#c8a888"))
        C[:, :3] *= (0.8 + 0.2 * np.sin(np.arange(len(C)) * 0.9))[:, None]
        P = (P * s) @ R.T + c
        m.add(P, F, None, C, np.zeros((len(P), 4)))


def pebbles(variant, seed):
    """a: a pebble patch; b: a shell set on sand-coloured shingle (shells, a few pebbles)."""
    rng = np.random.default_rng(seed)
    items = []
    R = 1.0
    for i in range(70 if variant == "a" else 26):
        a, r = rng.uniform(0, 2 * math.pi), R * math.sqrt(rng.uniform())
        s = rng.uniform(0.025, 0.08)
        items.append(dict(kind="pebble", c=np.array([math.cos(a) * r, s * 0.25, math.sin(a) * r]),
                          s=np.array([s * rng.uniform(1.0, 1.5), s * rng.uniform(0.45, 0.7), s]), rot=rng.uniform(0, 6.28),
                          col=jitter(G("#8a8680", "#6a6660", "#a8a49a", "#b8a890", "#e8e4dc", "#5a5650")[i % 6], rng, 0.08)))
    if variant == "b":
        kinds = ["cockle", "cockle", "mussel", "whelk", "scallop"]
        for i in range(26):
            a, r = rng.uniform(0, 2 * math.pi), R * math.sqrt(rng.uniform())
            items.append(dict(kind=kinds[i % 5], c=np.array([math.cos(a) * r, 0.0, math.sin(a) * r]),
                              s=rng.uniform(0.04, 0.07), rot=rng.uniform(0, 6.28)))
    lods, pts = [], []
    for detail in range(3):
        m = Mesh()
        keep = items if detail == 0 else items[::2] if detail == 1 else items[::5]
        for it in keep:
            if it["kind"] == "pebble":
                pebble(m, it["c"], it["s"] * (1 if detail < 2 else 1.4), it["rot"], seed, detail, it["col"])
            else:
                shell(m, it["kind"], it["c"], it["s"] * (1 if detail < 2 else 1.4), it["rot"], rng, detail)
        lods.append(m)
    for it in items[:: max(1, len(items) // 10)]:
        pts.append(attach("shell" if it["kind"] != "pebble" else "rock_face",
                          it["c"] + UP * 0.03, UP, [1, 0, 0], (0.002, 0.06), lod=0, spot="rocks"))
    pts.append(attach("sand", [0.2, 0.0, 0.3], UP, [1, 0, 0], (0.003, 0.3), lod=0, spot="rocks"))
    return Asset("rocks", "pebbles" if variant == "a" else "shells", "a", lods, None, pts,
                 dict(height=0.1, group="shore", lod_distances=[5.0, 12.0, 30.0], view=dict(elev=40)),
                 double_sided=False)


# MARK: - Tide pool

def tide_pool(variant, seed):
    rng = np.random.default_rng(seed)
    size = np.array([1.8, 0.55, 1.3]) * (1 if variant == "a" else 1.3)
    pool_c = np.array([0.15, 0, -0.05])
    pool_r = np.array([0.95, 0.75]) * (1 if variant == "a" else 1.25)
    depth = 0.35
    lods, pts = [], []
    water_y = None
    for detail, sub in enumerate((4, 3, 2)):
        P, F, cav = rock_shape(sub, seed, size, 0.5, 4, 0.12, 0.2, flat_top=0.35)
        rel = (P[:, [0, 2]] - pool_c[[0, 2]]) / pool_r
        d = np.linalg.norm(rel, axis=1)
        topmask = P[:, 1] > size[1] * 0.25
        bowl = np.clip(1 - d ** 2, 0, 1) * depth * topmask
        rim = P[:, 1].max()
        P[:, 1] -= bowl
        N = vertex_normals(P, F)
        C = rock_colors(P, N, cav + bowl * 1.5, "shore", seed, barnacle_band=(0.0, 0.32), lichen=0.2)
        inside = smoothstep(0.95, 0.6, d) * topmask
        C = mix(C, hexc("#3a5a3a"), inside * 0.5)
        C = mix(C, hexc("#5a7a3a"), smoothstep(0.75, 0.95, d) * inside * 0.6)
        m = Mesh().add(P, F, N, C, np.zeros((len(P), 4)))
        if detail == 0:
            barnacles(m, P, N, (0.02, 0.3), rng, 70)
            water_y = float(rim - depth * 0.35)
            # Anemones in the pool: little tentacle crowns.
            for k in range(6):
                a, r = rng.uniform(0, 2 * math.pi), rng.uniform(0.1, 0.6)
                q = pool_c + np.array([math.cos(a) * r * pool_r[0], 0, math.sin(a) * r * pool_r[1]])
                j = np.argmin(np.linalg.norm(P[:, [0, 2]] - q[[0, 2]], axis=1) + (~topmask) * 9)
                base = P[j]
                col = hexc(["#c83a4a", "#3a8a5a", "#d87a3a"][k % 3])
                for t in range(10):
                    ang = 2 * math.pi * t / 10
                    dvec = norm(np.array([math.cos(ang), 1.2, math.sin(ang)]))
                    tri = np.array([base + np.array([math.cos(ang + 1.6), 0, math.sin(ang + 1.6)]) * 0.004,
                                    base - np.array([math.cos(ang + 1.6), 0, math.sin(ang + 1.6)]) * 0.004,
                                    base + dvec * 0.045])
                    m.add(tri, [[0, 1, 2]], np.tile(dvec, (3, 1)), np.tile(col, (3, 1)),
                          np.array([[0.3, k / 6, 0, t / 10], [0.3, k / 6, 0, t / 10], [0.3, k / 6, 1, t / 10]]))
                pts.append(attach("tide_pool", base + UP * 0.05, UP, [1, 0, 0], (0.003, 0.08), lod=0, spot="pond_surface",
                                  note="anemone, under water"))
            r2 = np.random.default_rng(seed + 3)
            for i in r2.choice(np.where((N[:, 1] > 0.8) & (d > 1.15))[0], 8, replace=False):
                pts.append(attach("rock_face", P[i] + N[i] * 0.005, N[i], [1, 0, 0], (0.003, 0.4), lod=0, spot="rocks"))
        lods.append(m)
    wc = pool_c.copy()
    wc[1] = water_y
    pts.insert(0, attach("tide_pool", wc, UP, [1, 0, 0], (0.003, 0.5), lod=0, spot="pond_surface",
                         note="the water surface at the pool's centre"))
    return Asset("rocks", "tide-pool-rock", variant, lods, None, pts,
                 dict(height=round(float(lods[0].bounds()[1][1]), 2), group="shore",
                      pool=dict(centre=[round(float(x), 3) for x in wc], radius=[round(float(pool_r[0]) * 0.85, 3),
                                                                                  round(float(pool_r[1]) * 0.85, 3)],
                                water_y=round(water_y, 3), note="draw a water disc here (the scene's water shader)"),
                      lod_distances=[10.0, 25.0, 60.0], view=dict(elev=40)), double_sided=False)


# MARK: - Cave mouth, stalactites

def cave_mouth(variant, seed):
    """A rock hood over a cave opening on +Z: an arch-shaped tunnel (faces inward, darkening to a
    closed end 5 m in), a thick outer shell that mounds back into the hill, and a rim joining them.
    The floor is open (it sits on the terrain)."""
    rng = np.random.default_rng(seed)
    pal = "limestone" if variant == "a" else "granite"
    ew, eh, T, depth = 1.5, 2.2, 1.7, 5.0
    lods, pts = [], []
    for detail, (na, nz) in enumerate([(44, 16), (18, 6), (8, 3)]):
        a = np.linspace(0, math.pi, na + 1)
        zs = np.linspace(0, -depth, nz + 1)
        Pin, Pout = [], []
        for k, z in enumerate(zs):
            t = k / nz
            sc = 1 - 0.3 * t
            Pin.append(np.stack([np.cos(a) * ew * sc, np.sin(a) * eh * sc, np.full(na + 1, z)], 1))
            # The outer shell rises and widens behind the mouth like a hill.
            grow = 1 + 0.6 * t
            Pout.append(np.stack([np.cos(a) * (ew + T * grow), np.sin(a) * (eh + T * 0.8 * grow), np.full(na + 1, z + 0.3)], 1))
        Pin, Pout = np.concatenate(Pin), np.concatenate(Pout)
        # Noise: the outer shell knobbly, the tunnel rougher near the mouth.
        Pout += norm(Pout * np.array([1, 1, 0])) * (fbm(Pout * 0.6 + seed, 4) * 0.6 + ridged(Pout * 1.2 + seed, 2) * 0.25)[:, None]
        Pin += norm(Pin * np.array([1, 1, 0])) * (fbm(Pin * 1.1 + seed + 3, 3) * 0.22)[:, None]
        Pin[:, 1] = np.maximum(Pin[:, 1], -0.1)
        Pout[:, 1] = np.maximum(Pout[:, 1], -0.15)

        def strip(nrings, ncols, flip):
            F = []
            for k in range(nrings - 1):
                for j in range(ncols - 1):
                    a0 = k * ncols + j
                    b0 = a0 + ncols
                    F += [[a0, a0 + 1, b0 + 1], [a0, b0 + 1, b0]] if not flip else [[a0, b0 + 1, a0 + 1], [a0, b0, b0 + 1]]
            return np.array(F)

        Fin = strip(nz + 1, na + 1, False)
        Fout = strip(nz + 1, na + 1, True)
        # Tunnel: normals toward the axis.
        Nin = vertex_normals(Pin, Fin)
        axis = np.stack([np.zeros(len(Pin)), np.full(len(Pin), eh * 0.35), Pin[:, 2]], 1)
        if (Nin * (axis - Pin)).sum() < 0:
            Fin = Fin[:, [0, 2, 1]]
            Nin = -Nin
        Nout = vertex_normals(Pout, Fout)
        if (Nout * (Pout - np.array([0, 0, -depth / 2]))).sum() < 0:
            Fout = Fout[:, [0, 2, 1]]
            Nout = -Nout
        tdepth = np.repeat(np.linspace(0, 1, nz + 1), na + 1)
        Cin = rock_colors(Pin, Nin, np.full(len(Pin), 0.35), pal, seed + 1)
        Cin[:, :3] *= (1 - 0.88 * tdepth ** 0.6)[:, None]
        Cin = mix(Cin, hexc("#3a3026"), (Pin[:, 1] < 0.15) * 0.5)
        Cout = rock_colors(Pout * 0.7, Nout, np.zeros(len(Pout)), pal, seed, moss=0.45 if variant == "b" else 0.25,
                           lichen=0.3)
        m = Mesh()
        m.add(*facet(Pin, Fin, Nin, Cin, 0.25), np.zeros((len(Fin) * 3, 4)))
        m.add(*facet(Pout, Fout, Nout, Cout, 0.4 if detail < 2 else 0.2), np.zeros((len(Fout) * 3, 4)))
        # Rim: the front ring of the shell to the front ring of the tunnel.
        ri, ro = Pin[: na + 1], Pout[: na + 1]
        R = np.concatenate([ro, ri])
        Fr = []
        for j in range(na):
            Fr += [[j, j + 1, na + 2 + j], [j, na + 2 + j, na + 1 + j]]
        Fr = np.array(Fr)
        Nr = vertex_normals(R, Fr)
        if Nr[:, 2].sum() < 0:
            Fr = Fr[:, [0, 2, 1]]
            Nr = -Nr
        Cr = rock_colors(R, Nr, np.full(len(R), 0.2), pal, seed + 2)
        m.add(*facet(R, Fr, Nr, Cr, 0.5), np.zeros((len(Fr) * 3, 4)))
        # Back of the tunnel: dark.
        last = Pin[-(na + 1):]
        EP = np.concatenate([last, [last.mean(0) - np.array([0, 0, 0.4])]])
        EF = np.array([[na + 1, j + 1, j] for j in range(na)])
        m.add(EP, EF, np.tile([0, 0, 1.0], (len(EP), 1)), np.tile(hexc("#0c0a08"), (len(EP), 1)), np.zeros((len(EP), 4)))
        # Back of the shell: close it toward the hill.
        lo_ring = Pout[-(na + 1):]
        BP = np.concatenate([lo_ring, [lo_ring.mean(0) + np.array([0, -0.5, -1.5])]])
        BF = np.array([[na + 1, j, j + 1] for j in range(na)])
        BN = vertex_normals(BP, BF)
        if BN[:, 2].sum() > 0:
            BF = BF[:, [0, 2, 1]]
        m.add(BP, BF, None, rock_colors(BP * 0.7, np.tile([0, 0.3, -1.0], (len(BP), 1)), np.zeros(len(BP)), pal, seed),
              np.zeros((len(BP), 4)))
        if detail == 0:
            pts += rock_attach(Pout, Nout, np.random.default_rng(seed), 1.5, count=6)
        lods.append(m)
    pts.append(attach("cave_mouth", [0, 0.02, -0.6], UP, [0, 0, 1], (0.01, 1.5), lod=0, spot="rocks"))
    pts.append(attach("cave_mouth", [0.3, 0.02, -2.2], UP, [0, 0, 1], (0.01, 1.2), lod=0, spot="rocks",
                      note="inside, in the shade"))
    pts.append(attach("cave_ceiling", [0, eh * 0.95, -1.5], -UP, [0, 0, 1], (0.02, 0.4), lod=0, spot="rocks",
                      note="roof just inside the mouth (bats)"))
    pts.append(attach("burrow_entrance", [0, 0.02, -depth * 0.85], [0, 0, 1], [0, 0, -1], (0.02, 2.0), lod=0,
                      spot="leaf_litter", note="the dark back of the cave"))
    return Asset("rocks", "cave-mouth", variant, lods, None, pts,
                 dict(height=round(float(lods[0].bounds()[1][1]), 2), group="cliff", face="+Z",
                      note="the mouth faces +Z at z=0; the floor is open: sit it on (or into) the terrain",
                      lod_distances=[30.0, 70.0, 160.0], view=dict(elev=14, az=30)), double_sided=False)


def stalactites(variant, seed):
    """a: stalactites hanging from a ceiling slab (origin at the ceiling, they point down -Y);
    b: stalagmites rising from the floor, with a column."""
    rng = np.random.default_rng(seed)
    hang = variant == "a"
    items = []
    for i in range(16 if hang else 12):
        a, r = rng.uniform(0, 2 * math.pi), 1.2 * math.sqrt(rng.uniform())
        L = rng.uniform(0.35, 1.6) * (1 if i else 1.3)
        items.append(dict(c=np.array([math.cos(a) * r, 0, math.sin(a) * r]), L=L, R=L * rng.uniform(0.1, 0.15),
                          seed=seed + i))
    lods, pts = [], []
    sgn = -1 if hang else 1
    for detail, (sides, segs) in enumerate([(9, 8), (6, 4), (4, 2)]):
        m = Mesh()
        # The slab (ceiling or floor) they grow from.
        P, F, cav = rock_shape([3, 2, 1][detail], seed, np.array([1.6, 0.18, 1.6]), 0.4, 3, 0.15, 0.0)
        P[:, 1] -= P[:, 1].max() if hang else 0
        P[:, 1] = P[:, 1] if hang else np.minimum(P[:, 1], 0.12)
        N = vertex_normals(P, F)
        m.add(P, F, N, rock_colors(P + UP * 0.8, N, cav * 0.5, "limestone", seed), np.zeros((len(P), 4)))
        for k, it in enumerate(items):
            if detail == 2 and k > 6:
                continue
            t = np.linspace(0, 1, segs + 1)
            prof = it["R"] * (1 - t) ** 1.3 * (1 + 0.15 * np.sin(t * 17 + k))
            prof[-1] = 0.004
            wob = rng.normal(0, 0.02, (segs + 1, 3)) * t[:, None]
            pts_ = it["c"] + np.outer(t * it["L"] * sgn, UP) + wob
            if not hang:
                pts_[:, 1] -= 0.05
            P2, F2, N2, C2, W2 = tube(pts_, prof, sides, color=hexc("#d8ccb0"), cap_end=False)
            ring = np.repeat(t, sides)
            C2 = mix(hexc("#c8b898"), hexc("#efe6d0"), ring)
            C2[:, :3] *= (0.85 + 0.15 * fbm(P2 * 12 + k, 2))[:, None]
            m.add(P2, F2, N2, C2, np.zeros((len(P2), 4)))
        if not hang and detail < 2:
            col = np.array([0.6, 0, -0.3])
            ys = np.linspace(0, 2.4, 9)
            prof = 0.18 + 0.1 * np.cos(ys * 2.6) + 0.12 * (np.abs(ys - 1.2) / 1.2) ** 2
            P2, F2, N2, C2, W2 = tube(col + np.outer(ys, UP), prof, sides + 2, cap_end=False)
            C2 = np.tile(hexc("#d8ccb0"), (len(P2), 1))
            C2[:, :3] *= (0.8 + 0.2 * fbm(P2 * 6, 2))[:, None]
            m.add(P2, F2, N2, C2, np.zeros((len(P2), 4)))
        lods.append(m)
    for it in items[:8]:
        tip = it["c"] + UP * it["L"] * sgn
        pts.append(attach("cave_ceiling" if hang else "rock_face", it["c"] + UP * it["L"] * 0.4 * sgn + np.array([it["R"] * 0.6, 0, 0]),
                          [1, 0, 0], UP, (0.003, 0.15), lod=0, spot="rocks"))
    if hang:
        pts.append(attach("cave_ceiling", [0.4, -0.15, 0.4], -UP, [1, 0, 0], (0.02, 0.4), lod=0, spot="rocks",
                          note="between the stalactites"))
    return Asset("rocks", "stalactites" if hang else "stalagmites", "a", lods, None, pts,
                 dict(height=round(float(lods[0].bounds()[1][1] - lods[0].bounds()[0][1]), 2), group="cave",
                      note="origin at the ceiling, pointing down" if hang else "origin on the cave floor",
                      lod_distances=[10.0, 25.0, 60.0], view=dict(elev=4 if hang else 15)), double_sided=False)


def all_rocks(only=None):
    jobs = [
        ("boulder", lambda: boulders("boulder", "a", 1001, 1, "granite", lichen=0.4)),
        ("boulder", lambda: boulders("boulder", "b", 1002, 1, "sandstone", lichen=0.2, big=1.1)),
        ("boulder-mossy", lambda: boulders("boulder-mossy", "a", 1003, 1, "granite", moss=0.7)),
        ("boulder-cluster", lambda: boulders("boulder-cluster", "a", 1011, 4, "shore")),
        ("boulder-cluster", lambda: boulders("boulder-cluster", "b", 1012, 6, "granite", big=1.1)),
        ("boulder-cluster-mossy", lambda: boulders("boulder-cluster-mossy", "a", 1013, 5, "granite", moss=0.65)),
        ("boulder-cluster-barnacle", lambda: boulders("boulder-cluster-barnacle", "a", 1014, 4, "shore", barnacle=True,
                                                      lichen=0.0)),
        ("boulder-cluster-barnacle", lambda: boulders("boulder-cluster-barnacle", "b", 1015, 6, "basalt", barnacle=True,
                                                      lichen=0.0, big=1.0)),
        ("cliff-face", lambda: cliff("a", 1021)),
        ("cliff-face", lambda: cliff("b", 1022)),
        ("cliff-face", lambda: cliff("c", 1023)),
        ("scree", lambda: scree("a", 1031)),
        ("scree", lambda: scree("b", 1032)),
        ("pebbles", lambda: pebbles("a", 1041)),
        ("shells", lambda: pebbles("b", 1042)),
        ("tide-pool-rock", lambda: tide_pool("a", 1051)),
        ("tide-pool-rock", lambda: tide_pool("b", 1052)),
        ("cave-mouth", lambda: cave_mouth("a", 1061)),
        ("cave-mouth", lambda: cave_mouth("b", 1062)),
        ("stalactites", lambda: stalactites("a", 1071)),
        ("stalagmites", lambda: stalactites("b", 1072)),
    ]
    for name, job in jobs:
        if only and not any(name.startswith(o) for o in only):
            continue
        yield job
