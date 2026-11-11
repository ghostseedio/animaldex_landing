/**
 * The controller's HUD (design §4.2, §5.2, §4.7): quiet, at the edges, never drawn over the animals.
 *
 * - The top bar: first or third person, the time left, Release.
 * - One line at the foot for how the animal is (tired, exhausted, uncomfortable, distressed), from the server's meters;
 *   stamina as a thin bar. Body language comes first (the scene); the words follow.
 * - Notices that come and go: a stumble, water it can't swim, a slope too steep, a fence, a drop it can't climb back.
 * - Phones and the apps: the floating stick (left 45 %) and up to three buttons for its body plan, bottom right.
 * - Two islands: "Cross" when the server says it can, "Turn back" before halfway.
 * - First person, wide-eyed prey: the screen's edge brightens softly toward an animal it would notice out of view.
 *
 * Every word comes from `ControlWords` (English defaults; the page passes its language's).
 */

import type {Abilities} from "@/ark-live/species";
import {METER_FLAG, type MeterMessage} from "@/ark-live/protocol";
import type {ControlInputs, ViewMode} from "@/ark-scene/control/input";

export type ControlWords = {
    release: string;
    firstPerson: string;
    thirdPerson: string;
    left: string;
    breathless: string;
    exhausted: string;
    distressed: string;
    uncomfortable: Record<string, string>;
    wantsHome: string;
    inDanger: string;
    notices: Record<string, string>;
    buttons: {fly: string; land: string; dive: string; up: string; down: string; climb: string; dig: string};
    cross: string;
    turnBack: string;
    crossing: string;
    released: Record<string, string>;
    rotate: string;
    keys: string;
};

export const CONTROL_WORDS_EN: ControlWords = {
    release: "Release",
    firstPerson: "1st person",
    thirdPerson: "3rd person",
    left: "{time} left",
    breathless: "Breathing hard",
    exhausted: "Exhausted: it can't run now",
    distressed: "It has to stop and rest",
    uncomfortable: {
        cold: "It's cold here",
        heat: "It's too hot here",
        dry: "It needs water",
        salt: "The salt water is hard on it",
        fresh: "This water isn't its own",
        deep: "Too deep for it here",
        shallow: "Too shallow for it here",
        open_sea: "Far out over the sea",
        far_from_home: "This isn't where it lives",
        other_island: "This isn't its island",
        none: "It's uneasy here"
    },
    wantsHome: "It wants to go back home",
    inDanger: "It's in danger here: it's heading home",
    notices: {
        stumble: "It stumbled",
        cant_swim: "It can't swim out there",
        cant_climb: "Nothing to climb here",
        cant_fly: "It can't fly",
        steep: "Too steep to climb",
        pen: "The fence keeps it in",
        enclosure: "The fence keeps it in",
        one_way_drop: "It can't climb back up here",
        paddle: "Too far out for it to swim",
        slow: "The connection is too slow to explore right now",
        shore_release: "It can't cross the sea: release it here"
    },
    buttons: {fly: "Fly", land: "Land", dive: "Dive", up: "Up", down: "Down", climb: "Climb", dig: "Dig"},
    cross: "Cross to the other island",
    turnBack: "Turn back",
    crossing: "Crossing the strait",
    released: {
        player: "Back to its own life",
        session_limit: "It needs to rest now",
        daily_limit: "That's enough exploring for today",
        exposure: "It was in danger: it's heading home",
        disconnect: "The connection dropped: it's back to its own life",
        shutdown: "Exploring is resting right now",
        rejections: "Exploring stopped",
        island: "Back to its own life",
        slow: "The connection is too slow to explore right now",
        replaced: "Back to its own life"
    },
    rotate: "Turn your phone sideways for its full field of view",
    keys: "WASD to move · Shift to run · Space to fly or jump · Q/E down and up · V switches view · Esc releases"
};

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: string, text = ""): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.setAttribute("style", style);
    if (text) node.textContent = text;
    return node;
}

const PILL = "border:0;border-radius:999px;padding:8px 14px;font:600 13px/1.1 system-ui,sans-serif;color:#fff;background:rgba(20,24,22,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:pointer;-webkit-tap-highlight-color:transparent;";
const BUTTON = "width:64px;height:64px;border-radius:32px;border:1px solid rgba(255,255,255,.35);background:rgba(20,24,22,.45);color:#fff;font:600 12px system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;";

export class ControlHud {
    readonly root: HTMLDivElement;
    private readonly time: HTMLSpanElement;
    private readonly line: HTMLDivElement;
    private readonly bar: HTMLDivElement;
    private readonly barFill: HTMLDivElement;
    private readonly notice: HTMLDivElement;
    private readonly viewButton: HTMLButtonElement;
    private readonly crossButton: HTMLButtonElement;
    private readonly buttons: HTMLDivElement;
    private readonly stickBase: HTMLDivElement;
    private readonly stickKnob: HTMLDivElement;
    private readonly edgeL: HTMLDivElement;
    private readonly edgeR: HTMLDivElement;
    private readonly hint: HTMLDivElement;
    private noticeTimer: ReturnType<typeof setTimeout> | null = null;
    private stickId: number | null = null;
    private stickOrigin = {x: 0, y: 0};
    private readonly touch: boolean;
    private crossing = false;
    onRelease: (() => void) | null = null;
    onView: (() => void) | null = null;
    onCross: (() => void) | null = null;
    onTurnBack: (() => void) | null = null;

    constructor(private readonly host: HTMLElement, private readonly inputs: ControlInputs, private readonly words: ControlWords, a: Abilities, insets: {top: number; bottom: number}) {
        this.touch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false);
        this.root = el("div", "position:absolute;inset:0;pointer-events:none;z-index:30;");
        this.root.setAttribute("data-ark-control-ui", "");
        const top = el("div", `position:absolute;left:12px;right:12px;top:calc(${insets.top}px + 10px + env(safe-area-inset-top));display:flex;gap:8px;justify-content:space-between;align-items:center;pointer-events:none;`);
        this.viewButton = el("button", PILL + "pointer-events:auto;", words.firstPerson);
        this.viewButton.type = "button";
        this.viewButton.addEventListener("click", () => this.onView?.());
        this.time = el("span", "font:600 12px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6);");
        const release = el("button", PILL + "pointer-events:auto;background:rgba(185,247,90,.9);color:#10140f;", words.release);
        release.type = "button";
        release.addEventListener("click", () => this.onRelease?.());
        top.append(this.viewButton, this.time, release);
        const foot = el("div", `position:absolute;left:50%;transform:translateX(-50%);bottom:calc(${insets.bottom}px + 18px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;max-width:80%;`);
        this.line = el("div", "font:600 13px/1.3 system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7);text-align:center;min-height:17px;");
        this.bar = el("div", "width:120px;height:3px;border-radius:2px;background:rgba(255,255,255,.25);overflow:hidden;");
        this.barFill = el("div", "height:100%;width:100%;background:rgba(255,255,255,.85);transition:width .4s;");
        this.bar.append(this.barFill);
        this.crossButton = el("button", PILL + "pointer-events:auto;display:none;", words.cross);
        this.crossButton.type = "button";
        this.crossButton.addEventListener("click", () => (this.crossing ? this.onTurnBack?.() : this.onCross?.()));
        foot.append(this.crossButton, this.line, this.bar);
        this.notice = el("div", "position:absolute;left:50%;top:30%;transform:translateX(-50%);font:600 14px system-ui,sans-serif;color:#fff;background:rgba(20,24,22,.55);padding:8px 14px;border-radius:999px;opacity:0;transition:opacity .25s;pointer-events:none;");
        this.hint = el("div", `position:absolute;left:50%;transform:translateX(-50%);bottom:calc(${insets.bottom}px + 70px + env(safe-area-inset-bottom));font:500 12px system-ui,sans-serif;color:rgba(255,255,255,.85);text-shadow:0 1px 3px rgba(0,0,0,.7);transition:opacity 1s;`, this.touch ? "" : words.keys);
        setTimeout(() => (this.hint.style.opacity = "0"), 7000);
        this.edgeL = el("div", "position:absolute;left:0;top:0;bottom:0;width:18%;background:linear-gradient(90deg,rgba(255,250,235,.35),rgba(255,250,235,0));opacity:0;transition:opacity .3s;");
        this.edgeR = el("div", "position:absolute;right:0;top:0;bottom:0;width:18%;background:linear-gradient(270deg,rgba(255,250,235,.35),rgba(255,250,235,0));opacity:0;transition:opacity .3s;");
        this.stickBase = el("div", "position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:60px;border:1px solid rgba(255,255,255,.4);background:rgba(20,24,22,.25);display:none;");
        this.stickKnob = el("div", "position:absolute;left:40px;top:40px;width:40px;height:40px;border-radius:20px;background:rgba(255,255,255,.7);");
        this.stickBase.append(this.stickKnob);
        this.buttons = el("div", `position:absolute;right:16px;bottom:calc(${insets.bottom}px + 24px + env(safe-area-inset-bottom));display:${this.touch ? "flex" : "none"};flex-direction:column;gap:10px;pointer-events:auto;`);
        this.buttons.setAttribute("data-ark-control-ui", "");
        for (const [action, label] of this.buttonsFor(a)) {
            const b = el("button", BUTTON, label);
            b.type = "button";
            b.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                this.inputs.press(action);
            });
            const up = () => this.inputs.releaseButton(action);
            b.addEventListener("pointerup", up);
            b.addEventListener("pointercancel", up);
            b.addEventListener("pointerleave", up);
            this.buttons.append(b);
        }
        this.root.append(this.edgeL, this.edgeR, top, foot, this.notice, this.hint, this.stickBase, this.buttons);
        host.append(this.root);
        if (this.touch) this.wireStick();
    }

    /** Up to three buttons for its body plan (design §4.2). */
    private buttonsFor(a: Abilities): Array<[string, string]> {
        const w = this.words.buttons;
        const out: Array<[string, string]> = [];
        if (a.canFly) out.push(["fly", w.fly], ["land", w.land]);
        if (a.canFly && a.diver) out.push(["dive", w.dive]);
        if (a.canSwim && out.length < 2) out.push(["up", w.up], ["down", w.down]);
        if (a.canClimb && out.length < 3) out.push(["climb", w.climb]);
        if (a.canBurrow && out.length < 3) out.push(["dig", w.dig]);
        return out.slice(0, 3);
    }

    private wireStick(): void {
        const area = this.host;
        const down = (e: PointerEvent) => {
            if (e.pointerType === "mouse" || this.stickId !== null) return;
            if ((e.target as HTMLElement | null)?.closest?.("[data-ark-control-ui]") && (e.target as HTMLElement) !== this.root) return;
            const rect = area.getBoundingClientRect();
            if (e.clientX - rect.left > rect.width * 0.45) return;
            this.stickId = e.pointerId;
            this.stickOrigin = {x: e.clientX, y: e.clientY};
            this.stickBase.style.left = `${e.clientX - rect.left}px`;
            this.stickBase.style.top = `${e.clientY - rect.top}px`;
            this.stickBase.style.display = "block";
        };
        const move = (e: PointerEvent) => {
            if (e.pointerId !== this.stickId) return;
            const dx = e.clientX - this.stickOrigin.x;
            const dy = e.clientY - this.stickOrigin.y;
            const d = Math.min(Math.hypot(dx, dy), 50);
            const k = d / Math.max(Math.hypot(dx, dy), 1e-6);
            this.stickKnob.style.left = `${40 + dx * k}px`;
            this.stickKnob.style.top = `${40 + dy * k}px`;
            this.inputs.stick = {x: (dx * k) / 50, y: (-dy * k) / 50, amount: d / 50};
        };
        const up = (e: PointerEvent) => {
            if (e.pointerId !== this.stickId) return;
            this.stickId = null;
            this.stickBase.style.display = "none";
            this.stickKnob.style.left = "40px";
            this.stickKnob.style.top = "40px";
            this.inputs.stick = {x: 0, y: 0, amount: 0};
        };
        area.addEventListener("pointerdown", down);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
    }

    setView(view: ViewMode): void {
        this.viewButton.textContent = view === "first" ? this.words.thirdPerson : this.words.firstPerson;
        const portrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
        if (view === "first" && portrait && this.touch) this.flash(this.words.rotate, 3500);
    }

    /** The server's meters (2 Hz): the bar, and one line for the worst thing it feels now. */
    setMeter(m: MeterMessage, animalHome: string | null): void {
        this.barFill.style.width = `${Math.round(m.stamina * 100)}%`;
        const w = this.words;
        let text = "";
        if (m.flags & METER_FLAG.IN_DANGER) text = w.inDanger;
        else if (m.flags & METER_FLAG.DISTRESSED && m.exposure > 0.6) text = animalHome ? w.wantsHome : w.wantsHome;
        else if (m.stamina < 0.15) text = w.distressed;
        else if (m.flags & METER_FLAG.EXHAUSTED) text = w.exhausted;
        else if (m.flags & METER_FLAG.UNCOMFORTABLE) text = w.uncomfortable[m.cause] ?? w.uncomfortable.none;
        else if (m.stamina < 0.6) text = w.breathless;
        this.line.textContent = text;
        this.time.textContent = fill(w.left, {time: `${Math.floor(m.sessionLeft / 60)}:${String(Math.floor(m.sessionLeft % 60)).padStart(2, "0")}`});
        if (!this.crossing) this.crossButton.style.display = m.flags & METER_FLAG.CAN_CROSS ? "block" : "none";
    }

    setCrossing(active: boolean, canTurnBack: boolean): void {
        this.crossing = active;
        this.crossButton.textContent = active ? this.words.turnBack : this.words.cross;
        this.crossButton.style.display = active && canTurnBack ? "block" : "none";
        if (active) this.line.textContent = this.words.crossing;
    }

    flash(text: string, ms = 2200): void {
        this.notice.textContent = text;
        this.notice.style.opacity = "1";
        if (this.noticeTimer) clearTimeout(this.noticeTimer);
        this.noticeTimer = setTimeout(() => (this.notice.style.opacity = "0"), ms);
    }

    notice_(key: string): void {
        const text = this.words.notices[key];
        if (text) this.flash(text);
    }

    /** The peripheral cues (0–1 each side). */
    setEdges(left: number, right: number): void {
        this.edgeL.style.opacity = String(Math.min(1, left));
        this.edgeR.style.opacity = String(Math.min(1, right));
    }

    dispose(): void {
        this.root.remove();
        if (this.noticeTimer) clearTimeout(this.noticeTimer);
    }
}
