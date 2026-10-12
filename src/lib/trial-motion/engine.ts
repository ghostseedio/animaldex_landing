/**
 * Trial Loops renderer: a typed, one-to-one port of the reference renderer
 * (`AnimalDex/docs/trial-motion/trial-motion.js`, mirrored in
 * `__fixtures__/reference-renderer.cjs`). Same compile step, same keyframes,
 * same easing, same draw order (floor → under → things → people → over →
 * widgets), same stage fade at the loop seam. If this file and the reference
 * disagree, the reference is right; `trial-motion.test.ts` compares the two
 * attribute for attribute.
 *
 * The only structural change: the reference builds SVG with `document`. This
 * port builds through a `MotionDoc`, so the same code drives the live DOM in
 * the browser and a virtual tree for the server-rendered poster and tests.
 *
 * Vocabulary and glyphs are passed in, never imported here, so the 30 KB glyph
 * table only loads where a loop actually renders.
 */

import type {TrialMotionEvent, TrialMotionFigureActor, TrialMotionItemActor, TrialMotionListActor, TrialMotionPileActor, TrialStoryboard} from "./storyboard";

export type TrialMotionVocabulary = {
    stage: {width: number; height: number; floorY: number};
    colors: Record<string, string>;
    timing: Record<string, number>;
    figure: {strokeWidth: number; headRadius: number; bones: number[][]; poses: Record<string, number[][]>};
    itemSizes: Record<string, number>;
    pile: {maxCols: number; cellW: number; cellH: number; tile: number; defaultCenterY: number};
    list: {maxSpacing: number; span: number; tile: number; defaultY: number};
};

export type TrialMotionGlyphs = {glyphs: Record<string, string>};

/** How the renderer makes and changes nodes. */
export type MotionDoc<N> = {
    create(tag: string): N;
    append(parent: N, child: N): void;
    set(node: N, name: string, value: string | number): void;
    text(node: N, value: string | number): void;
};

type Attrs = Record<string, string | number>;

export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const ease = (v: number) => {
    v = clamp(v);
    return v * v * (3 - 2 * v);
};
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * Ring labels: a total under 100 s counts in seconds; longer totals count in whole minutes
 * ("20m"), and 6000 s or more in whole hours ("2h"), so four-digit seconds never overflow the ring.
 */
export function ringLabel(total: number, v: number) {
    if (total < 100) return String(v);
    if (total < 6000) return Math.floor(v / 60) + "m";
    return Math.floor(v / 3600) + "h";
}

/* ------------------------------------------------------------------ figures */

export type FigureKeyframe = {t: number; pose: string; x: number; y: number; o: number; facing: number};

export type FigureSample = {joints: number[][]; x: number; y: number; o: number; facing: number};

function allEvents(sb: TrialStoryboard): TrialMotionEvent[] {
    return sb.beats.reduce<TrialMotionEvent[]>((all, beat) => all.concat(beat.events || []), []);
}

/**
 * Keyframes {t, pose, x, y, o, facing}. Between two keyframes x/y are linear and
 * pose/opacity are eased; facing switches at the later keyframe.
 */
export function compileFigure(sb: TrialStoryboard, id: string, V: TrialMotionVocabulary): FigureKeyframe[] {
    const a = sb.actors[id] as TrialMotionFigureActor;
    const T = V.timing;
    const start: FigureKeyframe = {t: 0, pose: a.pose || "stand", x: a.x, y: 0, o: a.hidden ? 0 : 1, facing: a.facing === "left" ? -1 : 1};
    const kf: FigureKeyframe[] = [start];
    const last = () => kf[kf.length - 1];
    const push = (t: number, patch: Partial<FigureKeyframe>) => kf.push({...last(), ...patch, t});
    const evs = allEvents(sb).filter((e) => e.actor === id).sort((p, q) => p.at - q.at);
    for (const e of evs) {
        switch (e.type) {
            case "pose":
                push(e.at, {});
                push(e.at + (e.dur ?? T.poseDur), {pose: e.pose});
                break;
            case "move": {
                const to = e.to as number;
                const dur = e.dur as number;
                const x0 = last().x, dir = Math.sign(to - x0) || last().facing;
                const step = e.gait === "run" ? T.runStep : T.walkStep;
                const prefix = e.gait === "run" ? "run_" : "walk_";
                const n = Math.max(1, Math.round(dur / step));
                push(e.at, {facing: dir});
                for (let i = 1; i <= n; i++) push(e.at + (i / n) * dur, {pose: prefix + (i % 2 ? "a" : "b"), x: lerp(x0, to, i / n)});
                push(e.at + dur + 0.25, {pose: "stand"});
                break;
            }
            case "jump": {
                const dx = e.dx as number;
                const x0 = last().x, dur = T.jumpDur, h = 30 + Math.abs(dx) * 0.12;
                push(e.at, {facing: Math.sign(dx) || last().facing});
                for (let i = 1; i <= 10; i++) {
                    const p = i / 10;
                    push(e.at + p * dur, {pose: p < 0.9 ? "air" : "squat", x: lerp(x0, x0 + dx, p), y: -h * 4 * p * (1 - p)});
                }
                push(e.at + dur + T.jumpSettle, {pose: "stand"});
                break;
            }
            case "reset":
                push(e.at, {});
                push(e.at + 0.25, {o: 0});
                push(e.at + 0.3, {x: a.x, pose: a.pose || "stand", facing: start.facing});
                push(e.at + 0.55, {o: 1});
                break;
            case "show":
                push(e.at, {});
                push(e.at + T.popDur, {o: 1});
                break;
            case "hide":
                push(e.at, {});
                push(e.at + T.popDur, {o: 0});
                break;
        }
    }
    // Array#sort is stable, as the reference relies on.
    kf.sort((p, q) => p.t - q.t);
    return kf;
}

export function sampleFigure(kf: FigureKeyframe[], t: number, V: TrialMotionVocabulary): FigureSample {
    let i = 0;
    while (i < kf.length - 1 && kf[i + 1].t <= t) i++;
    const k0 = kf[i], k1 = kf[Math.min(i + 1, kf.length - 1)];
    const p = k1.t > k0.t ? clamp((t - k0.t) / (k1.t - k0.t)) : 1;
    const q = ease(p);
    const A = V.figure.poses[k0.pose], B = V.figure.poses[k1.pose];
    const facing = p >= 1 ? k1.facing : k0.facing;
    const joints = A.map((j, n) => [lerp(j[0], B[n][0], q) * facing, lerp(j[1], B[n][1], q)]);
    return {joints, x: lerp(k0.x, k1.x, p), y: lerp(k0.y, k1.y, p), o: lerp(k0.o, k1.o, q), facing};
}

/* -------------------------------------------------------------------- shared */

/** Opacity and pop scale from show/hide events, starting from `hidden`. */
function visibility(evs: TrialMotionEvent[], t: number, hidden: boolean | undefined, popDur: number) {
    let v = hidden ? 0 : 1, s = 1;
    for (const e of evs) {
        if (e.type !== "show" && e.type !== "hide") continue;
        if (t < e.at) break;
        const p = ease((t - e.at) / popDur);
        if (e.type === "show") {
            v = lerp(v, 1, p);
            s = 0.6 + 0.4 * p;
        } else {
            v = lerp(v, 0, p);
            s = 1;
        }
    }
    return {v, s};
}

const range = (n: number) => Array.from({length: n}, (_, i) => i);

export type TrialMotionScene = {
    /** Paint the frame at `t` seconds (any value; wraps by the loop). */
    draw(t: number): void;
    /** Which caption is active at `t`. */
    beatIndexAt(t: number): number;
    /** The still frame for Reduce Motion. */
    poster: number;
    loop: number;
};

/**
 * Builds the stage inside `svg` (which must be empty) and paints the poster
 * frame. Port of the reference `create`.
 */
export function createTrialMotionScene<N>(
    doc: MotionDoc<N>,
    svg: N,
    sb: TrialStoryboard,
    V: TrialMotionVocabulary,
    G: TrialMotionGlyphs
): TrialMotionScene {
    const el = (tag: string, attrs: Attrs, parent?: N) => {
        const e = doc.create(tag);
        for (const k in attrs) doc.set(e, k, attrs[k]);
        if (parent) doc.append(parent, e);
        return e;
    };
    const set = (node: N, name: string, value: string | number) => doc.set(node, name, value);

    const glyphGroup = (parent: N, name: string, size: number, color: string, sw?: number) => {
        const g = el("g", {}, parent);
        const k = size / 24;
        el("path", {
            d: G.glyphs[name] || "", fill: "none", stroke: color, "stroke-width": (sw ?? 2) / 1, "stroke-linecap": "round",
            "stroke-linejoin": "round", transform: `scale(${k}) translate(-12 -12)`, "vector-effect": "none"
        }, g);
        return g;
    };

    const checkBadge = (parent: N) => {
        const g = el("g", {opacity: 0}, parent);
        el("circle", {r: 8, fill: V.colors.lime}, g);
        el("path", {d: "M-4 0 l3 3 l5 -6", fill: "none", stroke: V.colors.dark, "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round"}, g);
        return g;
    };

    set(svg, "viewBox", `0 0 ${V.stage.width} ${V.stage.height}`);
    const C = V.colors, T = V.timing, FLOOR = V.stage.floorY;
    const evs = allEvents(sb).slice().sort((p, q) => p.at - q.at);
    const root = el("g", {}, svg);
    const layers = {
        floor: el("g", {}, root), under: el("g", {}, root), things: el("g", {}, root), people: el("g", {}, root),
        over: el("g", {}, root), widgets: el("g", {}, root)
    };
    const updaters: Array<(t: number) => void> = [];
    const figures: Record<string, {kf: FigureKeyframe[]; state: (t: number) => FigureSample & {P: number[][]}; color: string}> = {};
    const centers: Record<string, (t: number) => number[]> = {};

    // ---- figures first: other actors and events anchor to them
    const figIds = Object.keys(sb.actors).filter((id) => sb.actors[id].kind === "figure");
    if (figIds.length) el("line", {x1: 14, x2: V.stage.width - 14, y1: FLOOR, y2: FLOOR, stroke: C.floor, "stroke-width": 1.5}, layers.floor);
    for (const id of figIds) {
        const a = sb.actors[id] as TrialMotionFigureActor;
        const kf = compileFigure(sb, id, V);
        const color = a.tone === "other" ? C.other : C.ink;
        const g = el("g", {}, layers.people);
        const S = {stroke: color, "stroke-width": V.figure.strokeWidth, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none"};
        const bones = V.figure.bones.map(() => el("polyline", S, g));
        const head = el("circle", {r: V.figure.headRadius, fill: color}, g);
        const badge = checkBadge(layers.over);
        const ring = el("circle", {r: 44, fill: "none", stroke: C.lime, "stroke-width": 2.5, opacity: 0}, layers.under);
        const myEvs = evs.filter((e) => e.actor === id);
        const state = (t: number) => {
            const f = sampleFigure(kf, t, V);
            const P = f.joints.map(([x, y]) => [f.x + x, FLOOR + f.y + y]);
            return {...f, P};
        };
        figures[id] = {kf, state, color};
        centers[id] = (t) => {
            const f = state(t);
            return [f.x, FLOOR + f.y - 50];
        };
        updaters.push((t) => {
            const f = state(t);
            V.figure.bones.forEach((ix, n) => set(bones[n], "points", ix.map((i) => f.P[i].join(",")).join(" ")));
            set(head, "cx", f.P[0][0]);
            set(head, "cy", f.P[0][1]);
            set(g, "opacity", f.o);
            const ck = myEvs.filter((e) => e.type === "check" && e.at <= t).pop();
            set(badge, "opacity", ck ? ease((t - ck.at) / 0.25) * f.o : 0);
            set(badge, "transform", `translate(${f.P[0][0]} ${f.P[0][1] - 24})`);
            const pu = myEvs.find((e) => e.type === "pulse" && t >= e.at && t <= (e.until as number) + 0.3);
            set(ring, "opacity", pu ? (0.35 + 0.35 * Math.sin(((t - pu.at) * 2 * Math.PI) / 0.8)) * (1 - ease((t - (pu.until as number)) / 0.3)) * f.o : 0);
            set(ring, "cx", f.x);
            set(ring, "cy", FLOOR + f.y - 45);
        });

        // hold: countdown ring above the head
        for (const h of myEvs.filter((e) => e.type === "hold")) {
            const until = h.until as number, seconds = h.seconds as number;
            const rg = el("g", {opacity: 0}, layers.over);
            const L = 2 * Math.PI * 15;
            el("circle", {r: 15, fill: "rgba(7,16,11,.85)", stroke: "rgba(167,244,50,.25)", "stroke-width": 3}, rg);
            const arc = el("circle", {r: 15, fill: "none", stroke: C.lime, "stroke-width": 3, "stroke-linecap": "round", transform: "rotate(-90)", "stroke-dasharray": L}, rg);
            const num = el("text", {y: 4.5, "text-anchor": "middle", fill: C.ink, "font-size": 13, "font-weight": 800, "font-family": "ui-monospace, Menlo, monospace"}, rg);
            updaters.push((t) => {
                const on = t >= h.at - 0.15 && t <= until + 0.2;
                set(rg, "opacity", on ? 1 : 0);
                if (!on) return;
                const f = state(t), p = clamp((t - h.at) / (until - h.at));
                set(rg, "transform", `translate(${f.P[0][0] - 2} ${f.P[0][1] - 30})`);
                set(arc, "stroke-dashoffset", L * p);
                doc.text(num, ringLabel(seconds, Math.max(1, Math.ceil(seconds * (1 - p)))));
            });
        }

        // holding: a glyph in the front hand
        for (const h of myEvs.filter((e) => e.type === "holding")) {
            const until = h.until as number;
            const hg = el("g", {opacity: 0}, layers.over);
            glyphGroup(hg, h.glyph as string, 18, C.ink, 2.2);
            updaters.push((t) => {
                const f = state(t);
                const v = ease((t - h.at) / T.popDur) * (1 - ease((t - until) / T.popDur));
                set(hg, "opacity", v * f.o);
                set(hg, "transform", `translate(${f.P[10][0] + 4 * f.facing} ${f.P[10][1] - 10})`);
            });
        }

        // bubble: speech or thought, above the head on the facing side
        for (const b of myEvs.filter((e) => e.type === "bubble")) {
            const until = b.until as number;
            const bg = el("g", {opacity: 0}, layers.over);
            const thought = b.style === "thought";
            el("rect", {x: -18, y: -15, width: 36, height: 30, rx: thought ? 15 : 9, fill: C.dark, stroke: C.ink, "stroke-width": 2}, bg);
            const tail = thought
                ? [el("circle", {r: 3.2, fill: C.dark, stroke: C.ink, "stroke-width": 1.6}, bg), el("circle", {r: 2, fill: C.dark, stroke: C.ink, "stroke-width": 1.4}, bg)]
                : [el("path", {d: "M-6 14 L-12 22 L2 14", fill: C.dark, stroke: C.ink, "stroke-width": 2, "stroke-linejoin": "round"}, bg)];
            glyphGroup(bg, b.glyph as string, 18, C.lime, 2.2);
            updaters.push((t) => {
                const f = state(t);
                const p = ease((t - b.at) / T.popDur), q = 1 - ease((t - until) / T.popDur);
                set(bg, "opacity", p * q * f.o);
                const s = 0.7 + 0.3 * p;
                const bx = f.P[0][0] + 24 * f.facing, by = f.P[0][1] - 26;
                set(bg, "transform", `translate(${bx} ${by}) scale(${f.facing * s} ${s})`);
                if (thought) {
                    set(tail[0], "cx", -14);
                    set(tail[0], "cy", 18);
                    set(tail[1], "cx", -20);
                    set(tail[1], "cy", 24);
                }
            });
        }
    }

    // ---- items
    for (const [id, actor] of Object.entries(sb.actors)) {
        if (actor.kind !== "item") continue;
        const a = actor as TrialMotionItemActor;
        const myEvs = evs.filter((e) => e.actor === id);
        const size = V.itemSizes[a.size || "m"];
        const g = el("g", {}, layers.things);
        const pulse = el("circle", {r: size * 0.78, fill: "none", stroke: C.lime, "stroke-width": 2.5, opacity: 0}, g);
        if (a.tile !== false) el("rect", {x: -size / 2, y: -size / 2, width: size, height: size, rx: size * 0.2, fill: C.tile, stroke: C.tileStroke}, g);
        // one glyph layer per distinct glyph the item ever shows (transform crossfades)
        const names = [a.glyph, ...myEvs.filter((e) => e.type === "transform").map((e) => e.glyph as string)];
        const gl = names.map((n) => glyphGroup(g, n, size * 0.62, C.ink, 2));
        const strike = el("line", {x1: -size * 0.55, y1: size * 0.55, x2: size * 0.55, y2: -size * 0.55, stroke: C.cross, "stroke-width": 3, "stroke-linecap": "round", opacity: 0}, g);
        const badge = checkBadge(g);
        set(badge, "transform", `translate(${size / 2 - 2} ${-size / 2 + 2})`);
        const pos = (t: number) => {
            let x = a.x, y = a.y;
            for (const e of myEvs) {
                if (e.type !== "slide" || t < e.at) continue;
                const p = ease((t - e.at) / (e.dur ?? T.slideDur));
                x = lerp(x, e.x as number, p);
                y = lerp(y, e.y as number, p);
            }
            return [x, y];
        };
        centers[id] = pos;
        updaters.push((t) => {
            const [x, y] = pos(t);
            const {v, s} = visibility(myEvs, t, a.hidden, T.popDur);
            const tr = myEvs.filter((e) => e.type === "transform");
            let bump = 1;
            gl.forEach((layer, n) => {
                // layer n is visible after transform n-1 and before transform n
                const pin = n === 0 ? 1 : ease((t - tr[n - 1].at) / T.transformDur);
                const pout = n < tr.length ? ease((t - tr[n].at) / T.transformDur) : 0;
                set(layer, "opacity", pin * (1 - pout));
            });
            for (const e of tr) if (t >= e.at && t <= e.at + T.transformDur) bump = 1 + 0.15 * Math.sin(Math.PI * (t - e.at) / T.transformDur);
            const cr = myEvs.filter((e) => e.type === "cross" && e.at <= t).pop();
            const cp = cr ? ease((t - cr.at) / 0.25) : 0;
            set(strike, "opacity", cp);
            const ck = myEvs.filter((e) => e.type === "check" && e.at <= t).pop();
            set(badge, "opacity", ck ? ease((t - ck.at) / 0.25) : 0);
            const pu = myEvs.find((e) => e.type === "pulse" && t >= e.at && t <= (e.until as number) + 0.3);
            set(pulse, "opacity", pu ? (0.35 + 0.35 * Math.sin(((t - pu.at) * 2 * Math.PI) / 0.8)) * (1 - ease((t - (pu.until as number)) / 0.3)) : 0);
            set(g, "opacity", v * (1 - 0.6 * cp));
            set(g, "transform", `translate(${x} ${y}) scale(${s * bump})`);
        });
    }

    // ---- piles
    for (const [id, actor] of Object.entries(sb.actors)) {
        if (actor.kind !== "pile") continue;
        const a = actor as TrialMotionPileActor;
        const P = V.pile, myEvs = evs.filter((e) => e.actor === id);
        const n = a.count, cols = Math.min(P.maxCols, n), rows = Math.ceil(n / cols);
        const cy = a.y ?? P.defaultCenterY;
        const cell = (i: number) => [V.stage.width / 2 - ((cols - 1) * P.cellW) / 2 + (i % cols) * P.cellW, cy - ((rows - 1) * P.cellH) / 2 + Math.floor(i / cols) * P.cellH];
        const glyphOf = (i: number) => a.glyphs[i % a.glyphs.length];
        const stack = myEvs.find((e) => e.type === "stack");
        const discard = myEvs.find((e) => e.type === "discard");
        const keep = myEvs.find((e) => e.type === "keep");
        const sort = myEvs.find((e) => e.type === "sort");
        const kept = discard ? (discard.keep as number[]) : [];
        const gone = range(n).filter((i) => discard && !kept.includes(i)).sort((p, q) => ((p * 7) % 12) - ((q * 7) % 12));
        // sort: the slot each tile moves to so equal glyphs sit together
        const sortedSlot: Record<number, number> = {};
        range(n).sort((p, q) => a.glyphs.indexOf(glyphOf(p)) - a.glyphs.indexOf(glyphOf(q)) || p - q).forEach((i, slot) => (sortedSlot[i] = slot));
        const group = el("g", {}, layers.things);
        const tiles = range(n).map((i) => {
            const tg = el("g", {}, group);
            el("rect", {x: -P.tile / 2, y: -P.tile / 2, width: P.tile, height: P.tile, rx: 7, fill: C.tile, stroke: C.tileStroke}, tg);
            glyphGroup(tg, glyphOf(i), 22, C.ink, 2);
            const badge = checkBadge(tg);
            set(badge, "transform", `translate(${P.tile / 2 - 2} ${-P.tile / 2 + 2})`);
            const out = discard && !kept.includes(i)
                ? discard.at + gone.indexOf(i) * (((discard.until as number) - discard.at) / gone.length)
                : null;
            return {tg, badge, out};
        });
        centers[id] = () => [V.stage.width / 2, cy];
        updaters.push((t) => {
            const {v} = visibility(myEvs, t, a.hidden, T.popDur);
            set(group, "opacity", v);
            tiles.forEach((tile, i) => {
                let [x, y] = cell(i);
                if (sort) {
                    const p = ease((t - sort.at) / (sort.dur ?? T.sortDur));
                    const [sx, sy] = cell(sortedSlot[i]);
                    x = lerp(x, sx, p);
                    y = lerp(y, sy, p);
                }
                const inP = stack ? ease((t - stack.at - (i * ((stack.until as number) - stack.at)) / n) / T.popDur) : 1;
                let s = 0.6 + 0.4 * inP, o = inP;
                if (tile.out !== null) {
                    const p = ease((t - tile.out) / 0.32);
                    x += 30 * p;
                    y -= 26 * p;
                    s *= 1 - 0.4 * p;
                    o *= 1 - p;
                } else {
                    if (keep) {
                        const k = ease((t - keep.at) / T.keepDur);
                        const slot = kept.indexOf(i), m = kept.length;
                        const tx = V.stage.width / 2 + (slot - (m - 1) / 2) * 68;
                        x = lerp(x, tx, k);
                        y = lerp(y, cy + 8, k);
                        s *= 1 + 0.4 * k;
                        set(tile.badge, "opacity", ease((t - keep.at - 0.4) / 0.25));
                    }
                }
                if (!(keep && tile.out === null)) set(tile.badge, "opacity", 0);
                set(tile.tg, "transform", `translate(${x} ${y}) scale(${s})`);
                set(tile.tg, "opacity", o);
            });
        });
    }

    // ---- lists
    for (const [id, actor] of Object.entries(sb.actors)) {
        if (actor.kind !== "list") continue;
        const a = actor as TrialMotionListActor;
        const L = V.list, myEvs = evs.filter((e) => e.actor === id);
        const n = a.glyphs.length, gap = Math.min(L.maxSpacing, L.span / Math.max(1, n - 1));
        const y = a.y ?? L.defaultY;
        const xs = a.glyphs.map((_, i) => V.stage.width / 2 + (i - (n - 1) / 2) * gap);
        const group = el("g", {}, layers.things);
        for (let i = 0; i < n - 1; i++) el("line", {x1: xs[i] + L.tile / 2, x2: xs[i + 1] - L.tile / 2, y1: y, y2: y, stroke: C.dim, "stroke-width": 2, "stroke-dasharray": "3 4"}, group);
        const nodes = a.glyphs.map((gname, i) => {
            const ng = el("g", {transform: `translate(${xs[i]} ${y})`}, group);
            el("rect", {x: -L.tile / 2, y: -L.tile / 2, width: L.tile, height: L.tile, rx: 8, fill: C.tile, stroke: C.tileStroke}, ng);
            glyphGroup(ng, gname, 22, C.ink, 2);
            const badge = checkBadge(ng);
            set(badge, "transform", `translate(${L.tile / 2 - 2} ${-L.tile / 2 + 2})`);
            return {badge};
        });
        const cursor = el("rect", {x: -L.tile / 2 - 5, y: -L.tile / 2 - 5, width: L.tile + 10, height: L.tile + 10, rx: 11, fill: "none", stroke: C.lime, "stroke-width": 2.5, opacity: 0}, group);
        const steps = myEvs.filter((e) => e.type === "step");
        centers[id] = () => [V.stage.width / 2, y];
        updaters.push((t) => {
            const {v} = visibility(myEvs, t, a.hidden, T.popDur);
            set(group, "opacity", v);
            const done = steps.filter((e) => e.at <= t);
            if (!done.length) {
                set(cursor, "opacity", 0);
                nodes.forEach((nd) => set(nd.badge, "opacity", 0));
                return;
            }
            const cur = done[done.length - 1], prev = done[done.length - 2];
            const p = ease((t - cur.at) / 0.3);
            const cx = prev ? lerp(xs[prev.index as number], xs[cur.index as number], p) : xs[cur.index as number];
            set(cursor, "opacity", prev ? 1 : p);
            set(cursor, "transform", `translate(${cx} ${y})`);
            nodes.forEach((nd, i) => {
                const finished = done.slice(0, -1).find((e) => e.index === i);
                set(nd.badge, "opacity", finished ? ease((t - done[done.indexOf(finished) + 1].at) / 0.25) : 0);
            });
        });
    }

    // ---- marks + compare (anchored to the figure that made them)
    const marks: Record<string, {x: number; at: number; actor: string}> = {};
    for (const m of evs.filter((e) => e.type === "mark")) {
        const f = figures[m.actor as string].state(m.at);
        marks[m.id as string] = {x: f.x + 2, at: m.at, actor: m.actor as string};
    }
    const cmp = evs.find((e) => e.type === "compare");
    if (Object.keys(marks).length) {
        const owner = sb.actors[Object.values(marks)[0].actor] as TrialMotionFigureActor;
        const sx = owner.x - 14 * (owner.facing === "left" ? -1 : 1);
        el("line", {x1: sx, x2: sx, y1: FLOOR - 4, y2: FLOOR + 10, stroke: C.dim, "stroke-width": 2, "stroke-dasharray": "2 3"}, layers.floor);
        const accent = cmp ? (cmp.marks as string[])[1] : null;
        const mEls: Record<string, N> = {};
        for (const [mid, m] of Object.entries(marks)) {
            const mg = el("g", {opacity: 0}, layers.floor);
            const col = mid === accent ? C.lime : C.ink;
            el("path", {d: `M${m.x} ${FLOOR - 1} l-6 -9 h12 z`, fill: col}, mg);
            const label = el("text", {x: m.x, y: FLOOR + 17, fill: col, "font-size": 11, "text-anchor": "middle", "font-family": "ui-monospace, Menlo, monospace", "font-weight": 700}, mg);
            doc.text(label, mid);
            mEls[mid] = mg;
        }
        const bars = cmp ? (cmp.marks as string[]).map((mid, i) => ({
            r: el("rect", {x: Math.min(sx, marks[mid].x), y: FLOOR + 28 + i * 11, height: 5, rx: 2.5, fill: i ? C.lime : "rgba(233,242,228,.55)", width: 0}, layers.under),
            w: Math.abs(marks[mid].x - sx)
        })) : [];
        updaters.push((t) => {
            for (const [mid, m] of Object.entries(marks)) {
                const p = ease((t - m.at) / 0.25);
                set(mEls[mid], "opacity", p);
                set(mEls[mid], "transform", `translate(0 ${-10 * (1 - p)})`);
            }
            bars.forEach((b, i) => set(b.r, "width", Math.max(0, b.w * ease((t - (cmp as TrialMotionEvent).at - i * 0.45) / 0.7))));
        });
    }

    // ---- look: a dashed sight line from a figure's head to a target
    for (const lk of evs.filter((e) => e.type === "look")) {
        const until = lk.until as number;
        const line = el("line", {stroke: C.lime, "stroke-width": 2, "stroke-dasharray": "4 6", "stroke-linecap": "round", opacity: 0}, layers.over);
        updaters.push((t) => {
            const v = ease((t - lk.at) / 0.25) * (1 - ease((t - until) / 0.25));
            set(line, "opacity", 0.75 * v);
            if (!v) return;
            const f = figures[lk.actor as string].state(t), [tx, ty] = centers[lk.target as string](t);
            set(line, "x1", f.P[0][0] + 8 * f.facing);
            set(line, "y1", f.P[0][1]);
            set(line, "x2", tx);
            set(line, "y2", ty);
            set(line, "stroke-dashoffset", -t * 20);
        });
    }

    // ---- give: a token travels from one actor to another
    for (const gv of evs.filter((e) => e.type === "give")) {
        const dur = gv.dur ?? T.giveDur;
        const tok = el("g", {opacity: 0}, layers.over);
        el("circle", {r: 13, fill: C.dark, stroke: C.lime, "stroke-width": 2}, tok);
        glyphGroup(tok, gv.glyph as string, 15, C.lime, 2.2);
        const land = el("circle", {r: 14, fill: "none", stroke: C.lime, "stroke-width": 2, opacity: 0}, layers.over);
        updaters.push((t) => {
            const p = clamp((t - gv.at) / dur);
            const on = t >= gv.at && t <= gv.at + dur;
            set(tok, "opacity", on ? Math.min(1, ease(p / 0.15), 1 - ease((p - 0.9) / 0.1)) : 0);
            const [x0, y0] = centers[gv.from as string](t), [x1, y1] = centers[gv.to as string](t);
            const q = ease(p);
            set(tok, "transform", `translate(${lerp(x0, x1, q)} ${lerp(y0, y1, q) - 40 * 4 * q * (1 - q)})`);
            const lp = clamp((t - gv.at - dur) / 0.35);
            set(land, "opacity", t >= gv.at + dur && lp < 1 ? 1 - lp : 0);
            set(land, "r", 14 + 14 * lp);
            set(land, "cx", x1);
            set(land, "cy", y1);
        });
    }

    // ---- top-right widgets (one kind per storyboard)
    const W = V.stage.width;
    // When a storyboard has several events of one widget kind, only the latest one that has
    // started is drawn; the first fades in, later ones replace it in place.
    const widgetAlpha = (list: TrialMotionEvent[], c: TrialMotionEvent, t: number) => {
        const started = list.filter((e) => e.at <= t);
        const cur = started.length ? started[started.length - 1] : list[0];
        if (cur !== c) return 0;
        return c === list[0] ? ease((t - c.at + 0.25) / 0.25) : 1;
    };
    const counts = evs.filter((e) => e.type === "count");
    for (const c of counts) {
        const from = c.from as number, to = c.to as number, until = c.until as number;
        const tx = el("text", {x: W - 22, y: 40, "text-anchor": "end", fill: C.ink, "font-size": 30, "font-weight": 800, "font-family": "-apple-system, system-ui, sans-serif", opacity: 0}, layers.widgets);
        updaters.push((t) => {
            set(tx, "opacity", widgetAlpha(counts, c, t));
            const val = Math.round(lerp(from, to, clamp((t - c.at) / (until - c.at))));
            doc.text(tx, val);
            set(tx, "fill", t >= until ? C.lime : C.ink);
        });
    }
    const timers = evs.filter((e) => e.type === "timer");
    for (const c of timers) {
        const until = c.until as number, seconds = c.seconds as number;
        const L = 2 * Math.PI * 15;
        const g = el("g", {transform: `translate(${W - 38} 32)`, opacity: 0}, layers.widgets);
        el("circle", {r: 15, fill: "rgba(7,16,11,.85)", stroke: "rgba(167,244,50,.25)", "stroke-width": 3}, g);
        const arc = el("circle", {r: 15, fill: "none", stroke: C.lime, "stroke-width": 3, "stroke-linecap": "round", transform: "rotate(-90)", "stroke-dasharray": L, "stroke-dashoffset": L}, g);
        const num = el("text", {y: 4.5, "text-anchor": "middle", fill: C.ink, "font-size": 12, "font-weight": 800, "font-family": "ui-monospace, Menlo, monospace"}, g);
        updaters.push((t) => {
            set(g, "opacity", widgetAlpha(timers, c, t));
            const p = clamp((t - c.at) / (until - c.at));
            set(arc, "stroke-dashoffset", L * (1 - p));
            doc.text(num, ringLabel(seconds, Math.round(seconds * p)));
        });
    }
    const tallies = evs.filter((e) => e.type === "tally");
    for (const c of tallies) {
        const n = c.n as number, until = c.until as number;
        const g = el("g", {}, layers.widgets);
        const strokes = range(n).map((i) => {
            const grp = Math.floor(i / 5), k = i % 5, x0 = W - 30 - (Math.ceil(n / 5) - 1 - grp) * 40;
            const d = k < 4 ? `M${x0 - 24 + k * 7} 20 v22` : `M${x0 - 28} 38 L${x0 + 1} 24`;
            return el("path", {d, stroke: k < 4 ? C.ink : C.lime, "stroke-width": 3, "stroke-linecap": "round", opacity: 0}, g);
        });
        updaters.push((t) => {
            const own = widgetAlpha(tallies, c, t) > 0 || (tallies[0] === c && t < c.at);
            strokes.forEach((s, i) => set(s, "opacity", own ? ease((t - c.at - (i * (until - c.at)) / n) / 0.2) : 0));
        });
    }

    const loop = sb.loop;
    const wrap = (t: number) => ((t % loop) + loop) % loop;
    const draw = (t: number) => {
        t = wrap(t);
        updaters.forEach((u) => u(t));
        set(root, "opacity", Math.min(ease(t / T.fadeIn), 1 - ease((t - (loop - T.fadeOut)) / T.fadeOut)));
    };
    const beatIndexAt = (t: number) => {
        t = wrap(t);
        let cur = 0;
        sb.beats.forEach((b, i) => {
            if (t >= b.at) cur = i;
        });
        return cur;
    };
    const poster = sb.poster ?? loop - 0.6;
    draw(poster);
    return {draw, beatIndexAt, poster, loop};
}

/* ------------------------------------------------------------------ backends */

const SVG_NS = "http://www.w3.org/2000/svg";

/** The live DOM: the browser renderer. */
export const domMotionDoc: MotionDoc<Element> = {
    create: (tag) => document.createElementNS(SVG_NS, tag),
    append: (parent, child) => {
        parent.appendChild(child);
    },
    set: (node, name, value) => node.setAttribute(name, String(value)),
    text: (node, value) => {
        node.textContent = String(value);
    }
};

/** A plain-object SVG tree: the server-rendered poster and the tests. */
export type VirtualMotionNode = {tag: string; attrs: Record<string, string>; children: VirtualMotionNode[]; text: string | null};

export const virtualMotionDoc: MotionDoc<VirtualMotionNode> = {
    create: (tag) => ({tag, attrs: {}, children: [], text: null}),
    append: (parent, child) => {
        parent.children.push(child);
    },
    set: (node, name, value) => {
        node.attrs[name] = String(value);
    },
    text: (node, value) => {
        node.text = String(value);
    }
};

function escapeMarkup(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Serialises a virtual node's children as SVG markup (the `<svg>` element itself is the caller's). */
export function virtualMotionInnerMarkup(node: VirtualMotionNode): string {
    return node.children.map((child) => {
        const attrs = Object.keys(child.attrs).map((name) => ` ${name}="${escapeMarkup(child.attrs[name])}"`).join("");
        const inner = child.text != null ? escapeMarkup(child.text) : virtualMotionInnerMarkup(child);
        return `<${child.tag}${attrs}>${inner}</${child.tag}>`;
    }).join("");
}

/**
 * The poster frame as SVG markup, for a server component to paint before any
 * script runs. Null when the storyboard cannot be drawn.
 */
export function renderTrialMotionPosterMarkup(sb: TrialStoryboard, V: TrialMotionVocabulary, G: TrialMotionGlyphs): string | null {
    try {
        const svg = virtualMotionDoc.create("svg");
        createTrialMotionScene(virtualMotionDoc, svg, sb, V, G);
        return virtualMotionInnerMarkup(svg);
    } catch {
        return null;
    }
}
