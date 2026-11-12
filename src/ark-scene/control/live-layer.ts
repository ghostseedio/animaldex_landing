/**
 * The page's side of `ark-live` (design §2.3–2.4, §3.1): the socket, the shared clock's offset, the controlled
 * animals everyone sees (interpolated 120 ms behind the server, pinned on every viewer), and the viewer's own animal
 * while they control it (moved at once by the shared mover, its poses sent at 10 Hz, corrected by the server).
 *
 * No DOM beyond `WebSocket`: input and the HUD are `input.ts` and `hud.ts`; the scene asks this for poses and clips.
 */

import {ClockSync} from "@/ark-live/clock";
import {RemoteTrack, INTERP_DELAY_MS} from "@/ark-live/interp";
import {decodeBinary, encodePing, encodePose, parseText, POSE_FLAG, u32ms, unwrapMs, type Clip, type ControlDeniedReason, type CorrectionMessage, type MeterMessage, type Mode, type ReleaseReason, type StartPose, type TextToClient, type TextToServer} from "@/ark-live/protocol";
import {abilitiesOf, type Abilities} from "@/ark-live/species";
import {LazyTerrain, type Terrain} from "@/ark-live/terrain";
import {NO_INPUT, startMover, stepMover, type ControlInput, type MoverState} from "@/ark-live/movement";
import {signals} from "@/ark-live/meters";
import type {AnimalFacts} from "@/ark-live/rules";
import {ISLANDS, type IslandId} from "@/ark-live/islands";
import {setArkClockOffset} from "@/ark-scene/shared-clock";
import type {ArkWorldSampler} from "@/ark-scene/world-sampler";
import type {HomePlot} from "@/ark-scene/props/home-layout";
import type {ArkArea, ArkZone} from "@/ark-scene/types";

export type LiveTier = "high" | "medium" | "low" | "lite";

export type LiveOptions = {
    url: string;
    island?: IslandId;
    tier: LiveTier;
    client?: string;
    appVersion?: string;
    sampler: () => ArkWorldSampler | null;
    plots?: () => HomePlot[] | null;
};

/** What the scene draws for a controlled animal: its pose, and the clip its rig plays. */
export type ControlledPose = {x: number; y: number; z: number; yaw: number; pitch: number; roll: number; mode: Mode; clip: Clip; speed: number; own: boolean; flags: number};

export type LiveEvents = {
    onStatus?: (status: LiveStatus) => void;
    onControl?: (state: ControlState | null) => void;
    onMeter?: (meter: MeterMessage) => void;
    onNotice?: (key: string) => void;
    onCrossing?: (phase: string, reason?: string) => void;
    onControlledSet?: (ids: ReadonlySet<string>) => void;
    /** Phase 2: the animal the controller's own is close enough to talk to (null: none). */
    onTalkReady?: (animalId: string | null) => void;
    /** Phase 3: a hunt's news (contact, confirmed for everyone, escaped, denied with why). */
    onHunt?: (phase: string, preyId: string, reason?: string) => void;
};

/** A server-shared NPC reaction (phase 2), eased from the last one over a fifth of a second. */
export type NpcReaction = {dx: number; dz: number; dyaw: number; doing: number; alarm: number};
const NPC_FRESH_MS = 600;
const NPC_EASE_MS = 200;

export type LiveStatus = "connecting" | "open" | "closed" | "slow";

export type ControlState = {
    animalId: string;
    slug: string;
    sessionId: string;
    sessionLeft: number;
    dayLeft: number;
    stamina: number;
    released?: {reason: ReleaseReason; plan: string | null};
    denied?: ControlDeniedReason;
};

const POSE_HZ = 10;
const STILL_HZ = 1;
const SNAP_DISTANCE = 1.5;
const BLEND_S = 0.15;

export class LiveLayer {
    private ws: WebSocket | null = null;
    private readonly clock = new ClockSync();
    private epochBase = 0;
    private unit = 0.01;
    private status: LiveStatus = "connecting";
    private readonly byIdx = new Map<number, {animalId: string; slug: string}>();
    private readonly tracks = new Map<string, RemoteTrack>();
    private readonly controlled = new Set<string>();
    private retry = 0;
    private closedByUs = false;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private pendingStart: {ticket: string; start: StartPose; facts: AnimalFacts} | null = null;
    // The viewer's own animal.
    private own: {state: MoverState; facts: AnimalFacts; a: Abilities; sessionId: string; resumeToken: string; seq: number; lastSent: number; blend: {dx: number; dy: number; dz: number; left: number} | null; meter: MeterMessage | null; strikeUntil?: number} | null = null;
    private terrain: Terrain | null = null;
    private readonly island: IslandId;
    lastMeter: MeterMessage | null = null;
    private okWaiting: {m: Extract<TextToClient, {t: "control-ok"}>; facts: AnimalFacts} | null = null;
    private readonly npcTable: string[] = [];
    private readonly npcs = new Map<string, {from: NpcReaction; to: NpcReaction; at: number}>();

    constructor(private readonly o: LiveOptions, private readonly events: LiveEvents = {}) {
        this.island = o.island ?? "wild";
        this.connect();
    }

    // MARK: Socket

    private connect(): void {
        const url = `${this.o.url.replace(/\/+$/, "")}/v1/live?island=${this.island}&tier=${this.o.tier}`;
        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch {
            this.setStatus("closed");
            return;
        }
        ws.binaryType = "arraybuffer";
        this.ws = ws;
        this.setStatus("connecting");
        ws.onopen = () => {
            this.retry = 0;
            this.send({t: "hello", proto: 1, island: this.island, tier: this.o.tier, client: this.o.client, appVersion: this.o.appVersion});
            // Eight pings 100 ms apart for the clock, then one every 10 s.
            for (let i = 0; i < 8; i++) setTimeout(() => this.ping(), i * 100);
            this.pingTimer = setInterval(() => this.ping(), 10_000);
            // A controller that dropped resumes its session.
            if (this.own) this.send({t: "resume", sessionId: this.own.sessionId, token: this.own.resumeToken});
        };
        ws.onmessage = (event) => this.onMessage(event.data as ArrayBuffer | string);
        ws.onclose = () => {
            if (this.pingTimer) clearInterval(this.pingTimer);
            this.pingTimer = null;
            this.ws = null;
            this.setStatus("closed");
            if (this.closedByUs) return;
            // Back off: 1, 2, 4 … 30 s. Remote animals fade back to their formula poses meanwhile.
            const wait = Math.min(30_000, 1000 * 2 ** Math.min(this.retry++, 5));
            setTimeout(() => !this.closedByUs && this.connect(), wait);
        };
    }

    private setStatus(status: LiveStatus): void {
        if (status === this.status) return;
        this.status = status;
        this.events.onStatus?.(status);
    }

    private send(message: TextToServer): void {
        if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(message));
    }

    private ping(): void {
        if (this.ws?.readyState === 1) this.ws.send(encodePing(u32ms(Date.now())));
    }

    available(): boolean {
        return this.status === "open" || this.status === "slow";
    }

    private onMessage(data: ArrayBuffer | string): void {
        if (typeof data === "string") {
            const m = parseText<TextToClient>(data);
            if (m) this.onText(m);
            return;
        }
        const d = decodeBinary(data, this.unit);
        if (!d) return;
        const nowClient = Date.now();
        switch (d.type) {
            case "pong": {
                const c0 = unwrapMs(d.c0, nowClient);
                const sAbs = this.epochBase + unwrapMs(d.s, nowClient - this.epochBase);
                this.clock.add(c0, sAbs, nowClient);
                const offset = this.clock.offset(nowClient);
                if (offset !== null) setArkClockOffset(offset);
                this.setStatus(this.clock.tooSlow(nowClient) ? "slow" : "open");
                return;
            }
            case "snapshot": {
                const tick = this.epochBase + unwrapMs(d.snapshot.tick, this.serverNow() - this.epochBase);
                for (const e of d.snapshot.entities) {
                    const who = this.byIdx.get(e.idx);
                    if (!who) continue;
                    let track = this.tracks.get(who.animalId);
                    if (!track) this.tracks.set(who.animalId, (track = new RemoteTrack()));
                    track.push({t: tick, x: e.x, y: e.y, z: e.z, yaw: e.yaw, roll: e.roll, speed: e.speed, mode: e.mode, clip: e.clip, phase: e.phase, flags: e.flags});
                }
                return;
            }
            case "correction":
                this.onCorrection(d.correction);
                return;
            case "npc": {
                const now = Date.now();
                for (const e of d.npc.offsets) {
                    const id = this.npcTable[e.idx];
                    if (!id) continue;
                    const from = this.npcReaction(id, now) ?? {dx: 0, dz: 0, dyaw: 0, doing: e.doing, alarm: 0};
                    this.npcs.set(id, {from, to: {dx: e.dx, dz: e.dz, dyaw: e.dyaw, doing: e.doing, alarm: e.alarm}, at: now});
                }
                return;
            }
            case "meter":
                this.lastMeter = d.meter;
                if (this.own) this.own.meter = d.meter;
                this.events.onMeter?.(d.meter);
                return;
            default:
                return;
        }
    }

    private onText(m: TextToClient): void {
        switch (m.t) {
            case "welcome":
                this.epochBase = m.epochBase;
                this.unit = m.unit;
                this.setStatus("open");
                if (this.pendingStart) this.send({t: "control", ticket: this.pendingStart.ticket, start: this.pendingStart.start});
                return;
            case "joined":
                this.byIdx.set(m.idx, {animalId: m.animalId, slug: m.slug});
                this.controlled.add(m.animalId);
                this.events.onControlledSet?.(this.controlled);
                return;
            case "left": {
                const who = this.byIdx.get(m.idx);
                this.byIdx.delete(m.idx);
                if (who) {
                    this.controlled.delete(who.animalId);
                    this.tracks.delete(who.animalId);
                    this.events.onControlledSet?.(this.controlled);
                }
                return;
            }
            case "control-ok": {
                const pending = this.pendingStart;
                this.pendingStart = null;
                const facts = pending?.facts ?? this.own?.facts;
                if (!facts) return;
                const a = abilitiesOf(m.slug);
                const terrain = this.terrainNow();
                if (!terrain) {
                    // (No ground to move on yet: finished on the first frame that has it, never dropped.)
                    this.okWaiting = {m, facts};
                    return;
                }
                this.okWaiting = null;
                const state = this.own && this.own.sessionId === m.sessionId ? this.own.state : startMover(m.start, {a, facts, terrain, sig: null});
                this.own = {state, facts, a, sessionId: m.sessionId, resumeToken: m.resumeToken, seq: this.own?.seq ?? 0, lastSent: 0, blend: null, meter: this.own?.meter ?? null};
                this.events.onControl?.({animalId: m.animalId, slug: m.slug, sessionId: m.sessionId, sessionLeft: m.sessionLeft, dayLeft: m.dayLeft, stamina: m.stamina});
                return;
            }
            case "control-denied":
                if (this.pendingStart) {
                    const id = this.pendingStart.facts.id;
                    this.pendingStart = null;
                    this.events.onControl?.({animalId: id, slug: "", sessionId: "", sessionLeft: 0, dayLeft: 0, stamina: 0, denied: m.reason});
                } else if (this.own && m.reason === "bad_ticket") {
                    // The resume failed: the session ended while away.
                    const id = this.own.facts.id;
                    this.own = null;
                    this.events.onControl?.({animalId: id, slug: "", sessionId: "", sessionLeft: 0, dayLeft: 0, stamina: 0, released: {reason: "disconnect", plan: null}});
                }
                return;
            case "released": {
                const id = this.own?.facts.id ?? "";
                this.own = null;
                this.events.onControl?.({animalId: id, slug: "", sessionId: "", sessionLeft: 0, dayLeft: 0, stamina: 0, released: {reason: m.reason, plan: m.plan}});
                this.events.onControl?.(null);
                return;
            }
            case "notice":
                this.events.onNotice?.(m.key);
                return;
            case "npcs":
                m.ids.forEach((id, i) => (this.npcTable[m.base + i] = id));
                return;
            case "talk-ready":
                this.events.onTalkReady?.(m.animalId);
                return;
            case "hunt":
                // The strike plays from the contact while the ecology decides (a second or two).
                if (m.phase === "contact" && this.own) this.own.strikeUntil = Date.now() + 1200;
                this.events.onHunt?.(m.phase, m.preyId, m.reason);
                return;
            case "crossing":
                this.events.onCrossing?.(m.phase, m.reason);
                return;
            default:
                return;
        }
    }

    private terrainNow(): Terrain | null {
        if (this.terrain) return this.terrain;
        const sampler = this.o.sampler();
        if (!sampler) return null;
        const plots = this.o.plots?.() ?? null;
        this.terrain = new LazyTerrain(this.island, ISLANDS[this.island].half, sampler, plots ? {plots} : null);
        return this.terrain;
    }

    // MARK: Clock

    /** Server epoch ms now (the device clock until the first pong). */
    serverNow(): number {
        return this.clock.serverNow(Date.now()) ?? Date.now();
    }

    rtt(): number | null {
        return this.clock.rtt();
    }

    // MARK: Control

    /** Ask to control an animal with a ticket (minted by the database for the signed-in viewer). */
    startControl(ticket: string, facts: {id: string; slug: string; zone: ArkZone; area: ArkArea | null}, start: StartPose): void {
        this.pendingStart = {ticket, start, facts: {...facts, enclosure: null}};
        if (this.ws?.readyState === 1) this.send({t: "control", ticket, start});
    }

    release(): void {
        this.send({t: "release"});
    }

    cross(): void {
        this.send({t: "cross"});
    }

    turnBack(): void {
        this.send({t: "turn-back"});
    }

    controllingId(): string | null {
        return this.own?.facts.id ?? null;
    }

    ownAbilities(): Abilities | null {
        return this.own?.a ?? null;
    }

    ownState(): MoverState | null {
        return this.own?.state ?? null;
    }

    private onCorrection(c: CorrectionMessage): void {
        const own = this.own;
        if (!own) return;
        const s = own.state;
        const dx = s.x - c.x;
        const dy = s.y - c.y;
        const dz = s.z - c.z;
        const far = Math.hypot(dx, dz) > SNAP_DISTANCE || c.mode !== s.mode;
        own.state = {...s, x: c.x, y: c.y, z: c.z, yaw: c.yaw, mode: c.mode, speed: 0};
        // Under 1.5 m it eases to the server's pose over 150 ms (drawn offset decays); over, it snaps.
        own.blend = far ? null : {dx, dy, dz, left: BLEND_S};
    }

    /** One frame: the own animal moves by the input and its pose goes out at 10 Hz (1 Hz when still). */
    step(input: ControlInput | null, dt: number): void {
        if (this.okWaiting && this.terrainNow()) {
            const waiting = this.okWaiting;
            this.okWaiting = null;
            this.pendingStart = {ticket: "", start: waiting.m.start, facts: waiting.facts};
            this.onText(waiting.m);
        }
        const own = this.own;
        if (!own) return;
        const terrain = this.terrainNow();
        if (!terrain) return;
        const nowS = this.serverNow() / 1000;
        const sig = own.meter ? signals({stamina: own.meter.stamina, exposure: own.meter.exposure, lyingUntil: 0}, nowS) : null;
        own.state = stepMover(own.state, input ?? NO_INPUT, dt, {a: own.a, facts: own.facts, terrain, sig});
        if (own.blend) {
            own.blend.left -= dt;
            if (own.blend.left <= 0) own.blend = null;
        }
        const now = Date.now();
        const still = own.state.speed < 0.05 && own.state.mode !== "air";
        if (now - own.lastSent >= 1000 / (still ? STILL_HZ : POSE_HZ) && this.ws?.readyState === 1) {
            own.lastSent = now;
            own.seq = (own.seq + 1) & 0xffff;
            let flags = 0;
            if (input?.run) flags |= POSE_FLAG.RUN;
            if (input?.stalk) flags |= POSE_FLAG.STALK;
            if (input?.sprint) flags |= POSE_FLAG.SPRINT;
            if (still) flags |= POSE_FLAG.STILL;
            this.ws.send(encodePose({...own.state, seq: own.seq, t: this.serverNow() - this.epochBase, flags}, this.unit));
        }
    }

    // MARK: What the scene draws

    /** Every animal under control now (pinned on this viewer: always drawn one by one). */
    controlledIds(): ReadonlySet<string> {
        return this.controlled;
    }

    /** The pose to draw for a controlled animal, or null (not controlled, or no samples yet). */
    poseFor(animalId: string): ControlledPose | null {
        const own = this.own;
        if (own && own.facts.id === animalId) {
            const s = own.state;
            const b = own.blend;
            const k = b ? b.left / BLEND_S : 0;
            const striking = (own.strikeUntil ?? 0) > Date.now() && s.mode === "ground";
            return {x: s.x + (b ? b.dx * k : 0), y: s.y + (b ? b.dy * k : 0), z: s.z + (b ? b.dz * k : 0), yaw: s.yaw, pitch: s.pitch, roll: s.roll, mode: s.mode, clip: striking ? "strike" : s.clip, speed: s.speed, own: true, flags: 0};
        }
        const track = this.tracks.get(animalId);
        if (!track || !this.controlled.has(animalId)) return null;
        const at = track.at(this.serverNow() - INTERP_DELAY_MS[this.o.tier]);
        if (!at) return null;
        return {x: at.x, y: at.y, z: at.z, yaw: at.yaw, pitch: 0, roll: at.roll, mode: at.mode, clip: at.stale ? "idle" : at.clip, speed: at.stale ? 0 : at.speed, own: false, flags: at.flags};
    }

    /**
     * Phase 2: how an NPC reacts now, as the server worked it out for everyone (eased between its 5 Hz updates); null
     * when the server says nothing about it (its own local layer then, as before).
     */
    npcReaction(id: string, now = Date.now()): NpcReaction | null {
        const r = this.npcs.get(id);
        if (!r) return null;
        if (now - r.at > NPC_FRESH_MS) {
            this.npcs.delete(id);
            return null;
        }
        const k = Math.min((now - r.at) / NPC_EASE_MS, 1);
        return {dx: r.from.dx + (r.to.dx - r.from.dx) * k, dz: r.from.dz + (r.to.dz - r.from.dz) * k, dyaw: r.from.dyaw + (r.to.dyaw - r.from.dyaw) * k, doing: r.to.doing, alarm: r.to.alarm};
    }

    /** The controller's animal holds still while its player talks (design §6.3). */
    setTalking(active: boolean): void {
        this.send({t: "talking", active});
    }

    /** A watcher's view centre (the server sends it the nearest controlled animals). */
    setView(x: number, z: number, r: number): void {
        this.send({t: "view", x, z, r});
    }

    dispose(): void {
        this.closedByUs = true;
        if (this.pingTimer) clearInterval(this.pingTimer);
        try {
            this.ws?.close();
        } catch {
            // (Already closed.)
        }
        setArkClockOffset(0);
    }
}
