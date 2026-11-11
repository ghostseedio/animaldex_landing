/**
 * The player's input while controlling an animal (design §4.1–4.2):
 *
 * Desktop: WASD or the arrows move (relative to the camera); Shift runs; Ctrl or a double-tapped W sprints; C stalks;
 * Space takes off, flaps (held) or leaps; Q and E go down and up (a swimmer's depth, a flyer's climb, a climber on the
 * trunk); X dives (a raptor's stoop, a seabird's plunge); L lands; B digs in or comes up; F climbs on or off; V switches
 * first and third person; Esc releases. The mouse turns the view (drag in third person; pointer lock in first person).
 * A gamepad works too (left stick moves, right stick looks, A takes off, B lands).
 *
 * Phones and the apps: a floating stick where the left thumb lands (left 45 % of the screen; under 60 % deflection
 * walks, past it runs), drag on the right to look, and up to three buttons bottom right that change with the body plan
 * (`hud.ts` draws them and feeds `press`/`release` here).
 */

import type {ControlInput} from "@/ark-live/movement";

export type ViewMode = "third" | "first";

export class ControlInputs {
    private readonly keys = new Set<string>();
    private readonly edges = new Set<string>();
    private lastW = 0;
    private sprintLatch = false;
    /** The view's turn (radians about up) and tilt, moved by the mouse, the right stick or a right-side drag. */
    yaw = 0;
    pitch = -0.25;
    view: ViewMode = "third";
    /** The on-screen stick: direction in screen terms (x right, y up) and how far (0–1). */
    stick = {x: 0, y: 0, amount: 0};
    private readonly held = new Set<string>();
    private dragging: {id: number; x: number; y: number} | null = null;
    onRelease: (() => void) | null = null;
    onToggleView: (() => void) | null = null;
    private readonly cleanup: Array<() => void> = [];

    constructor(private readonly el: HTMLElement) {
        const down = (e: KeyboardEvent) => this.onKey(e, true);
        const up = (e: KeyboardEvent) => this.onKey(e, false);
        const blur = () => this.keys.clear();
        const move = (e: MouseEvent) => this.onMouse(e);
        const pdown = (e: PointerEvent) => this.onPointerDown(e);
        const pmove = (e: PointerEvent) => this.onPointerMove(e);
        const pup = (e: PointerEvent) => this.onPointerUp(e);
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        window.addEventListener("blur", blur);
        document.addEventListener("mousemove", move);
        el.addEventListener("pointerdown", pdown);
        window.addEventListener("pointermove", pmove);
        window.addEventListener("pointerup", pup);
        window.addEventListener("pointercancel", pup);
        this.cleanup.push(() => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
            window.removeEventListener("blur", blur);
            document.removeEventListener("mousemove", move);
            el.removeEventListener("pointerdown", pdown);
            window.removeEventListener("pointermove", pmove);
            window.removeEventListener("pointerup", pup);
            window.removeEventListener("pointercancel", pup);
        });
    }

    private onKey(e: KeyboardEvent, isDown: boolean): void {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        const k = e.code;
        const handled = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyQ", "KeyE", "KeyC", "KeyX", "KeyL", "KeyB", "KeyF", "KeyV", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "Escape"].includes(k);
        if (!handled) return;
        e.preventDefault();
        if (isDown) {
            if (!this.keys.has(k)) {
                this.edges.add(k);
                if (k === "KeyW" || k === "ArrowUp") {
                    const now = performance.now();
                    if (now - this.lastW < 300) this.sprintLatch = true;
                    this.lastW = now;
                }
                if (k === "Escape") this.onRelease?.();
                if (k === "KeyV") this.onToggleView?.();
            }
            this.keys.add(k);
        } else {
            this.keys.delete(k);
            if (k === "KeyW" || k === "ArrowUp") this.sprintLatch = false;
        }
    }

    private onMouse(e: MouseEvent): void {
        if (document.pointerLockElement === this.el || (this.dragging && this.dragging.id === -1)) {
            this.turn(e.movementX, e.movementY);
        }
    }

    private turn(dx: number, dy: number): void {
        this.yaw -= dx * 0.0035;
        this.pitch = Math.max(-1.2, Math.min(0.9, this.pitch - dy * 0.0035));
    }

    private onPointerDown(e: PointerEvent): void {
        if ((e.target as HTMLElement | null)?.closest?.("[data-ark-control-ui]")) return;
        if (e.pointerType === "mouse") {
            // First person: lock the pointer; third person: drag to look.
            if (this.view === "first" && this.el.requestPointerLock) this.el.requestPointerLock();
            else this.dragging = {id: -1, x: e.clientX, y: e.clientY};
            return;
        }
        // Touch: the left 45 % holds the stick (drawn by the HUD), the rest looks.
        const rect = this.el.getBoundingClientRect();
        if (e.clientX - rect.left > rect.width * 0.45) this.dragging = {id: e.pointerId, x: e.clientX, y: e.clientY};
    }

    private onPointerMove(e: PointerEvent): void {
        if (this.dragging && this.dragging.id === e.pointerId) {
            this.turn((e.clientX - this.dragging.x) * 1.4, (e.clientY - this.dragging.y) * 1.4);
            this.dragging = {...this.dragging, x: e.clientX, y: e.clientY};
        }
    }

    private onPointerUp(e: PointerEvent): void {
        if (this.dragging && (this.dragging.id === e.pointerId || (this.dragging.id === -1 && e.pointerType === "mouse"))) this.dragging = null;
    }

    /** The HUD's buttons: held while pressed (flap, up, down, dive) or pressed once (takeoff, land, dig, climb). */
    press(action: string): void {
        if (!this.held.has(action)) this.edges.add(`btn:${action}`);
        this.held.add(action);
    }

    releaseButton(action: string): void {
        this.held.delete(action);
    }

    private gamepad(): {mx: number; my: number; lx: number; ly: number; a: boolean; b: boolean; run: boolean} | null {
        const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of Array.from(pads ?? [])) {
            if (!pad) continue;
            const dead = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
            return {mx: dead(pad.axes[0] ?? 0), my: -dead(pad.axes[1] ?? 0), lx: dead(pad.axes[2] ?? 0), ly: dead(pad.axes[3] ?? 0), a: Boolean(pad.buttons[0]?.pressed), b: Boolean(pad.buttons[1]?.pressed), run: Boolean(pad.buttons[10]?.pressed || pad.buttons[7]?.pressed)};
        }
        return null;
    }

    /** This frame's input, the move turned by the view's yaw into world space. Edges are cleared. */
    sample(dt: number): ControlInput {
        const k = (code: string) => this.keys.has(code);
        let fx = (k("KeyD") || k("ArrowRight") ? 1 : 0) - (k("KeyA") || k("ArrowLeft") ? 1 : 0);
        let fy = (k("KeyW") || k("ArrowUp") ? 1 : 0) - (k("KeyS") || k("ArrowDown") ? 1 : 0);
        let amount = fx || fy ? 1 : 0;
        let run = k("ShiftLeft") || k("ShiftRight");
        const pad = this.gamepad();
        if (pad) {
            if (Math.hypot(pad.mx, pad.my) > 0) {
                fx = pad.mx;
                fy = pad.my;
                amount = Math.min(Math.hypot(pad.mx, pad.my), 1);
                run = run || amount > 0.85 || pad.run;
            }
            this.turn(pad.lx * 600 * dt, -pad.ly * 400 * dt);
        }
        if (this.stick.amount > 0.05) {
            fx = this.stick.x;
            fy = this.stick.y;
            amount = this.stick.amount;
            // Under 60 % deflection walks; past it runs.
            run = run || amount >= 0.6;
            amount = amount >= 0.6 ? 1 : amount / 0.6;
        }
        // Screen terms to world: forward is away from the camera (the view's yaw), right is its right.
        const len = Math.hypot(fx, fy) || 1;
        const sx = fx / len;
        const sy = fy / len;
        const fwdX = Math.sin(this.yaw);
        const fwdZ = Math.cos(this.yaw);
        const rightX = -fwdZ;
        const rightZ = fwdX;
        const dirX = sy * fwdX + sx * rightX;
        const dirZ = sy * fwdZ + sx * rightZ;
        const edge = (code: string) => this.edges.has(code);
        const held = (action: string) => this.held.has(action);
        const input: ControlInput = {
            dirX: amount ? dirX : 0,
            dirZ: amount ? dirZ : 0,
            amount,
            run,
            sprint: run && (k("ControlLeft") || k("ControlRight") || this.sprintLatch),
            stalk: k("KeyC"),
            vertical: (k("KeyE") || held("up") ? 1 : 0) - (k("KeyQ") || held("down") ? 1 : 0),
            takeoff: edge("Space") || edge("btn:fly") || Boolean(pad?.a && !this.held.has("pad:a")),
            land: edge("KeyL") || edge("btn:land") || Boolean(pad?.b),
            dig: edge("KeyB") || edge("btn:dig"),
            climb: edge("KeyF") || edge("btn:climb"),
            flap: k("Space") || held("fly") || held("flap"),
            dive: k("KeyX") || held("dive")
        };
        if (pad?.a) this.held.add("pad:a");
        else this.held.delete("pad:a");
        this.edges.clear();
        return input;
    }

    dispose(): void {
        for (const fn of this.cleanup) fn();
        if (typeof document !== "undefined" && document.pointerLockElement === this.el) document.exitPointerLock?.();
    }
}
