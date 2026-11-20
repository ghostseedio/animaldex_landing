/**
 * The tapped animal's relation lines over the world (lane ARK-RELATION-LINES): one line from it to each of the nearest
 * few animals that could hunt it, that it eats, and that could be its partner (`lib/ark-relations.ts` decides who).
 * Drawn on a 2D canvas in the scene's label layer, from where the scene has each animal now (`locate`, `screenOf`),
 * so a line follows both ends as they move. A target out of the view is a marker at the view's edge, pointing to it.
 * Each line's end (and each edge marker) is a button: tapping it selects that animal.
 *
 * The three kinds never rely on colour alone: each has its own colour (colour-blind safe: vermillion, sky blue,
 * yellow), its own dash (solid, dashed, dotted) and its own icon (claw marks, a fork, a heart), the same as the card's
 * legend (`lib/ark-relations.ts` ARK_RELATION_STYLE). A dark halo under each line keeps it legible on sand, grass, sea and at night.
 *
 * Loaded only after a tap with the lines on; draws only while it has lines; nothing allocated per frame.
 */

import type {ArkSceneHandle} from "@/ark-scene/types";
import {ARK_RELATION_STYLE, type ArkRelationKind} from "@/lib/ark-relations";

/** A line's end: an animal (where the scene has it now), or a clutch at its nest (`at`); `id` is selected on its tap. */
export type ArkRelationLine = {kind: ArkRelationKind; id: string; label: string; at?: {x: number; y: number; z: number}; /** Highlighted (a kind tapped in the card's food chain): drawn bolder, the rest faded. */ strong?: boolean};

type Scene = Pick<ArkSceneHandle, "locate" | "relationView" | "screenOf">;

const MARGIN = 22;
const END_R = 11;
/** The lines are drawn again at most this often (ms): about 24 a second while the view moves, none while nothing does. */
const FRAME_MS = 40;

export type ArkRelationLinesHandle = {
    set: (selected: string | null, lines: readonly ArkRelationLine[]) => void;
    setReducedMotion: (reduced: boolean) => void;
    dispose: () => void;
};

/** Where the ray from (ax, ay) towards (bx, by) leaves the box; null when it never does. */
function exitPoint(ax: number, ay: number, bx: number, by: number, x0: number, y0: number, x1: number, y1: number, out: {x: number; y: number}): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    let t = Number.POSITIVE_INFINITY;
    if (dx > 1e-6) t = Math.min(t, (x1 - ax) / dx);
    if (dx < -1e-6) t = Math.min(t, (x0 - ax) / dx);
    if (dy > 1e-6) t = Math.min(t, (y1 - ay) / dy);
    if (dy < -1e-6) t = Math.min(t, (y0 - ay) / dy);
    if (!Number.isFinite(t) || t < 0) return false;
    out.x = ax + dx * t;
    out.y = ay + dy * t;
    return true;
}

export function mountArkRelationLines(scene: Scene, options: {onPick: (id: string) => void; reducedMotion: boolean}): ArkRelationLinesHandle | null {
    const view = scene.relationView?.();
    if (!view || !scene.screenOf) return null;
    const screenOf = scene.screenOf;
    const layer = view.layer;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.testid = "ark-relation-lines";
    Object.assign(canvas.style, {position: "absolute", left: "0", top: "0", width: "100%", height: "100%", pointerEvents: "none"});
    layer.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        canvas.remove();
        return null;
    }
    const icons = new Map<ArkRelationKind, Path2D>();
    for (const kind of Object.keys(ARK_RELATION_STYLE) as ArkRelationKind[]) icons.set(kind, new Path2D(ARK_RELATION_STYLE[kind].icon));

    // The ends' buttons (a pool: the label layer is aria-hidden; the card lists the same animals as real buttons).
    const buttons: HTMLButtonElement[] = [];
    const buttonFor = (i: number) => {
        let button = buttons[i];
        if (!button) {
            button = document.createElement("button");
            button.type = "button";
            button.tabIndex = -1;
            Object.assign(button.style, {position: "absolute", left: "0", top: "0", width: "34px", height: "34px", margin: "-17px 0 0 -17px", borderRadius: "50%", border: "0", padding: "0", background: "transparent", cursor: "pointer", pointerEvents: "auto", display: "none"});
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                const id = button!.dataset.id;
                if (id) options.onPick(id);
            });
            layer.appendChild(button);
            buttons[i] = button;
        }
        return button;
    };

    let selected: string | null = null;
    let lines: readonly ArkRelationLine[] = [];
    let reduced = options.reducedMotion;
    let raf = 0;
    let dpr = 1;
    let cw = 0;
    let ch = 0;
    const a = {x: 0, y: 0, front: true};
    const b = {x: 0, y: 0, front: true};
    const edge = {x: 0, y: 0};
    const started = performance.now();

    const icon = (kind: ArkRelationKind, x: number, y: number, r: number, pointing: number | null) => {
        const style = ARK_RELATION_STYLE[kind];
        ctx.setLineDash([]);
        // (An edge marker points where the animal is: a small wedge outside its ring.)
        if (pointing !== null) {
            ctx.fillStyle = style.color;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(pointing) * (r + 7), y + Math.sin(pointing) * (r + 7));
            ctx.lineTo(x + Math.cos(pointing + 0.55) * (r + 1), y + Math.sin(pointing + 0.55) * (r + 1));
            ctx.lineTo(x + Math.cos(pointing - 0.55) * (r + 1), y + Math.sin(pointing - 0.55) * (r + 1));
            ctx.closePath();
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(10, 14, 10, 0.78)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = style.color;
        ctx.fill();
        const s = (r * 1.25) / 16;
        ctx.save();
        ctx.translate(x - 8 * s, y - 8 * s);
        ctx.scale(s, s);
        const path = icons.get(kind)!;
        if (style.fill) {
            ctx.fillStyle = "#10140f";
            ctx.fill(path);
        } else {
            ctx.strokeStyle = "#10140f";
            ctx.lineWidth = 2 / s > 2.4 ? 2.4 : 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke(path);
        }
        ctx.restore();
    };

    // The ends worked out each frame (reused: nothing allocated per frame), and what was last drawn: a frame is drawn again
    // only when an end moved by half a pixel, the dashes' drift stepped (10 a second), or a line changed, and at most every
    // FRAME_MS. Only the box last drawn in is cleared.
    const MAX = 32;
    const endX = new Float32Array(MAX);
    const endY = new Float32Array(MAX);
    const endAngle = new Float32Array(MAX);
    const endState = new Uint8Array(MAX); // 0 skipped, 1 inside, 2 at the edge
    let lastKey = "";
    let lastAt = 0;
    let dirty = {x0: 0, y0: 0, x1: 0, y1: 0, any: false};
    let changed = true;

    const draw = (now: number) => {
        raf = requestAnimationFrame(draw);
        if (!selected || !lines.length) {
            cancelAnimationFrame(raf);
            raf = 0;
            return clear();
        }
        if (now - lastAt < FRAME_MS) return;
        const v = scene.relationView!();
        const w = v.width;
        const h = v.height;
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        if (w !== cw || h !== ch || ratio !== dpr) {
            cw = w;
            ch = h;
            dpr = ratio;
            canvas.width = Math.max(1, Math.round(w * dpr));
            canvas.height = Math.max(1, Math.round(h * dpr));
            changed = true;
            dirty.any = false;
        }
        const x0 = MARGIN;
        const y0 = MARGIN;
        const x1 = w - MARGIN;
        const y1 = Math.max(y0 + 40, h - v.inset - MARGIN);
        const from = scene.locate(selected);
        const fromOk = Boolean(from) && screenOf(from!.x, from!.y, from!.z, a).front;
        const fromIn = fromOk && a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1;
        const step = reduced ? 0 : Math.floor((now - started) / 100);
        const n = Math.min(lines.length, MAX);
        // Pass 1: the ends.
        let key = `${fromIn ? Math.round(a.x * 2) : -1},${fromIn ? Math.round(a.y * 2) : -1},${step},${w}x${h}`;
        for (let i = 0; i < n; i++) {
            const line = lines[i];
            endState[i] = 0;
            const to = line.at ?? scene.locate(line.id);
            if (!to) continue;
            screenOf(to.x, to.y, to.z, b);
            // (Behind the camera, the projection is mirrored: its direction is the other way round from the middle.)
            if (!b.front) {
                b.x = w - b.x;
                b.y = h - b.y;
            }
            const inside = b.front && b.x >= x0 && b.x <= x1 && b.y >= y0 && b.y <= y1;
            if (inside) {
                endX[i] = b.x;
                endY[i] = b.y;
                endState[i] = 1;
            } else {
                const ox = fromIn ? a.x : w / 2;
                const oy = fromIn ? a.y : (y0 + y1) / 2;
                if (!exitPoint(ox, oy, b.x, b.y, x0, y0, x1, y1, edge)) continue;
                endX[i] = edge.x;
                endY[i] = edge.y;
                endAngle[i] = Math.atan2(b.y - oy, b.x - ox);
                endState[i] = 2;
            }
            key += `|${endState[i]}${Math.round(endX[i] * 2)},${Math.round(endY[i] * 2)}`;
        }
        if (!changed && key === lastKey) return;
        changed = false;
        lastKey = key;
        lastAt = now;
        // Pass 2: clear what was drawn, draw again.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (dirty.any) ctx.clearRect(dirty.x0 - 2, dirty.y0 - 2, dirty.x1 - dirty.x0 + 4, dirty.y1 - dirty.y0 + 4);
        dirty = {x0: fromIn ? a.x : w, y0: fromIn ? a.y : h, x1: fromIn ? a.x : 0, y1: fromIn ? a.y : 0, any: false};
        let anyStrong = false;
        for (let i = 0; i < n; i++) if (lines[i].strong) anyStrong = true;
        let used = 0;
        for (let i = 0; i < n; i++) {
            if (!endState[i]) continue;
            const line = lines[i];
            const ex = endX[i];
            const ey = endY[i];
            const inside = endState[i] === 1;
            const style = ARK_RELATION_STYLE[line.kind];
            if (fromIn) {
                // The halo, then the line; dashes drift towards the tapped animal (gently; still with reduced motion).
                ctx.lineCap = "round";
                ctx.setLineDash(style.dash);
                ctx.lineDashOffset = style.dash.length ? -step * 0.9 : 0;
                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(a.x, a.y);
                ctx.strokeStyle = "rgba(8, 12, 8, 0.6)";
                ctx.lineWidth = 5.5;
                ctx.stroke();
                ctx.strokeStyle = style.color;
                ctx.globalAlpha = anyStrong && !line.strong ? 0.35 : 0.92;
                ctx.lineWidth = line.strong ? 3.5 : 2.5;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            icon(line.kind, ex, ey, inside ? 8.5 : END_R, inside ? null : endAngle[i]);
            const r = END_R + 9;
            dirty.x0 = Math.min(dirty.x0, ex - r);
            dirty.y0 = Math.min(dirty.y0, ey - r);
            dirty.x1 = Math.max(dirty.x1, ex + r);
            dirty.y1 = Math.max(dirty.y1, ey + r);
            dirty.any = true;
            const button = buttonFor(used++);
            button.dataset.id = line.id;
            button.title = line.label;
            button.setAttribute("aria-label", line.label);
            button.style.display = "block";
            button.style.transform = `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px)`;
        }
        for (let i = used; i < buttons.length; i++) buttons[i].style.display = "none";
    };

    const clear = () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dirty.any = false;
        lastKey = "";
        for (const button of buttons) button.style.display = "none";
    };

    return {
        set: (id, next) => {
            selected = id;
            lines = next;
            changed = true;
            if (!raf) raf = requestAnimationFrame(draw);
        },
        setReducedMotion: (value) => {
            reduced = value;
        },
        dispose: () => {
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            canvas.remove();
            for (const button of buttons) button.remove();
            buttons.length = 0;
        }
    };
}
