/**
 * What a felled tree leaves (p5 humans quality pass): once it is down, the tree's own mesh goes (its buttressed foot
 * stays as the stump: `forest-render.ts`) and the trunk above the cut lies where it fell, a bark log with its pale cut
 * ends and growth rings, its crown's limbs cut off and lying at its top end with the wilting leaves. Fresh sawdust round
 * each stump. As the logs are hauled, the crew stacks them, bucked into lengths, in a neat pile at the stand's edge, which
 * stays until the planting crew comes (trucked away). Instanced draws, filled each frame from the shared Ark day.
 */

import {BufferAttribute, BufferGeometry, Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3} from "three";
import {cutDay, forestUnit, HAUL_DAYS, inStand, PLANT_FROM, plantDay, type Logging} from "@/ark-scene/positions/forestry";
import {fallHeading, FALL_DAYS} from "@/ark-scene/forestry/forest-state";
import type {GroundAt, StandTree} from "@/ark-scene/forestry/forest-render";

const MAX_LOGS = 120;
const MAX_LIMBS = 600;
const MAX_LEAVES = 1400;
const MAX_DUST = 160;
const MAX_PILE = 60;
/** The pile's rows, bottom up (pieces per row). */
const PILE_ROWS = [7, 6, 5, 4, 3, 2, 1];
/** A bucked length in the pile (m) and its radius. */
const PIECE_LEN = 2.6;
const PIECE_R = 0.26;
/** Pieces each hauled tree adds to the pile. */
const PIECES_PER_TREE = 3;
/** The log's top end radius as a share of its butt's. */
const TAPER = 0.72;

/** A share of the tree's height that is clear trunk below its crown: the log's length. */
export function logLength(height: number): number {
    return Math.max(height * 0.58, 1.5);
}

/** A log of unit length along +x and unit radius at its butt (x = 0), tapering to `TAPER` at its top: bark round it, the cut ends' rings. */
export function logGeometry(): BufferGeometry {
    const sides = 14;
    const positions: number[] = [];
    const colours: number[] = [];
    const index: number[] = [];
    // (Grey-brown, as the island's trunks: furrows darker.)
    const bark = new Color("#7a6c5c");
    const barkDark = new Color("#4a3f34");
    const c = new Color();
    const push = (x: number, y: number, z: number, col: Color) => {
        positions.push(x, y, z);
        colours.push(col.r, col.g, col.b);
        return positions.length / 3 - 1;
    };
    // The bark (three rings along, a little uneven: furrows by vertex colour).
    const along = [0, 0.5, 1];
    const base = positions.length / 3;
    for (const x of along) {
        const r = 1 + (TAPER - 1) * x;
        for (let s = 0; s <= sides; s++) {
            const a = (s / sides) * Math.PI * 2;
            const furrow = 0.96 + 0.04 * Math.sin(a * 7 + x * 3);
            c.copy(bark).lerp(barkDark, 0.5 + 0.5 * Math.sin(a * 11 + x * 5));
            push(x, Math.cos(a) * r * furrow, Math.sin(a) * r * furrow, c);
        }
    }
    for (let i = 0; i < along.length - 1; i++) {
        for (let s = 0; s < sides; s++) {
            const a = base + i * (sides + 1) + s;
            const b = a + sides + 1;
            index.push(a, a + 1, b, a + 1, b + 1, b);
        }
    }
    // The cut ends: the pale sapwood, rings darker toward the heart, a thin bark rim.
    const rings: Array<[number, string]> = [[0, "#9c7444"], [0.3, "#caa46c"], [0.45, "#b88f58"], [0.62, "#d9ba84"], [0.8, "#cfab74"], [0.93, "#e2c995"], [1, "#4e3b2a"]];
    for (const end of [0, 1]) {
        const r0 = end ? TAPER : 1;
        const start = positions.length / 3;
        for (const [rr, colour] of rings) {
            c.set(colour);
            if (rr === 0) {
                push(end, 0, 0, c);
                continue;
            }
            for (let s = 0; s < sides; s++) {
                const a = (s / sides) * Math.PI * 2;
                push(end, Math.cos(a) * r0 * rr, Math.sin(a) * r0 * rr, c);
            }
        }
        for (let s = 0; s < sides; s++) {
            const a = start + 1 + s, b = start + 1 + ((s + 1) % sides);
            if (end) index.push(start, a, b);
            else index.push(start, b, a);
        }
        for (let ring = 1; ring < rings.length - 1; ring++) {
            for (let s = 0; s < sides; s++) {
                const a = start + 1 + (ring - 1) * sides + s;
                const b = start + 1 + (ring - 1) * sides + ((s + 1) % sides);
                const a2 = a + sides, b2 = b + sides;
                if (end) index.push(a, a2, b2, a, b2, b);
                else index.push(a, b2, a2, a, b, b2);
            }
        }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
}

/** A limb: unit length along +x, unit radius at its foot, tapering to a point-ish end. */
function limbGeometry(): BufferGeometry {
    const g = logGeometry();
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const k = 1 - 0.7 * x;
        p.setY(i, p.getY(i) * k);
        p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
}

/** Sawdust: a thin disc with a ragged rim (unit radius), pale. */
function dustGeometry(): BufferGeometry {
    const spokes = 16;
    const positions: number[] = [0, 0.02, 0];
    const colours: number[] = [];
    const pale = new Color("#d8bf8c");
    const dark = new Color("#a98a5c");
    colours.push(pale.r, pale.g, pale.b);
    const index: number[] = [];
    const c = new Color();
    for (let ring = 1; ring <= 2; ring++) {
        for (let s = 0; s < spokes; s++) {
            const a = (s / spokes) * Math.PI * 2;
            const r = ring === 1 ? 0.55 : 0.85 + 0.25 * Math.sin(a * 5) * Math.cos(a * 3);
            positions.push(Math.cos(a) * r, ring === 1 ? 0.015 : 0, Math.sin(a) * r);
            c.copy(pale).lerp(dark, ring === 1 ? 0.15 : 0.55);
            colours.push(c.r, c.g, c.b);
        }
    }
    for (let s = 0; s < spokes; s++) index.push(0, 1 + ((s + 1) % spokes), 1 + s);
    for (let s = 0; s < spokes; s++) {
        const a = 1 + s, b = 1 + ((s + 1) % spokes);
        index.push(a, b, b + spokes, a, b + spokes, a + spokes);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
}

/** A clump of leaves: a ragged ball (a subdivided icosahedron pushed in and out), unit size. */
function clumpGeometry(): BufferGeometry {
    const g = new IcosahedronGeometry(1, 1);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const k = 0.7 + 0.45 * Math.abs(Math.sin(x * 9.1 + y * 5.3) * Math.cos(z * 7.7 - y * 3.1));
        pos.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return g;
}

const m = new Matrix4();
const p = new Vector3();
const s = new Vector3();
const q = new Quaternion();
const q2 = new Quaternion();
const xAxis = new Vector3(1, 0, 0);
const yAxis = new Vector3(0, 1, 0);
const zAxis = new Vector3(0, 0, 1);
const leafFresh = new Color("#46632a");
const leafDry = new Color("#7d6a3c");
const leafColour = new Color();

function mesh(geometry: BufferGeometry, material: MeshStandardMaterial, max: number, name: string): InstancedMesh {
    const im = new InstancedMesh(geometry, material, max);
    im.count = 0;
    im.frustumCulled = false;
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = name;
    return im;
}

export class ForestLogs {
    readonly group = new Group();
    private readonly material = new MeshStandardMaterial({vertexColors: true, roughness: 0.92});
    private readonly leafMaterial = new MeshStandardMaterial({color: 0xffffff, roughness: 0.9});
    private readonly dustMaterial = new MeshStandardMaterial({vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3});
    private readonly logs: InstancedMesh;
    private readonly limbs: InstancedMesh;
    private readonly leaves: InstancedMesh;
    private readonly dust: InstancedMesh;
    private readonly pile: InstancedMesh;

    constructor(private readonly ground: GroundAt) {
        const log = logGeometry();
        this.logs = mesh(log, this.material, MAX_LOGS, "forest-logs");
        this.pile = mesh(log, this.material, MAX_PILE, "forest-log-pile");
        this.limbs = mesh(limbGeometry(), this.material, MAX_LIMBS, "forest-limbs");
        this.leaves = mesh(clumpGeometry(), this.leafMaterial, MAX_LEAVES, "forest-slash");
        this.dust = mesh(dustGeometry(), this.dustMaterial, MAX_DUST, "forest-sawdust");
        this.dust.castShadow = false;
        this.group.add(this.logs, this.pile, this.limbs, this.leaves, this.dust);
    }

    /** A frame: the stands in play at `day` and their trees. */
    update(loggings: readonly Logging[], trees: readonly StandTree[], day: number) {
        let logs = 0, limbs = 0, leaves = 0, dust = 0;
        for (const t of trees) {
            let g: Logging | null = null;
            for (const l of loggings) if (inStand(l, t.x, t.z)) g = l;
            if (!g) continue;
            const cut = cutDay(g, t.x, t.z);
            if (day < cut) continue;
            const planted = plantDay(g, t.x, t.z);
            if (day >= planted) continue;
            const gy = this.ground(t.x, t.z);
            const unit = (k: string) => forestUnit(`${k}#${g!.k}#${Math.round(t.x * 10)}#${Math.round(t.z * 10)}`);
            // Sawdust round the fresh stump (on the feller's side), until the planters grub it out.
            if (dust < MAX_DUST) {
                const away = fallHeading(g, t.x, t.z) + Math.PI;
                const r = t.trunk * 1.5 + 0.25;
                q.setFromAxisAngle(yAxis, unit("dust") * Math.PI * 2);
                m.compose(p.set(t.x + Math.cos(away) * t.trunk * 0.8, gy + 0.01, t.z + Math.sin(away) * t.trunk * 0.8), q, s.set(r, 1, r * 0.8));
                this.dust.setMatrixAt(dust++, m);
            }
            if (day < cut + FALL_DAYS) continue;
            const dir = fallHeading(g, t.x, t.z);
            const cx = Math.cos(dir), cz = Math.sin(dir);
            const length = logLength(t.height);
            const r = Math.min(t.trunk, 1.1);
            const butt = t.radius * 0.55 + 0.25;
            const x0 = t.x + cx * butt, z0 = t.z + cz * butt;
            const x1 = x0 + cx * length, z1 = z0 + cz * length;
            const y0 = this.ground(x0, z0) + r, y1 = this.ground(x1, z1) + r * TAPER;
            // The log (until hauled): along its fall, lying on the ground's slope.
            if (day < cut + HAUL_DAYS && logs < MAX_LOGS) {
                q.setFromAxisAngle(yAxis, -dir);
                q.multiply(q2.setFromAxisAngle(zAxis, Math.atan2(y1 - y0, length)));
                q.multiply(q2.setFromAxisAngle(xAxis, unit("roll") * Math.PI * 2));
                m.compose(p.set(x0, y0 - r * 0.12, z0), q, s.set(length, r, r));
                this.logs.setMatrixAt(logs++, m);
            }
            // The crown's limbs, cut off where the trunk forks, splayed at its top end, and its leaves, wilting.
            const n = t.height >= 20 ? 6 : 4;
            for (let i = 0; i < n && limbs < MAX_LIMBS; i++) {
                const along = length * (0.85 + 0.25 * unit(`la${i}`));
                const side = (unit(`ls${i}`) - 0.5) * 2.4;
                const heading = dir + side;
                const bx = t.x + cx * (butt + along) + Math.cos(dir + Math.PI / 2) * side * r * 1.5;
                const bz = t.z + cz * (butt + along) + Math.sin(dir + Math.PI / 2) * side * r * 1.5;
                const len = t.height * (0.14 + 0.12 * unit(`ll${i}`));
                const lr = Math.max(r * (0.22 + 0.14 * unit(`lr${i}`)), 0.04);
                q.setFromAxisAngle(yAxis, -heading);
                q.multiply(q2.setFromAxisAngle(zAxis, 0.01 + 0.05 * unit(`lp${i}`)));
                m.compose(p.set(bx, this.ground(bx, bz) + lr * 0.8, bz), q, s.set(len, lr, lr));
                this.limbs.setMatrixAt(limbs++, m);
                // Its leaves: small ragged clumps along the limb's outer half, low on the ground.
                for (let c = 0; c < 5 && leaves < MAX_LEAVES; c++) {
                    const k = 0.35 + 0.16 * c + 0.08 * unit(`lk${i}${c}`);
                    const lx = bx + Math.cos(heading) * len * k, lz = bz + Math.sin(heading) * len * k;
                    const size = Math.min(0.28 + t.height * 0.011, 0.75) * (0.65 + 0.5 * unit(`lz${i}${c}`));
                    q.setFromAxisAngle(yAxis, unit(`lq${i}${c}`) * 6.28);
                    m.compose(p.set(lx, this.ground(lx, lz) + size * 0.3, lz), q, s.set(size * 1.3, size * 0.55, size));
                    this.leaves.setMatrixAt(leaves, m);
                    // (Green when fresh, brown over the days to planting.)
                    leafColour.copy(leafFresh).lerp(leafDry, Math.min((day - cut) / 3, 1)).multiplyScalar(0.8 + 0.35 * unit(`lc${i}${c}`));
                    this.leaves.setColorAt(leaves++, leafColour);
                }
            }
        }
        // The pile at the stand's edge: the hauled trees' logs bucked into lengths, stacked, until planting begins.
        let pieces = 0;
        for (const g of loggings) {
            if (day < g.start || day >= g.start + PLANT_FROM) continue;
            let hauled = 0;
            for (const t of trees) if (inStand(g, t.x, t.z) && day >= cutDay(g, t.x, t.z) + HAUL_DAYS) hauled++;
            const want = Math.min(hauled * PIECES_PER_TREE, PILE_ROWS.reduce((a, b) => a + b, 0));
            if (!want) continue;
            const out = Math.max(g.stand.r - 3, 2);
            const px = g.stand.x + Math.cos(g.bearing) * out, pz = g.stand.z + Math.sin(g.bearing) * out;
            const py = this.ground(px, pz);
            // The pieces lie across the way in (along the stand's edge), the rows stepping up, each row's logs in the hollows below.
            const tx = -Math.sin(g.bearing), tz = Math.cos(g.bearing);
            const rx = Math.cos(g.bearing), rz = Math.sin(g.bearing);
            let placed = 0;
            for (let row = 0; row < PILE_ROWS.length && placed < want; row++) {
                const count = PILE_ROWS[row];
                for (let i = 0; i < count && placed < want && pieces < MAX_PILE; i++) {
                    const off = (i - (count - 1) / 2) * PIECE_R * 2.02;
                    const jitter = (forestUnit(`pile#${g.k}#${row}#${i}`) - 0.5) * 0.3;
                    const x = px + rx * off - tx * (PIECE_LEN / 2 + jitter);
                    const z = pz + rz * off - tz * (PIECE_LEN / 2 + jitter);
                    q.setFromUnitVectors(xAxis, p.set(tx, 0, tz));
                    q.multiply(q2.setFromAxisAngle(xAxis, forestUnit(`pr#${g.k}#${row}#${i}`) * 6.28));
                    const r = PIECE_R * (0.85 + 0.3 * forestUnit(`ps#${g.k}#${row}#${i}`));
                    m.compose(p.set(x, py + PIECE_R + row * PIECE_R * 1.73, z), q, s.set(PIECE_LEN, r, r));
                    this.pile.setMatrixAt(pieces++, m);
                    placed++;
                }
            }
        }
        const set = (im: InstancedMesh, n: number) => {
            im.count = n;
            im.visible = n > 0;
            im.instanceMatrix.needsUpdate = true;
        };
        set(this.logs, logs);
        set(this.limbs, limbs);
        set(this.leaves, leaves);
        if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
        set(this.dust, dust);
        set(this.pile, pieces);
    }

    dispose() {
        for (const im of [this.logs, this.limbs, this.leaves, this.dust]) im.geometry.dispose();
        this.material.dispose();
        this.leafMaterial.dispose();
        this.dustMaterial.dispose();
        this.group.removeFromParent();
    }
}
