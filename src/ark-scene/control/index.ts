/**
 * Player control in the scene (design §4; phase 1): the live layer (`live-layer.ts`), the player's input
 * (`input.ts`), the HUD (`hud.ts`) and the cameras (`camera.ts`), wired for `index.ts`, which asks this for:
 * - which animals are under control now (pinned: always drawn one by one, on every viewer);
 * - each one's pose and clip (the viewer's own predicted; everyone else's interpolated from the server);
 * - while the viewer controls one, the camera (third or first person) and the peripheral cues.
 *
 * Only `ark-live` decides anything; this draws and asks.
 */

import {LiveLayer, type ControlledPose, type ControlState, type LiveStatus, type LiveTier} from "@/ark-scene/control/live-layer";
import {ControlInputs, type ViewMode} from "@/ark-scene/control/input";
import {ControlHud, CONTROL_WORDS_EN, type ControlWords} from "@/ark-scene/control/hud";
import {firstPerson, horizontalFov, thirdPerson, type CameraPose, type CameraWorld} from "@/ark-scene/control/camera";
import type {StartPose} from "@/ark-live/protocol";
import type {IslandId} from "@/ark-live/islands";
import {controllable} from "@/ark-live/species";
import {waterLevelAt} from "@/ark-scene/water-level";
import type {ArkWorldSampler} from "@/ark-scene/world-sampler";
import type {HomePlot} from "@/ark-scene/props/home-layout";
import type {ArkAnimal} from "@/ark-scene/types";

export {controlRigClip, isFlightClip} from "@/ark-scene/control/clips";
export type {ControlledPose, ControlWords, LiveTier, ViewMode};

export type PlayerControlEvent =
    | {kind: "live"; available: boolean; status: LiveStatus}
    | {kind: "started"; animalId: string}
    | {kind: "denied"; animalId: string; reason: string}
    | {kind: "ended"; animalId: string; reason: string}
    | {kind: "haptic"; type: "takeoff" | "land" | "bump" | "warn"}
    /** Phase 3: a hunt ended in a meal (everyone hears it: the prey goes from the scene until the next snapshot). */
    | {kind: "eaten"; preyId: string}
    /** Phase 2: Talk pressed beside another animal (the page opens that animal's chat with its Ark id). */
    | {kind: "talk"; animalId: string; slug?: string | null};

export type PlayerControlOptions = {
    url: string;
    island?: IslandId;
    tier: () => LiveTier;
    host: HTMLElement;
    sampler: () => ArkWorldSampler | null;
    plots?: () => HomePlot[] | null;
    words?: Partial<ControlWords>;
    insets?: () => {top: number; bottom: number};
    client?: string;
    appVersion?: string;
    onEvent?: (event: PlayerControlEvent) => void;
    /** The controlled set changed: the scene re-pins (draws them one by one). */
    onPins?: () => void;
};

export class PlayerControl {
    readonly live: LiveLayer;
    private inputs: ControlInputs | null = null;
    private hud: ControlHud | null = null;
    private view: ViewMode = "third";
    private active: {animal: ArkAnimal} | null = null;
    private pending: ArkAnimal | null = null;
    private lastMode: string | null = null;
    private readonly words: ControlWords;
    private talkTarget: string | null = null;

    constructor(private readonly o: PlayerControlOptions) {
        this.words = {...CONTROL_WORDS_EN, ...(o.words ?? {})} as ControlWords;
        this.live = new LiveLayer(
            {url: o.url, island: o.island, tier: o.tier(), client: o.client, appVersion: o.appVersion, sampler: o.sampler, plots: o.plots},
            {
                onStatus: (status) => {
                    o.onEvent?.({kind: "live", available: status === "open", status});
                    if (status === "slow") this.hud?.notice_("slow");
                },
                onControl: (state) => this.onControl(state),
                onMeter: (meter) => this.hud?.setMeter(meter, this.active?.animal.zone ?? null),
                onNotice: (key) => {
                    this.hud?.notice_(key);
                    if (key === "stumble") o.onEvent?.({kind: "haptic", type: "bump"});
                },
                onCrossing: (phase, reason) => {
                    if (phase === "start") this.hud?.setCrossing(true, true);
                    else if (phase === "halfway") this.hud?.setCrossing(true, false);
                    else if (phase === "arrived" || phase === "rescued" || phase === "turned-back") this.hud?.setCrossing(phase === "turned-back", false);
                    else if (phase === "denied" && reason) this.hud?.flash(reason);
                },
                onControlledSet: () => o.onPins?.(),
                onHunt: (phase, preyId, reason) => {
                    if (phase === "confirmed") o.onEvent?.({kind: "eaten", preyId});
                    if (!this.hud) return;
                    const w = this.words.hunt;
                    if (phase === "contact" || phase === "confirmed" || phase === "escaped") this.hud.flash(w[phase] ?? w.other);
                    else if (phase === "denied") this.hud.flash(w[reason ?? "other"] ?? w.escaped);
                    if (phase === "contact") o.onEvent?.({kind: "haptic", type: "bump"});
                },
                onTalkReady: (animalId) => {
                    this.talkTarget = animalId;
                    this.hud?.setTalk(Boolean(animalId));
                }
            }
        );
    }

    available(): boolean {
        return this.live.available();
    }

    /** Can this animal be controlled at all (D16: not the sessile)? */
    controllable(animal: ArkAnimal): boolean {
        return !animal.placeholder && controllable(animal.model_slug);
    }

    controllingId(): string | null {
        return this.live.controllingId();
    }

    controlledIds(): ReadonlySet<string> {
        return this.live.controlledIds();
    }

    /** Start with a ticket, from where the scene draws the animal now. */
    begin(animal: ArkAnimal, ticket: string, start: StartPose): void {
        if (this.active || this.pending) return;
        this.pending = animal;
        this.live.startControl(ticket, {id: animal.id, slug: animal.model_slug, zone: animal.zone, area: animal.area ?? null}, start);
    }

    end(): void {
        this.live.release();
    }

    setView(view: ViewMode): void {
        this.view = view;
        if (this.inputs) this.inputs.view = view;
        this.hud?.setView(view);
        if (view === "third" && typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock?.();
    }

    viewMode(): ViewMode {
        return this.view;
    }

    private onControl(state: ControlState | null): void {
        if (!state) return;
        if (state.denied) {
            const id = this.pending?.id ?? state.animalId;
            this.pending = null;
            this.o.onEvent?.({kind: "denied", animalId: id, reason: state.denied});
            return;
        }
        if (state.released) {
            const id = this.active?.animal.id ?? state.animalId;
            this.teardown();
            this.o.onEvent?.({kind: "ended", animalId: id, reason: state.released.reason});
            return;
        }
        const animal = this.pending ?? this.active?.animal;
        this.pending = null;
        if (!animal) return;
        this.active = {animal};
        if (!this.inputs) {
            this.inputs = new ControlInputs(this.o.host);
            this.inputs.view = this.view;
            this.inputs.onRelease = () => this.end();
            this.inputs.onToggleView = () => this.setView(this.view === "third" ? "first" : "third");
            const own = this.live.ownState();
            if (own) this.inputs.yaw = own.yaw;
        }
        const a = this.live.ownAbilities();
        if (!this.hud && a) {
            this.hud = new ControlHud(this.o.host, this.inputs, this.words, a, this.o.insets?.() ?? {top: 0, bottom: 0});
            this.hud.onRelease = () => this.end();
            this.hud.onView = () => this.setView(this.view === "third" ? "first" : "third");
            this.hud.onCross = () => this.live.cross();
            this.hud.onTurnBack = () => this.live.turnBack();
            this.hud.onTalk = () => {
                if (this.talkTarget) this.o.onEvent?.({kind: "talk", animalId: this.talkTarget});
            };
            this.hud.setTalk(Boolean(this.talkTarget));
            this.hud.setView(this.view);
        }
        this.o.onEvent?.({kind: "started", animalId: animal.id});
    }

    private teardown(): void {
        this.active = null;
        this.inputs?.dispose();
        this.inputs = null;
        this.hud?.dispose();
        this.hud = null;
        this.lastMode = null;
    }

    /** One frame: input → the own animal's step and its pose out. */
    frame(dt: number): void {
        const input = this.inputs ? this.inputs.sample(dt) : null;
        this.live.step(input, dt);
        const own = this.live.ownState();
        if (own && own.mode !== this.lastMode) {
            if (this.lastMode && own.mode === "air") this.o.onEvent?.({kind: "haptic", type: "takeoff"});
            if (this.lastMode === "air" && own.mode !== "air") this.o.onEvent?.({kind: "haptic", type: "land"});
            this.lastMode = own.mode;
        }
        if (own?.blocked) this.hud?.notice_(own.blocked === "steep" ? "steep" : own.blocked === "pen" ? "pen" : own.blocked === "cant_swim" ? "cant_swim" : own.blocked === "paddle" ? "paddle" : "");
        if (own?.oneWayDrop) this.hud?.notice_("one_way_drop");
    }

    /** Phase 2: an NPC's reaction shared by the server, or null (its local layer). */
    npcReaction(id: string) {
        return this.live.npcReaction(id);
    }

    /** While the player talks to another animal, theirs holds still (stamina rests). */
    setTalking(active: boolean): void {
        this.live.setTalking(active);
    }

    poseFor(animalId: string): ControlledPose | null {
        return this.live.poseFor(animalId);
    }

    private world(): CameraWorld | null {
        const sampler = this.o.sampler();
        if (!sampler) return null;
        return {
            ground: (x, z) => sampler.heightAt(x, z),
            blocked: (x, z, r) => sampler.blocked(x, z, r),
            water: (x, z) => (sampler.isWater(x, z) ? waterLevelAt(x, z, 0) : null)
        };
    }

    /** The camera while controlling (null otherwise). */
    camera(aspect: number): CameraPose | null {
        const own = this.live.ownState();
        const a = this.live.ownAbilities();
        const world = this.world();
        if (!own || !a || !this.inputs || !world) return null;
        const view = {yaw: this.inputs.yaw, pitch: this.inputs.pitch};
        if (this.view === "first") return firstPerson(own, a, view, aspect, this.o.tier(), world);
        return thirdPerson(own, a, view, world);
    }

    /**
     * The peripheral cues (first person, wide-eyed prey and insects, D15): animals within its sight that its own wide
     * field would see but the screen doesn't show brighten that edge softly.
     */
    edges(nearby: Array<{x: number; z: number}>, aspect: number): void {
        const own = this.live.ownState();
        const a = this.live.ownAbilities();
        if (!this.hud || !own || !a || !this.inputs) return;
        if (this.view !== "first" || (a.fovClass !== "prey" && a.fovClass !== "insect")) {
            this.hud.setEdges(0, 0);
            return;
        }
        const half = ((Math.min(horizontalFov(a, this.o.tier()), 2 * (Math.atan(Math.tan((75 * Math.PI) / 360) * aspect) * 180) / Math.PI) / 2) * Math.PI) / 180;
        const field = 2.7;
        let left = 0;
        let right = 0;
        for (const p of nearby) {
            const d = Math.hypot(p.x - own.x, p.z - own.z);
            if (d < 0.3 || d > a.sight) continue;
            let rel = Math.atan2(p.x - own.x, p.z - own.z) - this.inputs.yaw;
            while (rel > Math.PI) rel -= Math.PI * 2;
            while (rel < -Math.PI) rel += Math.PI * 2;
            if (Math.abs(rel) <= half || Math.abs(rel) > field) continue;
            const w = 1 - d / a.sight;
            // (Yaw turns counter-clockwise: a positive bearing is to the left on screen.)
            if (rel > 0) left += w;
            else right += w;
        }
        this.hud.setEdges(left, right);
    }

    dispose(): void {
        this.teardown();
        this.live.dispose();
    }
}
