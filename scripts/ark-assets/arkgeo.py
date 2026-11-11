"""Shared geometry for the Ark asset sets: a vertex-coloured mesh builder,
noise, tubes, leaves, attach points and a plain glTF binary writer.

Pure numpy (runs inside Blender's Python, which ships numpy). Units are
metres, +Y up, the asset's origin at its ground contact.

Every mesh carries the same attributes:
  POSITION, NORMAL
  COLOR_0   linear RGBA (authored in sRGB, converted on write)
  COLOR_1   the wind weights (a colour slot, because gltfpack drops custom
            attributes), vec4 unorm8: x sway weight (trunk low -> branches mid -> leaves high,
            0 at the ground), y phase of the limb it hangs from (0..1),
            z flutter (0 at a leaf's stalk -> 1 at its tip; 0 on wood),
            w the leaf's own phase (0..1)
Optionally one morph target ("closed" for flowers).
"""

import json
import math
import struct

import numpy as np

UP = np.array([0.0, 1.0, 0.0])


# MARK: - Small maths

def norm(v):
    v = np.asarray(v, float)
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)


def perp(d):
    """Any unit vector perpendicular to d."""
    d = norm(d)
    a = np.array([0.0, 1.0, 0.0]) if abs(d[1]) < 0.9 else np.array([1.0, 0.0, 0.0])
    return norm(np.cross(d, a))


def rotate(v, axis, angle):
    """Rodrigues rotation of v (n,3) or (3,) about a unit axis."""
    axis = norm(axis)
    v = np.asarray(v, float)
    c, s = math.cos(angle), math.sin(angle)
    dot = (v @ axis)[..., None] if v.ndim == 2 else (v @ axis)
    return v * c + np.cross(axis, v) * s + axis * dot * (1 - c)


def hexc(h, a=1.0):
    h = h.lstrip("#")
    return np.array([int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a])


def mix(a, b, t):
    t = np.asarray(t, float)
    if t.ndim == 1:
        t = t[:, None]
    return np.asarray(a) * (1 - t) + np.asarray(b) * t


def shade(c, k):
    """Scale an RGBA colour's rgb by k (k may be an array)."""
    c = np.array(c, float)
    k = np.asarray(k, float)
    if k.ndim == 0:
        out = c.copy()
        out[..., :3] *= k
        return np.clip(out, 0, 1)
    out = np.tile(c, (len(k), 1)) if c.ndim == 1 else c.copy()
    out[:, :3] *= k[:, None]
    return np.clip(out, 0, 1)


def jitter(c, rng, amount=0.06, hue=0.03):
    """A colour nudged in value and a little in hue (keeps it natural)."""
    c = np.array(c, float)
    v = 1 + rng.uniform(-amount, amount)
    h = rng.uniform(-hue, hue)
    c[:3] = np.clip(c[:3] * v + np.array([h, -h * 0.3, -h * 0.7]), 0, 1)
    return c


def srgb_to_linear(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def smoothstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# MARK: - Noise (vectorised Perlin, fixed permutation so builds are reproducible)

_PERM = np.random.default_rng(20261111).permutation(256)
_P = np.concatenate([_PERM, _PERM, _PERM])
_G = np.array([[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
               [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]], float)


def perlin(p):
    p = np.atleast_2d(np.asarray(p, float))
    pi = np.floor(p).astype(np.int64)
    f = p - pi
    pi &= 255
    u = f * f * f * (f * (f * 6 - 15) + 10)
    x, y, z = pi[:, 0], pi[:, 1], pi[:, 2]

    def g(ix, iy, iz, fx, fy, fz):
        h = _P[_P[_P[ix] + iy] + iz] % 12
        gr = _G[h]
        return gr[:, 0] * fx + gr[:, 1] * fy + gr[:, 2] * fz

    fx, fy, fz = f[:, 0], f[:, 1], f[:, 2]
    n000 = g(x, y, z, fx, fy, fz)
    n100 = g(x + 1, y, z, fx - 1, fy, fz)
    n010 = g(x, y + 1, z, fx, fy - 1, fz)
    n110 = g(x + 1, y + 1, z, fx - 1, fy - 1, fz)
    n001 = g(x, y, z + 1, fx, fy, fz - 1)
    n101 = g(x + 1, y, z + 1, fx - 1, fy, fz - 1)
    n011 = g(x, y + 1, z + 1, fx, fy - 1, fz - 1)
    n111 = g(x + 1, y + 1, z + 1, fx - 1, fy - 1, fz - 1)
    ux, uy, uz = u[:, 0], u[:, 1], u[:, 2]
    x00 = n000 + ux * (n100 - n000)
    x10 = n010 + ux * (n110 - n010)
    x01 = n001 + ux * (n101 - n001)
    x11 = n011 + ux * (n111 - n011)
    y0 = x00 + uy * (x10 - x00)
    y1 = x01 + uy * (x11 - x01)
    return y0 + uz * (y1 - y0)


def fbm(p, octaves=4, lac=2.0, gain=0.5, seed=0.0):
    p = np.atleast_2d(np.asarray(p, float)) + seed * 17.13
    total = np.zeros(len(p))
    amp, freq, norm_ = 1.0, 1.0, 0.0
    for _ in range(octaves):
        total += amp * perlin(p * freq)
        norm_ += amp
        amp *= gain
        freq *= lac
    return total / norm_


def ridged(p, octaves=4, seed=0.0):
    p = np.atleast_2d(np.asarray(p, float)) + seed * 11.7
    total = np.zeros(len(p))
    amp, freq, s = 1.0, 1.0, 0.0
    for _ in range(octaves):
        total += amp * (1 - np.abs(perlin(p * freq)))
        s += amp
        amp *= 0.5
        freq *= 2.03
    return total / s


# MARK: - Mesh

def vertex_normals(P, F):
    P = np.asarray(P, float)
    F = np.asarray(F, np.int64)
    N = np.zeros_like(P)
    if len(F):
        fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
        for k in range(3):
            np.add.at(N, F[:, k], fn)
    bad = np.linalg.norm(N, axis=1) < 1e-14
    N[bad] = UP
    return norm(N)


class Mesh:
    """A list of parts, each with its own vertices (parts are never welded)."""

    def __init__(self):
        self.parts = []

    def add(self, P, F, N=None, C=None, W=None, M=None, MN=None):
        P = np.asarray(P, float).reshape(-1, 3)
        F = np.asarray(F, np.int64).reshape(-1, 3)
        n = len(P)
        if n == 0:
            return self
        if N is None:
            N = vertex_normals(P, F)
            if M is not None and MN is None:
                MN = vertex_normals(M, F)
        C = np.ones((n, 4)) if C is None else np.broadcast_to(np.asarray(C, float), (n, 4)).copy()
        W = np.zeros((n, 4)) if W is None else np.broadcast_to(np.asarray(W, float), (n, 4)).copy()
        part = dict(P=P, F=F, N=norm(N), C=C, W=W)
        if M is not None:
            part["M"] = np.asarray(M, float).reshape(-1, 3)
            part["MN"] = norm(MN if MN is not None else N)
        self.parts.append(part)
        return self

    def extend(self, other):
        self.parts.extend(other.parts)
        return self

    def transform(self, mat):
        mat = np.asarray(mat, float)
        R = mat[:3, :3]
        t = mat[:3, 3]
        Ri = np.linalg.inv(R).T
        for part in self.parts:
            part["P"] = part["P"] @ R.T + t
            part["N"] = norm(part["N"] @ Ri.T)
            if "M" in part:
                part["M"] = part["M"] @ R.T + t
                part["MN"] = norm(part["MN"] @ Ri.T)
        return self

    def copy(self):
        m = Mesh()
        m.parts = [{k: v.copy() for k, v in p.items()} for p in self.parts]
        return m

    @property
    def tris(self):
        return int(sum(len(p["F"]) for p in self.parts))

    @property
    def verts(self):
        return int(sum(len(p["P"]) for p in self.parts))

    def has_morph(self):
        return any("M" in p for p in self.parts)

    def finalize(self):
        morph = self.has_morph()
        Ps, Ns, Cs, Ws, Fs, Ms, MNs = [], [], [], [], [], [], []
        off = 0
        for p in self.parts:
            Ps.append(p["P"]); Ns.append(p["N"]); Cs.append(p["C"]); Ws.append(p["W"])
            Fs.append(p["F"] + off)
            if morph:
                Ms.append(p.get("M", p["P"]))
                MNs.append(p.get("MN", p["N"]))
            off += len(p["P"])
        out = dict(P=np.concatenate(Ps), N=np.concatenate(Ns), C=np.concatenate(Cs), W=np.concatenate(Ws),
                   F=np.concatenate(Fs))
        # Every triangle's front (winding) faces the way its vertex normals point, so double-sided
        # renderers (which flip the normal on back faces) light the front of a leaf correctly.
        P, F, N = out["P"], out["F"], out["N"]
        if len(F):
            geo = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
            avg = N[F[:, 0]] + N[F[:, 1]] + N[F[:, 2]]
            flip = (geo * avg).sum(1) < 0
            out["F"] = F.copy()
            out["F"][flip] = F[flip][:, [0, 2, 1]]
        if morph:
            out["M"] = np.concatenate(Ms)
            out["MN"] = np.concatenate(MNs)
        return out

    def bounds(self):
        P = np.concatenate([p["P"] for p in self.parts])
        return P.min(axis=0), P.max(axis=0)


def translate(t):
    m = np.eye(4)
    m[:3, 3] = t
    return m


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    m = np.eye(4)
    m[0, 0], m[0, 2], m[2, 0], m[2, 2] = c, s, -s, c
    return m


def scale(s):
    m = np.eye(4)
    m[0, 0], m[1, 1], m[2, 2] = (s, s, s) if np.isscalar(s) else s
    return m


def frame_matrix(origin, x, y, z):
    m = np.eye(4)
    m[:3, 0], m[:3, 1], m[:3, 2], m[:3, 3] = x, y, z, origin
    return m


# MARK: - Primitives

def polyline_frames(pts):
    """Parallel-transport frames along a polyline: tangents T, normals U, binormals V."""
    pts = np.asarray(pts, float)
    k = len(pts)
    T = np.zeros((k, 3))
    T[1:-1] = pts[2:] - pts[:-2]
    T[0] = pts[1] - pts[0]
    T[-1] = pts[-1] - pts[-2]
    T = norm(T)
    U = np.zeros((k, 3))
    U[0] = perp(T[0])
    for i in range(1, k):
        u = U[i - 1] - T[i] * (U[i - 1] @ T[i])
        if np.linalg.norm(u) < 1e-6:
            u = perp(T[i])
        U[i] = norm(u)
    V = np.cross(T, U)
    return T, U, V


def resample(pts, values, count):
    """Resample a polyline (and per-point values) to `count` evenly spaced points."""
    pts = np.asarray(pts, float)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] <= 0:
        return pts[[0] * count], [np.asarray(v)[[0] * count] for v in values]
    t = np.linspace(0, s[-1], count)
    out = np.stack([np.interp(t, s, pts[:, i]) for i in range(3)], axis=1)
    vals = []
    for v in values:
        v = np.asarray(v, float)
        if v.ndim == 1:
            vals.append(np.interp(t, s, v))
        else:
            vals.append(np.stack([np.interp(t, s, v[:, i]) for i in range(v.shape[1])], axis=1))
    return out, vals


def tube(pts, radii, sides, color=None, wind=None, cap_end=True, cap_start=False, twist=0.0,
         ring_shape=None, rng=None, color_fn=None):
    """A generalised cylinder along pts. color/wind: per-point (k,4) or a single vec4.
    ring_shape(i, angles) -> radial multipliers (k sides) for bumpy bark or buttresses.
    color_fn(points, normals, ring_index_array, angle_array) -> (n,4) to colour per vertex."""
    pts = np.asarray(pts, float)
    k = len(pts)
    radii = np.broadcast_to(np.asarray(radii, float), (k,))
    T, U, V = polyline_frames(pts)
    ang = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    P = np.zeros((k, sides, 3))
    N = np.zeros((k, sides, 3))
    for i in range(k):
        a = ang + twist * i
        mult = np.ones(sides) if ring_shape is None else ring_shape(i, a)
        d = np.cos(a)[:, None] * U[i] + np.sin(a)[:, None] * V[i]
        P[i] = pts[i] + d * (radii[i] * mult)[:, None]
        N[i] = d
    P = P.reshape(-1, 3)
    N = N.reshape(-1, 3)
    F = []
    for i in range(k - 1):
        for j in range(sides):
            a0 = i * sides + j
            a1 = i * sides + (j + 1) % sides
            b0 = a0 + sides
            b1 = a1 + sides
            F += [(a0, a1, b1), (a0, b1, b0)]
    ring = np.repeat(np.arange(k), sides)
    angles = np.tile(ang, k)

    def per_point(v):
        v = np.asarray(v, float)
        if v.ndim == 1:
            return np.tile(v, (k * sides, 1))
        return np.repeat(v, sides, axis=0)

    C = per_point(color if color is not None else np.ones(4))
    W = per_point(wind if wind is not None else np.zeros(4))
    if color_fn is not None:
        C = color_fn(P, N, ring, angles)
    extraP, extraN, extraC, extraW = [], [], [], []
    base = len(P)
    if cap_end and radii[-1] > 1e-5:
        tip = pts[-1] + T[-1] * radii[-1] * 0.6
        extraP.append(tip[None]); extraN.append(T[-1][None])
        extraC.append(C[(k - 1) * sides][None]); extraW.append(W[(k - 1) * sides][None])
        ti = base
        base += 1
        for j in range(sides):
            F.append(((k - 1) * sides + j, (k - 1) * sides + (j + 1) % sides, ti))
    if cap_start:
        extraP.append(pts[0][None]); extraN.append(-T[0][None])
        extraC.append(C[0][None]); extraW.append(W[0][None])
        si = base
        for j in range(sides):
            F.append(((j + 1) % sides, j, si))
    if extraP:
        P = np.concatenate([P] + extraP)
        N = np.concatenate([N] + extraN)
        C = np.concatenate([C] + extraC)
        W = np.concatenate([W] + extraW)
    return P, np.array(F, np.int64), N, C, W


def leaf_blade(length, width, fold=0.25, curl=0.0, wpos=0.45, segments=1):
    """A folded leaf in its own frame: base at origin, +Z along the leaf, +Y the upper side.
    segments=1: 5 vertices, 4 triangles (base, left, tip, right, raised rib point).
    segments=2: 8 vertices, 8 triangles (a rounder outline).
    Returns P, F, flutter (0 at the base -> 1 at the tip)."""
    if segments <= 0:
        # 4 vertices, 2 triangles: folded along the midrib (base -> tip), edges dropped.
        P = np.array([[0, 0, 0], [-width, -fold * width, length * wpos], [0, -curl * length, length],
                      [width, -fold * width, length * wpos]], float)
        F = np.array([[0, 2, 1], [0, 3, 2]])
        fl = np.array([0, wpos, 1, wpos])
        return P, F, fl
    if segments <= 1:
        P = np.array([[0, 0, 0], [-width, 0, length * wpos], [0, -curl * length, length],
                      [width, 0, length * wpos], [0, fold * width, length * wpos]], float)
        F = np.array([[0, 4, 1], [4, 2, 1], [0, 3, 4], [4, 3, 2]])
        fl = np.array([0, wpos, 1, wpos, wpos])
    else:
        a, b = 0.3, 0.68
        wa, wb = width * 0.85, width * 0.8
        P = np.array([[0, 0, 0],
                      [-wa, 0, length * a], [-wb, -curl * length * 0.3, length * b],
                      [0, -curl * length, length],
                      [wb, -curl * length * 0.3, length * b], [wa, 0, length * a],
                      [0, fold * width, length * a], [0, fold * width * 0.7 - curl * length * 0.3, length * b]], float)
        F = np.array([[0, 6, 1], [6, 2, 1], [6, 7, 2], [7, 3, 2],
                      [0, 5, 6], [6, 5, 4], [6, 4, 7], [7, 4, 3]])
        fl = np.array([0, a, b, 1, b, a, a, b])
    return P, F, fl


def place_frame(P, origin, fwd, up):
    """Map local (x side, y up, z forward) points into the world."""
    z = norm(fwd)
    y = norm(up - z * (up @ z))
    if np.linalg.norm(y) < 1e-6:
        y = perp(z)
    x = np.cross(y, z)
    return origin + P[:, 0:1] * x + P[:, 1:2] * y + P[:, 2:3] * z, x, y, z


def icosphere(subdiv):
    t = (1 + 5 ** 0.5) / 2
    V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
         [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6],
         [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10],
         [8, 6, 7], [9, 8, 1]]
    V = [np.array(v, float) / np.linalg.norm(v) for v in V]
    for _ in range(subdiv):
        cache = {}
        nf = []

        def mid(a, b):
            key = (min(a, b), max(a, b))
            if key not in cache:
                m = V[a] + V[b]
                V.append(m / np.linalg.norm(m))
                cache[key] = len(V) - 1
            return cache[key]

        for a, b, c in F:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]
        F = nf
    return np.array(V), np.array(F, np.int64)


def uv_sphere(rings, sides, top=True, bottom=True):
    """A latitude/longitude sphere (for domes: rings cover 0..pi)."""
    P, F = [], []
    P.append([0, 1, 0])
    for i in range(1, rings):
        th = math.pi * i / rings
        for j in range(sides):
            ph = 2 * math.pi * j / sides
            P.append([math.sin(th) * math.cos(ph), math.cos(th), math.sin(th) * math.sin(ph)])
    P.append([0, -1, 0])
    for j in range(sides):
        F.append([0, 1 + (j + 1) % sides, 1 + j])
    for i in range(rings - 2):
        for j in range(sides):
            a = 1 + i * sides + j
            b = 1 + i * sides + (j + 1) % sides
            F += [[a, b, b + sides], [a, b + sides, a + sides]]
    last = len(P) - 1
    base = 1 + (rings - 2) * sides
    for j in range(sides):
        F.append([last, base + j, base + (j + 1) % sides])
    return np.array(P, float), np.array(F, np.int64)


def disc(sides, radius=1.0, jag=None):
    """A flat fan disc in the XZ plane (normal +Y); jag (sides,) radial multipliers."""
    a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    r = radius * (np.ones(sides) if jag is None else jag)
    P = np.concatenate([[[0, 0, 0]], np.stack([np.cos(a) * r, np.zeros(sides), np.sin(a) * r], 1)])
    F = [[0, 1 + (j + 1) % sides, 1 + j] for j in range(sides)]
    return P, np.array(F, np.int64)


def grid(nx, nz, sx=1.0, sz=1.0):
    xs = np.linspace(-sx / 2, sx / 2, nx + 1)
    zs = np.linspace(-sz / 2, sz / 2, nz + 1)
    X, Z = np.meshgrid(xs, zs, indexing="ij")
    P = np.stack([X.ravel(), np.zeros(X.size), Z.ravel()], 1)
    F = []
    for i in range(nx):
        for j in range(nz):
            a = i * (nz + 1) + j
            b = a + nz + 1
            F += [[a, a + 1, b + 1], [a, b + 1, b]]
    return P, np.array(F, np.int64)


def kmeans(X, k, rng, iters=12):
    X = np.asarray(X, float)
    k = min(k, len(X))
    C = X[rng.choice(len(X), k, replace=False)]
    for _ in range(iters):
        d = np.linalg.norm(X[:, None] - C[None], axis=2)
        lab = d.argmin(1)
        for i in range(k):
            if np.any(lab == i):
                C[i] = X[lab == i].mean(0)
    return C, lab


# MARK: - Attach points

def quat_from_basis(x, y, z):
    m = np.stack([x, y, z], axis=1)
    tr = m[0, 0] + m[1, 1] + m[2, 2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        w, qx, qy, qz = 0.25 * s, (m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        w, qx, qy, qz = (m[2, 1] - m[1, 2]) / s, 0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        w, qx, qy, qz = (m[0, 2] - m[2, 0]) / s, (m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s
    else:
        s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        w, qx, qy, qz = (m[1, 0] - m[0, 1]) / s, (m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s
    q = np.array([qx, qy, qz, w])
    return q / np.linalg.norm(q)


def attach(tag, p, n, f, size, **extra):
    """One perch: `n` is the animal's up (the surface normal), `f` its forward along
    the surface, `q` the rotation taking local +Y to n and +Z to f. size = the range of
    body lengths (m) that fit there."""
    n = norm(n)
    f = np.asarray(f, float) - n * (np.asarray(f, float) @ n)
    if np.linalg.norm(f) < 1e-6:
        f = perp(n)
    f = norm(f)
    x = np.cross(n, f)
    q = quat_from_basis(x, n, f)
    r = lambda v, d=3: [round(float(a), d) for a in v]
    row = {"tag": tag, "p": r(p), "n": r(n), "f": r(f), "q": r(q, 4),
           "size": [round(float(size[0]), 3), round(float(size[1]), 3)]}
    row.update(extra)
    return row


def thin(points, count, rng):
    """Keep at most `count` attach points, spread out (farthest-point sampling)."""
    if len(points) <= count:
        return points
    P = np.array([a["p"] for a in points])
    chosen = [int(rng.integers(len(points)))]
    d = np.linalg.norm(P - P[chosen[0]], axis=1)
    while len(chosen) < count:
        i = int(d.argmax())
        chosen.append(i)
        d = np.minimum(d, np.linalg.norm(P - P[i], axis=1))
    return [points[i] for i in sorted(chosen)]


# MARK: - glTF binary

def _pad(b, fill=b"\x00"):
    return b + fill * ((4 - len(b) % 4) % 4)


def write_glb(path, mesh, name, double_sided=True, roughness=0.88, target_names=None):
    d = mesh.finalize()
    P = d["P"].astype(np.float32)
    N = d["N"].astype(np.float32)
    C = srgb_to_linear(np.clip(d["C"], 0, 1))
    C[:, 3] = np.clip(d["C"][:, 3], 0, 1)
    C = np.round(C * 255).astype(np.uint8)
    W = np.round(np.clip(d["W"], 0, 1) * 255).astype(np.uint8)
    F = d["F"]
    nv = len(P)
    idx = F.astype(np.uint32 if nv > 65535 else np.uint16).ravel()
    blobs, views, accessors = [], [], []
    offset = 0

    def add_view(data, target):
        nonlocal offset
        raw = _pad(data.tobytes())
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data.tobytes()), "target": target})
        blobs.append(raw)
        offset += len(raw)
        return len(views) - 1

    def add_acc(arr, typ, ctype, target, minmax=False):
        v = add_view(arr, target)
        acc = {"bufferView": v, "componentType": ctype, "count": int(arr.shape[0] if arr.ndim > 1 else arr.size),
               "type": typ}
        if ctype == 5121 and target == 34962:
            acc["normalized"] = True
        if minmax:
            acc["min"] = [float(x) for x in arr.min(axis=0)]
            acc["max"] = [float(x) for x in arr.max(axis=0)]
        accessors.append(acc)
        return len(accessors) - 1

    attrs = {"POSITION": add_acc(P, "VEC3", 5126, 34962, True), "NORMAL": add_acc(N, "VEC3", 5126, 34962),
             "COLOR_0": add_acc(C, "VEC4", 5121, 34962), "COLOR_1": add_acc(W, "VEC4", 5121, 34962)}
    ind = add_acc(idx, "SCALAR", 5125 if idx.dtype == np.uint32 else 5123, 34963)
    accessors[ind]["count"] = int(idx.size)
    prim = {"attributes": attrs, "indices": ind, "material": 0, "mode": 4}
    mesh_json = {"name": name, "primitives": [prim]}
    if "M" in d:
        dp = (d["M"] - d["P"]).astype(np.float32)
        dn = (d["MN"] - d["N"]).astype(np.float32)
        prim["targets"] = [{"POSITION": add_acc(dp, "VEC3", 5126, 34962, True), "NORMAL": add_acc(dn, "VEC3", 5126, 34962)}]
        mesh_json["weights"] = [0.0]
        mesh_json["extras"] = {"targetNames": target_names or ["closed"]}
    gltf = {"asset": {"version": "2.0", "generator": "AnimalDex ark-assets (scripts/ark-assets)"},
            "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"name": name, "mesh": 0}],
            "meshes": [mesh_json],
            "materials": [{"name": "ark_vertex_colour", "doubleSided": bool(double_sided),
                           "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0.0,
                                                    "roughnessFactor": roughness}}],
            "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": offset}]}
    js = _pad(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    bin_ = b"".join(blobs)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A))
        fh.write(js)
        fh.write(struct.pack("<II", len(bin_), 0x004E4942))
        fh.write(bin_)
    return {"tris": int(len(F)), "verts": int(nv)}


# MARK: - Asset

class Asset:
    def __init__(self, set_, kind, variant, lods, card=None, attach=None, meta=None, double_sided=True,
                 lod_distances=None):
        self.set = set_
        self.kind = kind
        self.variant = variant
        self.lods = lods
        self.card = card
        self.attach = attach or []
        self.meta = meta or {}
        self.double_sided = double_sided
        self.lod_distances = lod_distances

    @property
    def id(self):
        return f"{self.kind}-{self.variant}"
