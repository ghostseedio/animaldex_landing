/**
 * The production `Store`: the `ark_live_*` RPCs through PostgREST (contract §3), as the `ark_live` role (a JWT whose
 * role claim is `ark_live`), never the service role. Not run locally (no keys); the shapes are tested with a fake
 * fetch (`src/lib/ark-live-server.test.ts`).
 *
 * Traces and heartbeats that fail are kept and retried (traces for up to 10 minutes, design §2.6); the database
 * refuses a trace for a step the tick has already committed.
 */

import type {EndState, MealRequest, MealStatus, SessionStats, StartResult, Store, StoredState, TraceRow} from "@/ark-live/room";
import type {IslandId} from "@/ark-live/islands";
import type {ReleaseReason} from "@/ark-live/protocol";

export type SupabaseStoreOptions = {
    url: string;
    /** The project's publishable (anon) key, for the gateway. */
    apiKey: string;
    /** A JWT with `role: ark_live`. */
    jwt: string;
    fetch?: typeof fetch;
    now?: () => number;
    log?: (line: string) => void;
};

const TRACE_KEEP_MS = 10 * 60 * 1000;

export class SupabaseStore implements Store {
    private readonly states = new Map<string, StoredState | null>();
    private pendingTraces: Array<{row: TraceRow; at: number}> = [];
    private readonly f: typeof fetch;
    private readonly now: () => number;

    constructor(private readonly o: SupabaseStoreOptions) {
        this.f = o.fetch ?? fetch;
        this.now = o.now ?? Date.now;
    }

    private async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
        const response = await this.f(`${this.o.url.replace(/\/+$/, "")}/rest/v1/rpc/${name}`, {
            method: "POST",
            headers: {"content-type": "application/json", apikey: this.o.apiKey, authorization: `Bearer ${this.o.jwt}`},
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
        return (await response.json()) as T;
    }

    async start(args: {nonce: string; sessionId: string; userId: string; animalId: string; island: IslandId; client: string | null; appVersion: string | null}): Promise<StartResult> {
        const result = await this.rpc<StartResult & {state?: StoredState | null}>("ark_live_start_v1", {
            p_ticket_nonce: args.nonce,
            p_session_id: args.sessionId,
            p_user_id: args.userId,
            p_animal_id: args.animalId,
            p_island: args.island,
            p_client: args.client,
            p_app_version: args.appVersion
        });
        if (result.ok) this.states.set(args.animalId, result.state ?? null);
        return result;
    }

    async heartbeat(sessionIds: string[]): Promise<void> {
        await this.rpc<number>("ark_live_heartbeat_v1", {p_session_ids: sessionIds});
    }

    async trace(rows: TraceRow[]): Promise<void> {
        const now = this.now();
        this.pendingTraces = this.pendingTraces.filter((p) => now - p.at < TRACE_KEEP_MS).concat(rows.map((row) => ({row, at: now})));
        if (!this.pendingTraces.length) return;
        const batch = this.pendingTraces.map((p) => p.row);
        try {
            await this.rpc<number>("ark_live_trace_v1", {p_rows: batch});
            this.pendingTraces = [];
        } catch (error) {
            this.o.log?.(`traces kept for retry (${batch.length}): ${(error as Error).message}`);
        }
    }

    async end(sessionId: string, reason: ReleaseReason, stats: SessionStats, state: EndState): Promise<void> {
        await this.rpc<unknown>("ark_live_end_v1", {p_session_id: sessionId, p_reason: reason, p_stats: stats, p_state: state});
    }

    /** Phase 3: ask the database for a kill (it re-checks every rule and the D9/D10 caps; voyage-world decides). */
    async mealRequest(sessionId: string, predatorId: string, preyId: string, evidence: Record<string, unknown>): Promise<MealRequest> {
        return this.rpc<MealRequest>("ark_live_meal_request_v1", {p_session_id: sessionId, p_predator_id: predatorId, p_prey_id: preyId, p_evidence: evidence});
    }

    async mealStatus(id: string): Promise<MealStatus> {
        return this.rpc<MealStatus>("ark_live_meal_status_v1", {p_id: id});
    }

    async stateOf(animalId: string): Promise<StoredState | null> {
        return this.states.get(animalId) ?? null;
    }
}
