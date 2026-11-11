/**
 * An in-memory `Store` for local runs and tests: the same rules as the database's RPCs (contract §3), without one.
 * Single-use tickets, one lock per animal with a 30 s TTL, D2 (one live session per person), D3 (20 min sessions,
 * a 10 min cooldown after a full one, 60 min per animal per real day), the stored records and the traces.
 *
 * Never used in production: `ark-live` talks to the database there (`ark-live/store-supabase.ts`).
 */

import type {IslandId} from "@/ark-live/islands";
import type {EndState, SessionStats, StartResult, Store, StoreAnimal, StoredState, TraceRow} from "@/ark-live/room";
import type {ReleaseReason} from "@/ark-live/protocol";
import {COOLDOWN_S, DAY_LIMIT_S, LOCK_TTL_S, SESSION_LIMIT_S} from "@/ark-live/session";
import {signTicket} from "@/ark-live/ticket";

export type MemorySession = {id: string; userId: string; animalId: string; island: IslandId; startedAt: number; endedAt: number | null; reason: ReleaseReason | null; stats: SessionStats | null};

export class MemoryStore implements Store {
    readonly animals = new Map<string, StoreAnimal & {owners: string[]}>();
    readonly locks = new Map<string, {sessionId: string; userId: string; expiresAt: number}>();
    readonly sessions = new Map<string, MemorySession>();
    readonly usedNonces = new Set<string>();
    readonly states = new Map<string, StoredState & {version: number}>();
    readonly traces: TraceRow[] = [];
    /** The tick's committed point: no trace at or before this step. */
    tickedToStep = -1;
    /** Fail every call (the store-down tests). */
    down = false;

    constructor(private readonly now: () => number) {}

    addAnimal(animal: StoreAnimal & {owners: string[]}): void {
        this.animals.set(animal.id, animal);
    }

    /** Mint a ticket the way `voyage_control_ticket_v1` does (development and tests only). */
    async mint(userId: string, animalId: string, island: IslandId, keyBase64: string, nonce?: string): Promise<{ok: true; ticket: string} | {ok: false; reason: string}> {
        const animal = this.animals.get(animalId);
        if (!animal || !animal.owners.includes(userId)) return {ok: false, reason: "not_yours"};
        const quota = this.quota(userId, animalId);
        if (quota.cooldown) return {ok: false, reason: "cooldown"};
        if (quota.dayUsed >= DAY_LIMIT_S) return {ok: false, reason: "daily_limit"};
        const n = nonce ?? (globalThis as {crypto: Crypto & {randomUUID: () => string}}).crypto.randomUUID();
        const ticket = await signTicket({user: userId, animal: animalId, island, exp: Math.floor(this.now() / 1000) + 120, nonce: n}, keyBase64);
        return {ok: true, ticket};
    }

    private dayStart(ms: number): number {
        return Math.floor(ms / 86_400_000) * 86_400_000;
    }

    /** Seconds used today on this animal, and whether a cooldown is on (after a full 20 min session, for 10 min). */
    quota(userId: string, animalId: string): {dayUsed: number; cooldown: boolean} {
        const now = this.now();
        const day = this.dayStart(now);
        let dayUsed = 0;
        let cooldown = false;
        for (const s of Array.from(this.sessions.values())) {
            if (s.animalId !== animalId) continue;
            const end = s.endedAt ?? now;
            const from = Math.max(s.startedAt, day);
            if (end > from) dayUsed += (end - from) / 1000;
            if (s.userId === userId && s.endedAt && s.reason === "session_limit" && now - s.endedAt < COOLDOWN_S * 1000) cooldown = true;
        }
        return {dayUsed, cooldown};
    }

    async start(args: {nonce: string; sessionId: string; userId: string; animalId: string; island: IslandId; client: string | null; appVersion: string | null}): Promise<StartResult> {
        if (this.down) throw new Error("store down");
        const now = this.now();
        if (this.usedNonces.has(args.nonce)) return {ok: false, reason: "used"};
        this.usedNonces.add(args.nonce);
        const animal = this.animals.get(args.animalId);
        if (!animal || !animal.owners.includes(args.userId)) return {ok: false, reason: "not_yours"};
        if (animal.island !== args.island) return {ok: false, reason: "wrong_island"};
        // D2: one live session per person.
        for (const [animalId, lock] of Array.from(this.locks)) {
            if (lock.expiresAt > now && lock.userId === args.userId && animalId !== args.animalId) return {ok: false, reason: "other_animal"};
        }
        const lock = this.locks.get(args.animalId);
        if (lock && lock.expiresAt > now) return {ok: false, reason: "busy"};
        const quota = this.quota(args.userId, args.animalId);
        if (quota.cooldown) return {ok: false, reason: "cooldown"};
        if (quota.dayUsed >= DAY_LIMIT_S) return {ok: false, reason: "daily_limit"};
        this.locks.set(args.animalId, {sessionId: args.sessionId, userId: args.userId, expiresAt: now + LOCK_TTL_S * 1000});
        this.sessions.set(args.sessionId, {id: args.sessionId, userId: args.userId, animalId: args.animalId, island: args.island, startedAt: now, endedAt: null, reason: null, stats: null});
        const {owners, ...rest} = animal;
        void owners;
        return {ok: true, animal: rest, quota: {session_limit_s: SESSION_LIMIT_S, day_used_s: quota.dayUsed, day_limit_s: DAY_LIMIT_S}};
    }

    async heartbeat(sessionIds: string[]): Promise<void> {
        if (this.down) throw new Error("store down");
        const now = this.now();
        for (const [animalId, lock] of Array.from(this.locks)) if (sessionIds.includes(lock.sessionId)) this.locks.set(animalId, {...lock, expiresAt: now + LOCK_TTL_S * 1000});
    }

    async trace(rows: TraceRow[]): Promise<void> {
        if (this.down) throw new Error("store down");
        for (const row of rows) {
            if (row.step <= this.tickedToStep) continue;
            const i = this.traces.findIndex((r) => r.animal_id === row.animal_id && r.step === row.step);
            if (i >= 0) this.traces[i] = row;
            else this.traces.push(row);
        }
    }

    async end(sessionId: string, reason: ReleaseReason, stats: SessionStats, state: EndState): Promise<void> {
        if (this.down) throw new Error("store down");
        const s = this.sessions.get(sessionId);
        if (!s) return;
        s.endedAt = this.now();
        s.reason = reason;
        s.stats = stats;
        const lock = this.locks.get(s.animalId);
        if (lock?.sessionId === sessionId) this.locks.delete(s.animalId);
        const before = this.states.get(s.animalId);
        this.states.set(s.animalId, {animal_id: s.animalId, island: state.island, released_at: state.released_at, plan: state.plan, zone: state.zone, stamina: state.stamina, exposure: state.exposure, crossed: state.crossed ?? null, version: (before?.version ?? 0) + 1});
    }

    async stateOf(animalId: string): Promise<StoredState | null> {
        if (this.down) throw new Error("store down");
        return this.states.get(animalId) ?? null;
    }

    /** The public read (`voyage_animal_states_v1`): every record on an island, no user ids. */
    publicStates(island: IslandId): Array<Omit<StoredState, "crossed"> & {version: number}> {
        return Array.from(this.states.values())
            .filter((s) => s.island === island)
            .map(({crossed, ...rest}) => {
                void crossed;
                return rest;
            });
    }
}
