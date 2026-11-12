/**
 * The room core of `ark-live` (design §2.2–2.6, §12.1–12.3): one room per island. It holds the watchers and the
 * controllers, checks every pose (`validate.ts`), runs the meters and the limits, writes traces and heartbeats through
 * the store, releases animals back into NPC life (`release.ts`), sends each viewer the nearest controlled animals at
 * its tier's rate, and hands a crossing animal to the other island's room at halfway.
 *
 * Transport-agnostic and runtime-agnostic (design §2.7: it can move to a Cloudflare Durable Object): no Node APIs. The
 * transport gives it `ClientLink`s and frames; the store (`Store`) is the only way out to the database.
 */

import {abilitiesOf, controllable, type Abilities} from "@/ark-live/species";
import {ISLANDS, type IslandId, type Strait} from "@/ark-live/islands";
import {
    decodeBinary,
    encodeCorrection,
    encodeMeter,
    encodePong,
    encodeSnapshot,
    ENTITY_FLAG,
    FRAME_OVERHEAD_BYTES,
    METER_FLAG,
    parseText,
    PROTOCOL_VERSION,
    unwrapMs,
    type ControlDeniedReason,
    type CorrectionReason,
    type Mode,
    type ReleaseReason,
    type SnapshotEntity,
    type StartPose,
    type TextToClient,
    type TextToServer,
    type WirePose
} from "@/ark-live/protocol";
import {verifyTicket} from "@/ark-live/ticket";
import type {Terrain} from "@/ark-live/terrain";
import {cellAllows, type AnimalFacts} from "@/ark-live/rules";
import {newMotion, validatePose, type Motion} from "@/ark-live/validate";
import {drainKind, freshMeters, signals, stepMeters, type Meters} from "@/ark-live/meters";
import {suitability, type AnimalHome} from "@/ark-live/habitat";
import {AOI_CAP, DISCONNECT_GRACE_S, HEARTBEAT_S, isTier, MAX_CONTROLLERS_PER_ROOM, METER_HZ, SNAPSHOT_HZ, StartLimiter, timeLeft, traceStep, type Tier} from "@/ark-live/session";
import {homeOverrideOf, homeRadius, planRelease, type HomeDisc, type HomeOverride} from "@/ark-live/release";
import type {ReleasePlan} from "@/ark-live/plan-eval";
import {arrivalPoint, corridorToIsland, crossingDone, crossingStep, preCheck, rescueStep, startCrossing, type Crossing} from "@/ark-live/crossing";
import {ZONE_SITES} from "@/ark-scene/world";
import {encodeNpc, type NpcOffset} from "@/ark-live/protocol";
import {actionCode, NPC_HZ, type NpcReactions} from "@/ark-live/npc-reactions";
import type {NpcWorld} from "@/ark-live/npc-world";
import {eats as foodEats} from "@/ark-scene/food-links";
import {ZONE_REGION, type ArkArea, type ArkZone} from "@/ark-scene/types";

export interface ClientLink {
    send(data: ArrayBuffer | string): void;
    close(code?: number, reason?: string): void;
    /** A crossing moved this link to another island's room: route its frames there from now on. */
    rebind?(room: Room, clientId: number): void;
}

export type StoreAnimal = {
    id: string;
    slug: string;
    zone: ArkZone;
    area: ArkArea | null;
    /** The island it arrived on (its pair island; its formula home is there). */
    island: IslandId;
    /** What names its formula home in the shared position module (`HomeRef`): its look's species id and its slot. */
    species_profile_id?: string;
    slot?: number | null;
    slot_rank?: number | null;
    /** A zoo animal's enclosure key (Part C: `voyage_animals.enclosure`, `<type>-<n>`), or null. */
    enclosure: string | null;
    label: string;
    named: boolean;
    asleep_hint?: boolean;
};

export type StartResult =
    | {ok: true; animal: StoreAnimal; quota: {session_limit_s: number; day_used_s: number; day_limit_s: number}}
    | {ok: false; reason: ControlDeniedReason};

export type StoredState = {
    animal_id: string;
    island: IslandId;
    released_at: string;
    plan: ReleasePlan;
    zone: ArkZone | null;
    stamina: number;
    exposure: number;
    /** Two islands: when it last arrived by a crossing, and where it came ashore. */
    crossed?: {arrived_at: string; x: number; z: number; from: IslandId} | null;
    /** The shared position module's `HomeOverride` (null: the formula home). */
    home?: HomeOverride | null;
};

export type TraceRow = {animal_id: string; step: number; island: string; x: number; z: number; y: number; mode: Mode; band: string | null};

export type SessionStats = {distance_m: number; max_speed: number; rejections: number; clamped: number; dropped: number; client: string | null; app_version: string | null};

export type EndState = {
    island: IslandId;
    released_at: string;
    release: {x: number; y: number; z: number; yaw: number; mode: Mode; band: string | null};
    plan: ReleasePlan;
    zone: ArkZone | null;
    stranded_from: string | null;
    stamina: number;
    exposure: number;
    crossed: StoredState["crossed"];
    /** `home_island`, `home_x`, `home_z`, `home_r` in the database: the shared position module's `HomeOverride`. */
    home: HomeOverride | null;
};

/** Phase 3: a player kill, as the database decides it (contract: ark_live_meal_request_v1 / ark_live_meal_status_v1). */
export type MealRequest = {ok: true; id: string} | {ok: false; reason: string};
export type MealStatus = {status: "pending" | "confirmed" | "rejected" | "expired"; reason?: string};

export interface Store {
    /** Phase 3 (optional: phase 1 stores have none, and hunting stays off). */
    mealRequest?(sessionId: string, predatorId: string, preyId: string, evidence: Record<string, unknown>): Promise<MealRequest>;
    mealStatus?(id: string): Promise<MealStatus>;
    start(args: {nonce: string; sessionId: string; userId: string; animalId: string; island: IslandId; client: string | null; appVersion: string | null}): Promise<StartResult>;
    heartbeat(sessionIds: string[]): Promise<void>;
    trace(rows: TraceRow[]): Promise<void>;
    end(sessionId: string, reason: ReleaseReason, stats: SessionStats, state: EndState): Promise<void>;
    /** The animal's stored record (a previous release), or null. */
    stateOf(animalId: string): Promise<StoredState | null>;
}

export type HomeLookup = (facts: AnimalFacts, a: Abilities, state: StoredState | null, ref: {island: IslandId; speciesId: string | null; slot: number | null; rank: number | null}) => HomeDisc;

export type RoomOptions = {
    island: IslandId;
    terrain: Terrain;
    ticketKey: string;
    store: Store;
    now: () => number;
    epochBase: number;
    straits?: Strait[];
    /** The other islands' rooms (in this process), for crossings. */
    peers?: () => Map<IslandId, Room>;
    /** One live session per person across every room (D2). */
    userSessions?: Map<string, {island: IslandId; sessionId: string}>;
    /**
     * Where an animal's home disc is: the shared position module's `homeOf(atlas, ref, override)` once its web copy is in
     * (`src/ark-scene/positions/`), else a stored record's settled disc or its zone's site (`defaultHomeOf`).
     */
    homeOf?: HomeLookup;
    /** Phase 2: the shared schedule and reactions near players, once built (null until then, or without a snapshot). */
    npc?: () => {world: NpcWorld; reactions: NpcReactions} | null;
    /**
     * Phase 3: whether a predator is due to hunt now (the encounter lane's `voyage_hunting_v1` hunt_from), or null when
     * nobody knows here (the database's re-check decides). Absent: hunting is off in this room.
     */
    hunting?: () => {due(animalId: string, nowMs: number): boolean | null} | null;
    log?: (line: string) => void;
};

type Client = {
    id: number;
    link: ClientLink;
    tier: Tier;
    view: {x: number; z: number; r: number} | null;
    sessionId: string | null;
    lastSnapAt: number;
    bytesOut: number;
    bytesIn: number;
    messagesOut: number;
    client: string | null;
    appVersion: string | null;
    starting: boolean;
};

export type Session = {
    id: string;
    userId: string;
    animalId: string;
    slug: string;
    idx: number;
    facts: AnimalFacts;
    home: AnimalHome;
    homeDisc: HomeDisc;
    /** The island it arrived on (its formula home's). */
    homeIsland: IslandId;
    /** What names its formula home (the shared position module's `HomeRef`). */
    homeRef: {speciesId: string | null; slot: number | null; rank: number | null};
    a: Abilities;
    motion: Motion;
    meters: Meters;
    startedAt: number;
    dayUsedAtStart: number;
    dayLimit: number;
    sessionLimit: number;
    clientId: number | null;
    disconnectedAt: number | null;
    resumeToken: string;
    crossing: Crossing | null;
    /** Arrived on this island by a crossing during this session (for the retrace). */
    crossed: StoredState["crossed"];
    talking: boolean;
    /** Phase 3: a contact being held (mouth on the prey), a kill being decided, and a pause after either. */
    contact: {preyId: string; since: number} | null;
    hunt: {id: string; preyId: string; at: number; lastPoll: number} | null;
    huntQuietUntil: number;
    lastMeterAt: number;
    lastTraceStep: number;
    stamina0: number;
    client: string | null;
    appVersion: string | null;
    flags: number;
};

const randomToken = (): string => {
    const bytes = new Uint8Array(16);
    (globalThis as {crypto: Crypto}).crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const uuid = (): string => {
    const c = (globalThis as {crypto: Crypto & {randomUUID?: () => string}}).crypto;
    if (c.randomUUID) return c.randomUUID();
    const h = randomToken();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/** The default home disc: a stored record's settle disc, else its zone's site (the scene's placement gathers it there). */
export function defaultHomeOf(facts: AnimalFacts, a: Abilities, state: StoredState | null): HomeDisc {
    if (state?.home && typeof state.home.x === "number" && typeof state.home.z === "number") return {x: state.home.x, z: state.home.z, r: state.home.r ?? homeRadius(a)};
    if (state?.plan.settle) return state.plan.settle;
    const zone = state?.zone ?? facts.zone;
    const site = facts.area ? ZONE_SITES.farm_garden : ZONE_SITES[zone] ?? ZONE_SITES.grassland;
    return {x: site.x, z: site.z, r: Math.max(site.clearing, homeRadius(a))};
}

export class Room {
    readonly island: IslandId;
    readonly unit: number;
    private readonly clients = new Map<number, Client>();
    private readonly sessions = new Map<string, Session>();
    private readonly byAnimal = new Map<string, string>();
    private readonly limiter = new StartLimiter();
    private readonly freeIdx: number[] = [];
    private nextIdx = 1;
    private nextClient = 1;
    private lastHeartbeat = 0;
    private traceBuffer: TraceRow[] = [];
    // Phase 2: the NPCs reacting near players, by a room-wide index (the `npcs` table each viewer keeps).
    private readonly npcIdx = new Map<string, number>();
    private readonly npcIds: string[] = [];
    private lastNpcAt = 0;
    private readonly talkReady = new Map<string, string | null>();
    private lastTalkAt = 0;
    readonly counters = {posesIn: 0, accepted: 0, corrections: 0, snapshots: 0, bytesOut: 0, bytesIn: 0, messagesOut: 0, tickMs: 0, ticks: 0, releases: 0, starts: 0, denied: 0};
    /** Corrections by reason and species (the audit; a pattern of rejected sprints shows here). */
    readonly correctionReasons: Record<string, number> = {};
    private readonly userSessions: Map<string, {island: IslandId; sessionId: string}>;

    constructor(private readonly o: RoomOptions) {
        this.island = o.island;
        this.unit = ISLANDS[o.island].unit;
        this.userSessions = o.userSessions ?? new Map();
    }

    // MARK: Clients

    connect(link: ClientLink, query: {tier?: string | null} = {}): number {
        const id = this.nextClient++;
        const tier: Tier = isTier(query.tier) ? query.tier : "high";
        const client: Client = {id, link, tier, view: null, sessionId: null, lastSnapAt: 0, bytesOut: 0, bytesIn: 0, messagesOut: 0, client: null, appVersion: null, starting: false};
        this.clients.set(id, client);
        this.sendText(client, {t: "welcome", proto: PROTOCOL_VERSION, island: this.island, epochBase: this.o.epochBase, unit: this.unit, rate: SNAPSHOT_HZ[tier], aoi: AOI_CAP[tier], tier});
        for (const s of Array.from(this.sessions.values())) this.sendText(client, {t: "joined", idx: s.idx, animalId: s.animalId, slug: s.slug, island: this.island});
        if (this.npcIds.length) this.sendText(client, {t: "npcs", base: 0, ids: this.npcIds.slice()});
        return id;
    }

    disconnect(clientId: number): void {
        const client = this.clients.get(clientId);
        if (!client) return;
        this.clients.delete(clientId);
        if (client.sessionId) {
            const s = this.sessions.get(client.sessionId);
            if (s && s.clientId === clientId) {
                s.clientId = null;
                s.disconnectedAt = this.o.now();
            }
        }
    }

    clientCount(): number {
        return this.clients.size;
    }

    sessionCount(): number {
        return this.sessions.size;
    }

    sessionFor(animalId: string): Session | null {
        const id = this.byAnimal.get(animalId);
        return id ? this.sessions.get(id) ?? null : null;
    }

    clientBytes(): Array<{id: number; tier: Tier; out: number; in: number; controlling: boolean}> {
        return Array.from(this.clients.values(), (c) => ({id: c.id, tier: c.tier, out: c.bytesOut, in: c.bytesIn, controlling: Boolean(c.sessionId)}));
    }

    private sendText(client: Client, message: TextToClient): void {
        const text = JSON.stringify(message);
        client.link.send(text);
        const bytes = text.length + FRAME_OVERHEAD_BYTES;
        client.bytesOut += bytes;
        client.messagesOut++;
        this.counters.bytesOut += bytes;
        this.counters.messagesOut++;
    }

    private sendBinary(client: Client, data: ArrayBuffer): void {
        client.link.send(data);
        const bytes = data.byteLength + FRAME_OVERHEAD_BYTES;
        client.bytesOut += bytes;
        client.messagesOut++;
        this.counters.bytesOut += bytes;
        this.counters.messagesOut++;
    }

    private broadcastText(message: TextToClient): void {
        for (const c of Array.from(this.clients.values())) this.sendText(c, message);
    }

    // MARK: Frames

    /** A frame from a client: binary (ping, pose) or text (the rare messages). */
    message(clientId: number, data: ArrayBuffer | ArrayBufferView | string): void {
        const client = this.clients.get(clientId);
        if (!client) return;
        const size = typeof data === "string" ? data.length : data.byteLength;
        client.bytesIn += size + FRAME_OVERHEAD_BYTES;
        this.counters.bytesIn += size + FRAME_OVERHEAD_BYTES;
        if (typeof data === "string") {
            if (data.length > 2000) return;
            const message = parseText<TextToServer>(data);
            if (message) void this.onText(client, message);
            return;
        }
        const decoded = decodeBinary(data, this.unit);
        if (!decoded) return;
        const now = this.o.now();
        if (decoded.type === "ping") {
            this.sendBinary(client, encodePong(decoded.c0, now - this.o.epochBase));
            return;
        }
        if (decoded.type === "pose") {
            this.counters.posesIn++;
            const s = client.sessionId ? this.sessions.get(client.sessionId) : null;
            if (!s || s.clientId !== client.id) return;
            const pose = {...decoded.pose, t: unwrapMs(decoded.pose.t, now - this.o.epochBase) + this.o.epochBase};
            if (s.crossing) {
                this.crossingPose(s, client, pose, now);
                return;
            }
            const verdict = validatePose(s.motion, pose, now, this.ctx(s, now));
            if (verdict.kind === "accept") {
                this.counters.accepted++;
                s.flags = pose.flags;
            } else if (verdict.kind === "reject") {
                this.counters.corrections++;
                const key = `${verdict.reason}:${s.slug}:${s.motion.last.mode}>${pose.mode}`;
                this.correctionReasons[key] = (this.correctionReasons[key] ?? 0) + 1;
                this.correct(client, s, verdict.reason, pose.seq);
                if (verdict.stumble) this.sendText(client, {t: "notice", key: "stumble"});
                if (verdict.end) this.release(s, "rejections");
            }
        }
    }

    private ctx(s: Session, now: number) {
        return {a: s.a, facts: s.facts, terrain: this.o.terrain, sig: signals(s.meters, now / 1000)};
    }

    private correct(client: Client, s: Session, reason: CorrectionReason, seq: number): void {
        const p = s.motion.last;
        this.sendBinary(client, encodeCorrection({seq, reason, x: p.x, y: p.y, z: p.z, yaw: p.yaw, mode: p.mode, clip: p.clip}, this.unit));
    }

    private async onText(client: Client, m: TextToServer): Promise<void> {
        switch (m.t) {
            case "hello":
                if (isTier(m.tier)) client.tier = m.tier;
                client.client = typeof m.client === "string" ? m.client.slice(0, 40) : null;
                client.appVersion = typeof m.appVersion === "string" ? m.appVersion.slice(0, 40) : null;
                return;
            case "view":
                if (Number.isFinite(m.x) && Number.isFinite(m.z)) client.view = {x: m.x, z: m.z, r: Number.isFinite(m.r) ? Math.min(Math.max(m.r ?? 200, 10), 1000) : 200};
                return;
            case "control":
                await this.startControl(client, m.ticket, m.start);
                return;
            case "resume": {
                const s = this.sessions.get(m.sessionId);
                if (!s || s.resumeToken !== m.token) {
                    this.sendText(client, {t: "control-denied", reason: "bad_ticket"});
                    return;
                }
                const old = s.clientId !== null ? this.clients.get(s.clientId) : null;
                if (old && old.id !== client.id) old.sessionId = null;
                s.clientId = client.id;
                s.disconnectedAt = null;
                client.sessionId = s.id;
                const left = timeLeft(s.startedAt, this.o.now(), s.dayUsedAtStart, s.dayLimit, s.sessionLimit);
                const p = s.motion.last;
                this.sendText(client, {t: "control-ok", sessionId: s.id, resumeToken: s.resumeToken, idx: s.idx, animalId: s.animalId, slug: s.slug, start: {x: p.x, y: p.y, z: p.z, yaw: p.yaw, mode: p.mode}, sessionLeft: left.sessionLeft, dayLeft: left.dayLeft, stamina: s.meters.stamina});
                return;
            }
            case "release": {
                const s = client.sessionId ? this.sessions.get(client.sessionId) : null;
                if (s && s.clientId === client.id) await this.release(s, "player");
                return;
            }
            case "cross": {
                const s = client.sessionId ? this.sessions.get(client.sessionId) : null;
                if (s && s.clientId === client.id && !s.crossing) this.beginCrossing(client, s);
                return;
            }
            case "turn-back": {
                const s = client.sessionId ? this.sessions.get(client.sessionId) : null;
                if (s?.crossing && !s.crossing.committed) {
                    s.crossing.rescue = "back";
                    this.sendText(client, {t: "crossing", phase: "turned-back"});
                }
                return;
            }
            case "talking": {
                const s = client.sessionId ? this.sessions.get(client.sessionId) : null;
                if (s) s.talking = Boolean(m.active);
                return;
            }
            default:
                return;
        }
    }

    // MARK: Control

    private deny(client: Client, reason: ControlDeniedReason): void {
        this.counters.denied++;
        this.sendText(client, {t: "control-denied", reason});
    }

    private async startControl(client: Client, ticketText: string, start: StartPose): Promise<void> {
        if (client.starting || client.sessionId) return this.deny(client, "other_animal");
        const now = this.o.now();
        const check = await verifyTicket(String(ticketText ?? ""), this.o.ticketKey, Math.floor(now / 1000));
        if (!check.ok) return this.deny(client, check.reason);
        const ticket = check.ticket;
        if (ticket.island !== this.island) return this.deny(client, "wrong_island");
        if (!this.limiter.allow(ticket.user, now)) return this.deny(client, "rate");
        if (this.userSessions.has(ticket.user)) return this.deny(client, "other_animal");
        if (this.byAnimal.has(ticket.animal)) return this.deny(client, "busy");
        if (this.sessions.size >= MAX_CONTROLLERS_PER_ROOM) return this.deny(client, "full");
        if (!start || ![start.x, start.y, start.z, start.yaw].every(Number.isFinite)) return this.deny(client, "start_pose");
        client.starting = true;
        const sessionId = uuid();
        let result: StartResult;
        let state: StoredState | null;
        try {
            result = await this.o.store.start({nonce: ticket.nonce, sessionId, userId: ticket.user, animalId: ticket.animal, island: this.island, client: client.client, appVersion: client.appVersion});
            state = result.ok ? await this.o.store.stateOf(ticket.animal) : null;
        } catch (error) {
            client.starting = false;
            this.o.log?.(`store.start failed: ${(error as Error).message}`);
            return this.deny(client, "store");
        }
        client.starting = false;
        if (!this.clients.has(client.id)) {
            if (result.ok) await this.o.store.end(sessionId, "disconnect", emptyStats(), this.stillState(ticket.animal, start, now, result.animal.zone));
            return;
        }
        if (!result.ok) return this.deny(client, result.reason);
        // (Re-checked after the await: another start may have won meanwhile.)
        if (this.userSessions.has(ticket.user) || this.byAnimal.has(ticket.animal)) {
            await this.o.store.end(sessionId, "replaced", emptyStats(), this.stillState(ticket.animal, start, now, result.animal.zone));
            return this.deny(client, "busy");
        }
        const animal = result.animal;
        if (!controllable(animal.slug)) {
            await this.o.store.end(sessionId, "player", emptyStats(), this.stillState(ticket.animal, start, now, animal.zone));
            return this.deny(client, "sessile");
        }
        const a = abilitiesOf(animal.slug);
        const facts: AnimalFacts = {id: animal.id, slug: animal.slug, zone: animal.zone, area: animal.area, enclosure: animal.enclosure ?? null, pen: animal.enclosure ? this.o.terrain.penOf?.(animal.enclosure) ?? null : null};
        const home: AnimalHome = {zone: animal.zone, area: animal.area};
        const homeDisc = (this.o.homeOf ?? defaultHomeOf)(facts, a, state, {island: animal.island, speciesId: animal.species_profile_id ?? null, slot: animal.slot ?? null, rank: animal.slot_rank ?? null});
        const startPose = this.plausibleStart(start, a, facts, homeDisc, state?.zone ?? null);
        if (!startPose) {
            await this.o.store.end(sessionId, "player", emptyStats(), this.stillState(ticket.animal, start, now, animal.zone));
            return this.deny(client, "start_pose");
        }
        const idx = this.freeIdx.pop() ?? this.nextIdx++;
        const s: Session = {
            id: sessionId,
            userId: ticket.user,
            animalId: animal.id,
            slug: animal.slug,
            idx,
            facts,
            home,
            homeDisc,
            homeIsland: animal.island,
            homeRef: {speciesId: animal.species_profile_id ?? null, slot: animal.slot ?? null, rank: animal.slot_rank ?? null},
            a,
            motion: newMotion(startPose, now),
            meters: state ? {...freshMeters(Boolean(animal.asleep_hint)), stamina: Math.min(state.stamina > 0 ? Math.max(state.stamina, 0.5) : 1, 1), exposure: Math.max(0, state.exposure - 0.2)} : freshMeters(Boolean(animal.asleep_hint)),
            startedAt: now,
            dayUsedAtStart: result.quota.day_used_s,
            dayLimit: result.quota.day_limit_s,
            sessionLimit: result.quota.session_limit_s,
            clientId: client.id,
            disconnectedAt: null,
            resumeToken: randomToken(),
            crossing: null,
            crossed: state?.crossed ?? null,
            talking: false,
            contact: null,
            hunt: null,
            huntQuietUntil: 0,
            lastMeterAt: 0,
            lastTraceStep: traceStep(now / 1000),
            stamina0: 1,
            client: client.client,
            appVersion: client.appVersion,
            flags: 0
        };
        s.stamina0 = s.meters.stamina;
        this.sessions.set(s.id, s);
        this.byAnimal.set(s.animalId, s.id);
        this.userSessions.set(s.userId, {island: this.island, sessionId: s.id});
        client.sessionId = s.id;
        this.counters.starts++;
        const left = timeLeft(s.startedAt, now, s.dayUsedAtStart, s.dayLimit, s.sessionLimit);
        this.sendText(client, {t: "control-ok", sessionId: s.id, resumeToken: s.resumeToken, idx, animalId: s.animalId, slug: s.slug, start: {x: startPose.x, y: startPose.y, z: startPose.z, yaw: startPose.yaw, mode: startPose.mode}, sessionLeft: left.sessionLeft, dayLeft: left.dayLeft, stamina: s.meters.stamina});
        this.broadcastText({t: "joined", idx, animalId: s.animalId, slug: s.slug, island: this.island});
    }

    /**
     * The pose control starts from, or null. The client sends where its scene draws the animal; the server accepts it
     * only on ground the mode allows, and near the animal's home: within its home disc and its homing range, or
     * anywhere in its own zone or region (phase 1; phase 2 checks it against the server's own formula pose).
     */
    private plausibleStart(start: StartPose, a: Abilities, facts: AnimalFacts, home: HomeDisc, effectiveZone: ArkZone | null): WirePose | null {
        const terrain = this.o.terrain;
        const cell = terrain.cell(start.x, start.z);
        if (!cell) return null;
        const ground = terrain.height(start.x, start.z);
        let mode: Mode = start.mode;
        if (!["ground", "wade", "paddle", "swim", "air", "climb"].includes(mode)) mode = "ground";
        // The ground's own mode where the asked one doesn't fit (a perched bird asked as air near the ground).
        const fits = (m: Mode, y: number) => cellAllows(a, facts, m, cell, y, ground).ok;
        let y = start.y;
        if (mode === "ground" || mode === "wade") y = ground;
        if (!fits(mode, y)) {
            const fallback: Mode[] = cell.depth > 0 ? (a.gills ? ["swim"] : ["wade", "paddle", "swim", "air"]) : ["ground", "air", "climb"];
            const found = fallback.find((m) => fits(m, m === "ground" || m === "wade" ? ground : m === "air" ? Math.max(y, ground + 1) : y));
            if (!found) return null;
            mode = found;
            y = mode === "ground" || mode === "wade" ? ground : mode === "air" ? Math.max(y, ground + 1) : y;
        }
        const zone = effectiveZone ?? facts.zone;
        const near = Math.hypot(start.x - home.x, start.z - home.z) <= home.r + Math.max(a.homingRange, 60);
        const inZone = facts.area ? cell.zone === "farm_garden" : cell.zone === zone || ZONE_REGION[cell.zone] === ZONE_REGION[zone];
        if (!near && !inZone) return null;
        return {x: start.x, y, z: start.z, yaw: start.yaw, pitch: 0, roll: 0, mode, clip: "idle", speed: 0};
    }

    private stillState(animalId: string, start: StartPose, now: number, zone: ArkZone): EndState {
        return {
            island: this.island,
            released_at: new Date(now).toISOString(),
            release: {x: start.x, y: start.y, z: start.z, yaw: start.yaw, mode: start.mode, band: null},
            plan: {kind: "stay", legs: [[now, start.x, start.z, 0]], settle_at: null, settle: null},
            zone: null,
            stranded_from: null,
            stamina: 1,
            exposure: 0,
            crossed: null,
            home: null
        };
        void animalId;
        void zone;
    }

    /** Release a session: the plan back into NPC life, the store's record, everyone told. */
    async release(s: Session, reason: ReleaseReason): Promise<void> {
        if (!this.sessions.has(s.id)) return;
        this.sessions.delete(s.id);
        this.byAnimal.delete(s.animalId);
        if (this.userSessions.get(s.userId)?.sessionId === s.id) this.userSessions.delete(s.userId);
        this.freeIdx.push(s.idx);
        this.counters.releases++;
        const now = this.o.now();
        const p = s.motion.last;
        // Mid-crossing (a dropped connection, a shutdown): it carries on to the nearer side as an NPC, then a normal release there.
        let pose = {x: p.x, y: p.y, z: p.z, mode: p.mode};
        if (s.crossing) {
            const c = s.crossing;
            const side = c.s >= c.strait.length / 2 ? "to" : "from";
            const point = side === "to" ? arrivalPoint(c.strait, c.f) : corridorToIsland(c.strait, c.f, 0, 0, "from");
            pose = {x: point.x, y: 0, z: point.z, mode: c.kind === "air" ? "air" : "swim"};
        }
        const crossed = s.crossed
            ? {arrivedAt: Date.parse(s.crossed.arrived_at), at: {x: s.crossed.x, z: s.crossed.z}, canCrossBack: this.canCrossBack(s), strait: this.straitBack(s)}
            : null;
        const result = planRelease({
            animalId: s.animalId,
            releasedAt: now,
            pose,
            a: s.a,
            home: s.home,
            homeDisc: s.homeDisc,
            terrain: this.o.terrain,
            stamina: s.meters.stamina,
            pen: s.facts.enclosure !== null ? s.facts.pen ?? -1 : null,
            crossed: crossed && crossed.strait ? {...crossed, strait: crossed.strait} : null
        });
        const client = s.clientId !== null ? this.clients.get(s.clientId) : null;
        if (client) {
            client.sessionId = null;
            this.sendText(client, {t: "released", reason, plan: result.plan.kind});
        }
        this.broadcastText({t: "left", idx: s.idx});
        const state: EndState = {
            island: (result.plan.island as IslandId | undefined) ?? this.island,
            released_at: new Date(now).toISOString(),
            release: {x: pose.x, y: pose.y, z: pose.z, yaw: p.yaw, mode: pose.mode, band: s.a.band},
            plan: result.plan,
            zone: result.zone,
            stranded_from: result.strandedFrom ? new Date(result.strandedFrom).toISOString() : null,
            stamina: s.meters.stamina,
            exposure: s.meters.exposure,
            crossed: s.crossed,
            home: homeOverrideOf(result, {releaseIsland: this.island, homeIsland: s.homeIsland})
        };
        try {
            await this.o.store.end(s.id, reason, this.statsOf(s), state);
        } catch (error) {
            this.o.log?.(`store.end failed for ${s.id}: ${(error as Error).message}`);
        }
    }

    private statsOf(s: Session): SessionStats {
        return {distance_m: Math.round(s.motion.distance * 10) / 10, max_speed: Math.round(s.motion.maxSpeed * 100) / 100, rejections: s.motion.rejected, clamped: s.motion.clamped, dropped: s.motion.dropped, client: s.client, app_version: s.appVersion};
    }

    // MARK: Crossings (two islands)

    private straitFrom(): Strait | null {
        return (this.o.straits ?? []).find((st) => st.from === this.island) ?? null;
    }

    private straitBack(s: Session): {farPoint: {x: number; z: number}; seconds: number; to: string} | null {
        const back = (this.o.straits ?? []).find((st) => st.from === this.island && s.crossed && st.to === s.crossed.from);
        if (!back) return null;
        const need = preCheck({a: s.a, facts: s.facts, home: s.home, strait: back, stamina: 1, exposure: 0, sessionLeft: 1e9, dayLeft: 1e9, x: back.a0.x, z: back.a0.z, kind: null});
        if (!need.ok) return null;
        return {farPoint: arrivalPoint(back, 0.5), seconds: need.need.seconds, to: back.to};
    }

    private canCrossBack(s: Session): boolean {
        return this.straitBack(s) !== null;
    }

    private beginCrossing(client: Client, s: Session): void {
        const strait = this.straitFrom();
        const now = this.o.now();
        if (!strait) {
            this.sendText(client, {t: "crossing", phase: "denied", reason: "no_strait"});
            return;
        }
        const left = timeLeft(s.startedAt, now, s.dayUsedAtStart, s.dayLimit, s.sessionLimit);
        const p = s.motion.last;
        const check = preCheck({a: s.a, facts: s.facts, home: s.home, strait, stamina: s.meters.stamina, exposure: s.meters.exposure, sessionLeft: left.sessionLeft, dayLeft: left.dayLeft, x: p.x, z: p.z, kind: p.mode === "swim" || p.mode === "paddle" ? "swim" : p.mode === "air" ? "air" : null});
        if (!check.ok) {
            this.sendText(client, {t: "crossing", phase: "denied", reason: check.reason});
            return;
        }
        s.crossing = startCrossing(strait, check.need, check.f, now);
        s.motion.last = {...s.motion.last, mode: "strait", x: 0, z: 0, y: s.crossing.h, t: now, received: now};
        this.sendText(client, {t: "crossing", phase: "start", to: strait.to});
    }

    private crossingPose(s: Session, client: Client, pose: {seq: number; t: number; x: number; y: number; z: number; mode: Mode}, now: number): void {
        const c = s.crossing!;
        if (c.rescue) return;
        const dt = Math.min(Math.max((pose.t - s.motion.last.t) / 1000, 0.01), 0.5);
        const verdict = crossingStep(c, s.a, {s: pose.x, l: pose.z, h: pose.y}, dt, now);
        if (!verdict.ok) {
            this.counters.corrections++;
            this.sendBinary(client, encodeCorrection({seq: pose.seq, reason: "crossing", x: c.s, y: c.h, z: c.l, yaw: 0, mode: "strait", clip: c.kind === "air" ? "glide" : "swim"}, this.unit));
            return;
        }
        this.counters.accepted++;
        s.motion.last = {...s.motion.last, x: c.s, z: c.l, y: c.h, seq: pose.seq, t: pose.t, received: now, mode: "strait", clip: c.kind === "air" ? "glide" : "swim", speed: c.need.cruise};
        this.afterCrossingStep(s, now);
    }

    private afterCrossingStep(s: Session, now: number): void {
        const c = s.crossing!;
        const client = s.clientId !== null ? this.clients.get(s.clientId) : null;
        // Halfway: the session moves to the far island's room (in this process).
        if (c.committed && c.strait.to !== this.island) {
            const peer = this.o.peers?.().get(c.strait.to);
            if (peer) {
                if (client) this.sendText(client, {t: "crossing", phase: "halfway", to: c.strait.to});
                this.handOff(s, peer);
                return;
            }
        }
        const done = crossingDone(c);
        if (done === "arrived" || done === "returned") {
            const side = done === "arrived" ? "to" : "from";
            const point = done === "arrived" ? arrivalPoint(c.strait, c.f, c.l) : corridorToIsland(c.strait, c.f, 0, c.l, "from");
            const mode: Mode = c.kind === "air" ? "air" : "swim";
            const ground = this.o.terrain.height(point.x, point.z);
            s.crossing = null;
            s.motion = newMotion({x: point.x, y: mode === "air" ? Math.max(ground, 0) + Math.max(c.h, 2) : Math.min(-0.5, ground + 0.5), z: point.z, yaw: corridorToIsland(c.strait, c.f, 0, 0, side).yaw, pitch: 0, roll: 0, mode, clip: mode === "air" ? "glide" : "swim", speed: 0}, now);
            if (done === "arrived") s.crossed = {arrived_at: new Date(now).toISOString(), x: point.x, z: point.z, from: c.strait.from};
            if (client) this.sendText(client, {t: "crossing", phase: done === "arrived" ? "arrived" : "rescued"});
        }
    }

    /** Move a session into another room (the strait's halfway). */
    private handOff(s: Session, peer: Room): void {
        this.sessions.delete(s.id);
        this.byAnimal.delete(s.animalId);
        this.freeIdx.push(s.idx);
        this.broadcastText({t: "left", idx: s.idx});
        const client = s.clientId !== null ? this.clients.get(s.clientId) : null;
        if (client) {
            client.sessionId = null;
            this.clients.delete(client.id);
        }
        peer.adopt(s, client ? client.link : null, client?.tier ?? "high");
    }

    /** Take over a session handed over by another room (its controller's link with it). */
    adopt(s: Session, link: ClientLink | null, tier: Tier): number | null {
        s.idx = this.freeIdx.pop() ?? this.nextIdx++;
        this.sessions.set(s.id, s);
        this.byAnimal.set(s.animalId, s.id);
        this.userSessions.set(s.userId, {island: this.island, sessionId: s.id});
        let clientId: number | null = null;
        if (link) {
            clientId = this.connect(link, {tier});
            const client = this.clients.get(clientId)!;
            client.sessionId = s.id;
            s.clientId = clientId;
            link.rebind?.(this, clientId);
        } else {
            s.clientId = null;
        }
        this.broadcastText({t: "joined", idx: s.idx, animalId: s.animalId, slug: s.slug, island: this.island});
        return clientId;
    }

    // MARK: Tick

    /** One server tick (10 Hz): meters, limits, crossings, traces, heartbeats, meters out, snapshots out. */
    tick(): void {
        const started = typeof performance !== "undefined" ? performance.now() : Date.now();
        const now = this.o.now();
        const dt = 0.1;
        for (const s of Array.from(this.sessions.values())) {
            const p = s.motion.last;
            // Meters.
            const cell = s.crossing ? null : this.o.terrain.cell(p.x, p.z);
            const suit = s.crossing ? suitability(s.a, s.home, null, {openSea: true}) : suitability(s.a, s.home, cell, {otherIsland: Boolean(s.crossed)});
            const still = now - p.received > 400 || p.speed < 0.05;
            const kind = still && p.mode !== "air" && p.mode !== "strait" ? "idle" : drainKind(p.mode, p.clip, p.speed, s.a);
            s.meters = stepMeters(s.meters, {kind, s: suit.s, dt, nowS: now / 1000, talking: s.talking});
            const sig = signals(s.meters, now / 1000);
            // Crossing: the server takes over under 10 % stamina.
            if (s.crossing && s.meters.stamina < 0.1 && !s.crossing.rescue) rescueStep(s.crossing, dt);
            if (s.crossing?.rescue) {
                rescueStep(s.crossing, dt);
                s.motion.last = {...s.motion.last, x: s.crossing.s, z: s.crossing.l, y: s.crossing.h, received: now, t: now};
                this.afterCrossingStep(s, now);
                if (!this.sessions.has(s.id)) continue;
            }
            // Limits.
            const left = timeLeft(s.startedAt, now, s.dayUsedAtStart, s.dayLimit, s.sessionLimit);
            if (!s.crossing && left.sessionLeft <= 0) {
                void this.release(s, "session_limit");
                continue;
            }
            if (!s.crossing && left.dayLeft <= 0) {
                void this.release(s, "daily_limit");
                continue;
            }
            if (!s.crossing && sig.inDanger) {
                void this.release(s, "exposure");
                continue;
            }
            if (s.clientId === null && s.disconnectedAt !== null && now - s.disconnectedAt > DISCONNECT_GRACE_S * 1000) {
                void this.release(s, "disconnect");
                continue;
            }
            // Traces: one sample per encounter step, on the absolute grid.
            const step = traceStep(now / 1000);
            if (step > s.lastTraceStep) {
                s.lastTraceStep = step;
                this.traceBuffer.push({animal_id: s.animalId, step, island: s.crossing ? "strait" : this.island, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, y: Math.round(p.y * 100) / 100, mode: p.mode, band: s.a.band});
            }
            // Meters to the controller (2 Hz).
            const client = s.clientId !== null ? this.clients.get(s.clientId) : null;
            if (client && now - s.lastMeterAt >= 1000 / METER_HZ) {
                s.lastMeterAt = now;
                let flags = 0;
                if (sig.exhausted) flags |= METER_FLAG.EXHAUSTED;
                if (sig.distressed || sig.distressedByPlace) flags |= METER_FLAG.DISTRESSED;
                if (sig.uncomfortable) flags |= METER_FLAG.UNCOMFORTABLE;
                if (sig.inDanger) flags |= METER_FLAG.IN_DANGER;
                if (sig.noRun) flags |= METER_FLAG.NO_RUN;
                if (this.o.hunting?.()?.due(s.animalId, now) === true) flags |= METER_FLAG.HUNGRY;
                const strait = this.straitFrom();
                if (strait && !s.crossing) {
                    const pc = preCheck({a: s.a, facts: s.facts, home: s.home, strait, stamina: s.meters.stamina, exposure: s.meters.exposure, sessionLeft: left.sessionLeft, dayLeft: left.dayLeft, x: p.x, z: p.z, kind: null});
                    if (pc.ok) flags |= METER_FLAG.CAN_CROSS;
                }
                this.sendBinary(client, encodeMeter({stamina: s.meters.stamina, exposure: s.meters.exposure, habitat: suit.s, cause: suit.cause, flags, sessionLeft: left.sessionLeft, dayLeft: left.dayLeft}));
            }
        }
        if (this.traceBuffer.length) {
            const rows = this.traceBuffer;
            this.traceBuffer = [];
            this.o.store.trace(rows).catch((error: Error) => this.o.log?.(`trace failed: ${error.message}`));
        }
        if (now - this.lastHeartbeat >= HEARTBEAT_S * 1000) {
            this.lastHeartbeat = now;
            const ids = Array.from(this.sessions.keys());
            if (ids.length) this.o.store.heartbeat(ids).catch((error: Error) => this.o.log?.(`heartbeat failed: ${error.message}`));
        }
        this.sendSnapshots(now);
        if (now - this.lastNpcAt >= 1000 / NPC_HZ - 5) {
            this.lastNpcAt = now;
            this.stepNpcs(now);
        }
        this.stepHunt(now);
        if (now - this.lastTalkAt >= 500) {
            this.lastTalkAt = now;
            this.stepTalk(now);
        }
        const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
        this.counters.tickMs += ended - started;
        this.counters.ticks++;
    }

    /** Where a session is drawn on this island (a crossing animal, along the strait from this island's side). */
    private drawnPose(s: Session): {x: number; y: number; z: number; yaw: number} {
        const p = s.motion.last;
        if (s.crossing) {
            const c = s.crossing;
            const side = c.strait.from === this.island ? "from" : "to";
            const w = corridorToIsland(c.strait, c.f, c.s, c.l, side);
            return {x: w.x, y: c.h, z: w.z, yaw: c.rescue === "back" ? w.yaw + Math.PI : w.yaw};
        }
        return {x: p.x, y: p.y, z: p.z, yaw: p.yaw};
    }

    private sendSnapshots(now: number): void {
        const list = Array.from(this.sessions.values()).map((s) => ({s, pose: this.drawnPose(s)}));
        for (const client of Array.from(this.clients.values())) {
            const rate = SNAPSHOT_HZ[client.tier];
            if (now - client.lastSnapAt < 1000 / rate - 5) continue;
            client.lastSnapAt = now;
            const own = client.sessionId ? this.sessions.get(client.sessionId) ?? null : null;
            const centre = own ? this.drawnPose(own) : client.view;
            const cap = AOI_CAP[client.tier];
            let chosen = list;
            if (list.length > cap) {
                const cx = centre?.x ?? 0;
                const cz = centre?.z ?? 0;
                chosen = list
                    .map((e) => ({...e, d: e.s === own ? -1 : Math.hypot(e.pose.x - cx, e.pose.z - cz)}))
                    .sort((a, b) => a.d - b.d)
                    .slice(0, cap);
            }
            if (!chosen.length && !own) continue;
            const entities: SnapshotEntity[] = chosen.map(({s, pose}) => {
                const p = s.motion.last;
                const sig = signals(s.meters, now / 1000);
                let flags = 0;
                if (sig.exhausted) flags |= ENTITY_FLAG.EXHAUSTED;
                if (sig.distressed || sig.distressedByPlace) flags |= ENTITY_FLAG.DISTRESSED;
                if (s.crossing) flags |= ENTITY_FLAG.CROSSING;
                if (sig.held || s.motion.heldUntil > now) flags |= ENTITY_FLAG.HELD;
                if (s.talking) flags |= ENTITY_FLAG.TALKING;
                if (s === own) flags |= ENTITY_FLAG.YOURS;
                return {idx: s.idx, x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, roll: p.roll, mode: s.crossing ? "strait" : p.mode, clip: sig.lying ? "lie" : p.clip, phase: 0, speed: p.speed, flags};
            });
            this.counters.snapshots++;
            this.sendBinary(client, encodeSnapshot({tick: now - this.o.epochBase, ack: own ? own.motion.last.seq : 0, flags: 0, entities}, this.unit));
        }
    }

    // MARK: Phase 2: shared reactions and Talk

    /** The NPCs near players react once, here, for everyone (design §3.5): their offsets go to the viewers near them. */
    private stepNpcs(now: number): void {
        const npc = this.o.npc?.() ?? null;
        if (!npc) return;
        const controlled = Array.from(this.sessions.values())
            .filter((s) => !s.crossing)
            .map((s) => ({id: s.animalId, x: s.motion.last.x, y: s.motion.last.y, z: s.motion.last.z, yaw: s.motion.last.yaw, speed: now - s.motion.last.received > 400 ? 0 : s.motion.last.speed, mode: s.motion.last.mode}));
        if (!controlled.length) return;
        const reactions = npc.reactions.step(controlled, now / 1000, 1 / NPC_HZ);
        if (!reactions.length) return;
        const fresh: string[] = [];
        for (const r of reactions) {
            if (this.npcIdx.has(r.id)) continue;
            this.npcIdx.set(r.id, this.npcIds.length);
            this.npcIds.push(r.id);
            fresh.push(r.id);
        }
        if (fresh.length) this.broadcastText({t: "npcs", base: this.npcIds.length - fresh.length, ids: fresh});
        for (const client of Array.from(this.clients.values())) {
            const own = client.sessionId ? this.sessions.get(client.sessionId) ?? null : null;
            const centre = own ? this.drawnPose(own) : client.view;
            const near = reactions
                .map((r) => ({r, d: centre ? Math.hypot(r.pose.x - centre.x, r.pose.z - centre.z) : 0}))
                .filter((e) => e.d <= 120)
                .sort((a, b) => a.d - b.d)
                .slice(0, 60);
            if (!near.length) continue;
            const offsets: NpcOffset[] = near.map(({r}) => ({idx: this.npcIdx.get(r.id)!, dx: r.out.dx, dz: r.out.dz, dyaw: r.out.bodyYaw, doing: actionCode(r.out.action), alarm: r.out.alarmed, look: r.out.looking && this.byAnimal.has(r.out.looking) ? 1 : 0}));
            this.sendBinary(client, encodeNpc({tick: now - this.o.epochBase, offsets}));
        }
    }

    /** Talk (design §6.3): the nearest animal within 4 m + half both lengths of a controller's own, told when it changes. */
    private stepTalk(now: number): void {
        const npc = this.o.npc?.() ?? null;
        for (const s of Array.from(this.sessions.values())) {
            const client = s.clientId !== null ? this.clients.get(s.clientId) : null;
            if (!client || s.crossing) continue;
            const me = s.motion.last;
            let best: {id: string; d: number} | null = null;
            const consider = (id: string, x: number, z: number, slug: string) => {
                if (id === s.animalId) return;
                const reach = 4 + (s.a.D + abilitiesOf(slug).D) / 2;
                const d = Math.hypot(x - me.x, z - me.z);
                if (d <= reach && (!best || d < best.d)) best = {id, d};
            };
            for (const other of Array.from(this.sessions.values())) if (other !== s && !other.crossing) consider(other.animalId, other.motion.last.x, other.motion.last.z, other.slug);
            if (npc) {
                for (const id of npc.world.candidates(me.x, me.z, 12)) {
                    if (this.byAnimal.has(id)) continue;
                    const pose = npc.world.poseAt(id, now / 1000);
                    const slug = npc.world.slugOf(id);
                    if (pose && slug) consider(id, pose.x, pose.z, slug);
                }
            }
            const chosen: string | null = best ? (best as {id: string}).id : null;
            if (this.talkReady.get(s.id) !== chosen) {
                this.talkReady.set(s.id, chosen);
                this.sendText(client, {t: "talk-ready", animalId: chosen});
            }
        }
    }

    // MARK: Phase 3: hunting (design §7)

    /**
     * Contact on the server's own poses: the predator's mouth within 0.35·D_pred + 0.25·D_prey of the prey's middle for
     * 0.3 s, the prey where the shared schedule (and its shared reaction) had it 150 ms ago. Then a kill is asked of
     * the database, which re-checks every rule and cap (`applyPlayerMeal`); a practice chase (not due, a kept animal,
     * not its food) only startles: no event (D15).
     */
    private stepHunt(now: number): void {
        const npc = this.o.npc?.() ?? null;
        const hunting = this.o.hunting?.() ?? null;
        if (!npc || !hunting) return;
        for (const s of Array.from(this.sessions.values())) {
            const client = s.clientId !== null ? this.clients.get(s.clientId) : null;
            if (s.hunt) {
                this.pollHunt(s, client ?? null, now);
                continue;
            }
            if (!client || s.crossing || s.facts.enclosure !== null || s.facts.area || now < s.huntQuietUntil) {
                s.contact = null;
                continue;
            }
            const me = s.motion.last;
            const mouth = {x: me.x + Math.sin(me.yaw) * 0.45 * s.a.D, z: me.z + Math.cos(me.yaw) * 0.45 * s.a.D};
            let touching: string | null = null;
            for (const id of npc.world.candidates(me.x, me.z, 8)) {
                if (this.byAnimal.has(id)) continue;
                const slug = npc.world.slugOf(id);
                if (!slug || !foodEats(s.slug, slug)) continue;
                const pose = npc.world.poseAt(id, (now - 150) / 1000);
                if (!pose) continue;
                const reach = 0.35 * s.a.D + 0.25 * abilitiesOf(slug).D;
                if (Math.hypot(pose.x - mouth.x, pose.z - mouth.z) <= reach) {
                    touching = id;
                    break;
                }
            }
            if (!touching) {
                s.contact = null;
                continue;
            }
            if (!s.contact || s.contact.preyId !== touching) {
                s.contact = {preyId: touching, since: now};
                continue;
            }
            if (now - s.contact.since < 300) continue;
            const preyId = touching;
            s.contact = null;
            const due = hunting.due(s.animalId, now);
            const reason = npc.world.keptOf(preyId) ? "protected" : due === false ? "not_hungry" : null;
            if (reason || !this.o.store.mealRequest) {
                s.huntQuietUntil = now + 3000;
                this.sendText(client, {t: "hunt", phase: "denied", preyId, reason: reason ?? "off"});
                continue;
            }
            this.sendText(client, {t: "hunt", phase: "contact", preyId});
            s.hunt = {id: "", preyId, at: now, lastPoll: now};
            const evidence = {mouth: {x: Math.round(mouth.x * 100) / 100, z: Math.round(mouth.z * 100) / 100}, at: now, held_ms: 300, rtt_rewind_ms: 150};
            this.o.store.mealRequest(s.id, s.animalId, preyId, evidence).then(
                (r) => {
                    if (!s.hunt) return;
                    if (r.ok) s.hunt.id = r.id;
                    else this.endHunt(s, "denied", r.reason, now);
                },
                () => this.endHunt(s, "escaped", "network", now)
            );
        }
    }

    private pollHunt(s: Session, client: Client | null, now: number): void {
        const h = s.hunt!;
        if (!h.id) {
            if (now - h.at > 8000) this.endHunt(s, "escaped", "timeout", now);
            return;
        }
        if (now - h.lastPoll < 500) return;
        h.lastPoll = now;
        if (!this.o.store.mealStatus) return;
        this.o.store.mealStatus(h.id).then(
            (st) => {
                if (s.hunt !== h) return;
                if (st.status === "confirmed") {
                    s.hunt = null;
                    s.huntQuietUntil = now + 10_000;
                    // Everyone: the prey was eaten (the meal itself arrives in the log like any meal; the hunter is never named).
                    this.broadcastText({t: "hunt", phase: "confirmed", preyId: h.preyId});
                } else if (st.status === "rejected" || st.status === "expired") {
                    this.endHunt(s, "escaped", st.reason ?? st.status, now);
                } else if (now - h.at > 8000) {
                    this.endHunt(s, "escaped", "timeout", now);
                }
            },
            () => undefined
        );
        void client;
    }

    private endHunt(s: Session, phase: "denied" | "escaped", reason: string, now: number): void {
        const h = s.hunt;
        s.hunt = null;
        s.huntQuietUntil = now + 3000;
        const client = s.clientId !== null ? this.clients.get(s.clientId) : null;
        if (client && h) this.sendText(client, {t: "hunt", phase, preyId: h.preyId, reason});
    }

    /** Release everything (a shutdown): every animal back into NPC life where it is. */
    async shutdown(): Promise<void> {
        await Promise.all(Array.from(this.sessions.values(), (s) => this.release(s, "shutdown")));
        for (const c of Array.from(this.clients.values())) c.link.close(1001, "shutdown");
        this.clients.clear();
    }
}

function emptyStats(): SessionStats {
    return {distance_m: 0, max_speed: 0, rejections: 0, clamped: 0, dropped: 0, client: null, app_version: null};
}
