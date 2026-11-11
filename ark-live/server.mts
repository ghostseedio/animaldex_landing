/**
 * `ark-live`: the Ark's real-time server for player control (design §2; docs/ark/live-server.md).
 *
 * LOCAL ONLY until the owner decides hosting (DECISIONS.md #14). Run:
 *   ARK_LIVE_DEV=1 npx tsx ark-live/server.mts                 (development: an in-memory store, dev tickets)
 *   node ark-live/dist/server.mjs                              (the bundle from `node ark-live/build.mjs`)
 *
 * Environment:
 *   PORT                      default 8787
 *   ARK_LIVE_DEV=1            development: in-memory store, GET /dev/ticket, CORS for the local page
 *   ARK_LIVE_TICKET_KEY       base64 HMAC key shared with the database (required outside development)
 *   ARK_LIVE_SNAPSHOT         development: a snapshot file (voyage_public_v2's shape) to know the animals by; read in place
 *   SUPABASE_URL, SUPABASE_ANON_KEY, ARK_LIVE_JWT   production store (the ark_live role)
 *   ARK_LIVE_ATLAS_CACHE      where baked atlases are kept (default ark-live/.cache)
 *   ARK_LIVE_SNAPSHOT_URL     phase 2: the public snapshot (the site's /api/ark/voyage) the NPC world is built from
 *                             (development reads ARK_LIVE_SNAPSHOT); without either, no shared NPC reactions
 */

import {createServer, type IncomingMessage, type ServerResponse} from "node:http";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {createHash, randomBytes} from "node:crypto";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {acceptUpgrade, BACKPRESSURE_BYTES, type WsConnection} from "./ws";
import {SupabaseStore} from "./store-supabase";
import {Room, type ClientLink, type Store} from "@/ark-live/room";
import {MemoryStore} from "@/ark-live/memory-store";
import {Atlas} from "@/ark-live/terrain";
import {ISLANDS, isIslandId, STRAITS, type IslandId} from "@/ark-live/islands";
import {MSG} from "@/ark-live/protocol";
import {NpcWorld, type Released} from "@/ark-live/npc-world";
import {NpcReactions} from "@/ark-live/npc-reactions";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkAnimal} from "@/ark-scene/types";
import {worldSampler} from "@/ark-scene/world-sampler";
import {defaultHomePlots} from "@/ark-scene/props/home-layout";
import type {ArkArea, ArkZone} from "@/ark-scene/types";

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const DEV = env.ARK_LIVE_DEV === "1";
const PORT = Number(env.PORT ?? 8787);
const log = (line: string) => process.stdout.write(`${new Date().toISOString()} ${line}\n`);

let ticketKey = env.ARK_LIVE_TICKET_KEY ?? "";
if (!ticketKey) {
    if (!DEV) {
        log("ARK_LIVE_TICKET_KEY is required outside development");
        process.exit(1);
    }
    ticketKey = randomBytes(32).toString("base64");
    log("development: a fresh ticket key for this run (never printed)");
}

// MARK: Terrain

function loadAtlas(island: IslandId): Atlas {
    const sampler = worldSampler();
    const cacheDir = resolve(env.ARK_LIVE_ATLAS_CACHE ?? join(here, ".cache"));
    const tag = createHash("sha1").update(`${island}:${sampler.version}`).digest("hex").slice(0, 12);
    const file = join(cacheDir, `atlas-${island}-${tag}.bin`);
    if (existsSync(file)) {
        const atlas = Atlas.fromBytes(new Uint8Array(readFileSync(file)));
        log(`atlas ${island}: loaded ${file}`);
        return atlas;
    }
    const started = Date.now();
    const atlas = Atlas.bake(island, ISLANDS[island].half, sampler, {plots: defaultHomePlots()});
    mkdirSync(cacheDir, {recursive: true});
    writeFileSync(file, atlas.toBytes());
    log(`atlas ${island}: baked in ${((Date.now() - started) / 1000).toFixed(1)} s → ${file}`);
    return atlas;
}

// MARK: Store

type DevAnimal = {id: string; model_slug: string; zone: ArkZone; area?: ArkArea | null};

function makeStore(): {store: Store; memory: MemoryStore | null} {
    if (DEV || !env.SUPABASE_URL) {
        const memory = new MemoryStore(Date.now);
        const snapshotPath = env.ARK_LIVE_SNAPSHOT;
        if (snapshotPath && existsSync(snapshotPath)) {
            const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {animals?: DevAnimal[]};
            for (const a of snapshot.animals ?? []) {
                if (!a.model_slug) continue;
                memory.addAnimal({id: a.id, slug: a.model_slug, zone: a.zone, area: a.area ?? null, island: "wild", enclosure_id: null, label: "Voyager", named: false, owners: []});
            }
            log(`development store: ${memory.animals.size} animals from the snapshot`);
        }
        return {store: memory, memory};
    }
    const jwt = env.ARK_LIVE_JWT;
    const apiKey = env.SUPABASE_ANON_KEY;
    if (!jwt || !apiKey) {
        log("SUPABASE_URL needs SUPABASE_ANON_KEY and ARK_LIVE_JWT");
        process.exit(1);
    }
    return {store: new SupabaseStore({url: env.SUPABASE_URL, apiKey, jwt, log}), memory: null};
}

const {store, memory} = makeStore();

// MARK: Rooms

// MARK: Phase 2: the shared schedule near players

let npc: {world: NpcWorld; reactions: NpcReactions} | null = null;
let npcKey = "";

async function snapshotAnimals(): Promise<ArkAnimal[] | null> {
    try {
        if (env.ARK_LIVE_SNAPSHOT_URL) return decodeArkSnapshot(await (await fetch(env.ARK_LIVE_SNAPSHOT_URL)).json())?.animals ?? null;
        if (env.ARK_LIVE_SNAPSHOT && existsSync(env.ARK_LIVE_SNAPSHOT)) return decodeArkSnapshot(JSON.parse(readFileSync(env.ARK_LIVE_SNAPSHOT, "utf8")))?.animals ?? null;
    } catch (error) {
        log(`snapshot read failed: ${(error as Error).message}`);
    }
    return null;
}

async function releasedRecords(): Promise<Map<string, Released>> {
    const out = new Map<string, Released>();
    let rows: Array<{animal_id: string; plan: Released["plan"]; home?: Released["home"]}> = [];
    if (memory) rows = memory.publicStates("wild") as never;
    else if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
        try {
            const res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/voyage_animal_states_v1`, {method: "POST", headers: {"content-type": "application/json", apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}`}, body: JSON.stringify({p_island: "wild"})});
            if (res.ok) rows = (await res.json()) as never;
        } catch {
            // (Next minute.)
        }
    }
    for (const r of rows) if (r && r.plan) out.set(r.animal_id, {plan: r.plan, home: r.home ?? null});
    return out;
}

/** (Re)build the NPC world when the animals aboard change (a second or more of work, off the tick's way). */
async function refreshNpc(): Promise<void> {
    const animals = await snapshotAnimals();
    if (!animals?.length) return;
    const key = animals.map((a) => `${a.id}:${a.slot ?? ""}:${a.slot_rank ?? ""}`).sort().join(",");
    if (key !== npcKey) {
        const started = Date.now();
        const sampler = worldSampler();
        const world = new NpcWorld(animals, sampler);
        npc = {world, reactions: new NpcReactions(world, sampler)};
        npcKey = key;
        log(`npc world: ${world.size()} scheduled animals in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    }
    npc?.world.setReleased(await releasedRecords());
}

const epochBase = Date.now();
const rooms = new Map<IslandId, Room>();
const userSessions = new Map<string, {island: IslandId; sessionId: string}>();
const islands: IslandId[] = (env.ARK_LIVE_ISLANDS ?? "wild").split(",").filter(isIslandId);
for (const island of islands) {
    rooms.set(island, new Room({island, terrain: loadAtlas(island), ticketKey, store, now: Date.now, epochBase, straits: STRAITS, peers: () => rooms, userSessions, log, npc: () => (island === "wild" ? npc : null)}));
}

// MARK: HTTP

const stats = {started: Date.now(), cpu: process.cpuUsage(), connections: 0, upgrades: 0, skipped: 0};

function json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, {"content-type": "application/json", ...(DEV ? {"access-control-allow-origin": "*"} : {})});
    res.end(JSON.stringify(body));
}

function statsBody() {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    return {
        uptime_s: (Date.now() - stats.started) / 1000,
        cpu_user_ms: cpu.user / 1000,
        cpu_system_ms: cpu.system / 1000,
        rss_mb: Math.round((mem.rss / 1e6) * 10) / 10,
        heap_mb: Math.round((mem.heapUsed / 1e6) * 10) / 10,
        connections: stats.connections,
        skipped_snapshots: stats.skipped,
        rooms: Object.fromEntries(Array.from(rooms, ([id, room]) => [id, {clients: room.clientCount(), sessions: room.sessionCount(), ...room.counters, reasons: room.correctionReasons, perClient: room.clientBytes()}]))
    };
}

async function devTicket(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!memory) return json(res, 404, {error: "not in development"});
    const animal = url.searchParams.get("animal") ?? "";
    const user = url.searchParams.get("user") ?? "00000000-0000-4000-8000-00000000d00d";
    const island = (url.searchParams.get("island") ?? "wild") as IslandId;
    // Development only: a made-up animal for the load test, or one from the snapshot given to any local user.
    const slug = url.searchParams.get("slug");
    if (slug) memory.addAnimal({id: animal, slug, zone: (url.searchParams.get("zone") ?? "grassland") as ArkZone, area: null, island, enclosure_id: null, label: "Voyager", named: false, owners: [user]});
    const known = memory.animals.get(animal);
    if (known && !known.owners.includes(user)) known.owners.push(user);
    const minted = await memory.mint(user, animal, island, ticketKey);
    json(res, minted.ok ? 200 : 403, minted.ok ? {ok: true, ticket: minted.ticket, island} : minted);
    void req;
}

const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "OPTIONS" && DEV) {
        res.writeHead(204, {"access-control-allow-origin": "*", "access-control-allow-methods": "GET", "access-control-allow-headers": "*"});
        res.end();
        return;
    }
    if (url.pathname === "/health") return json(res, 200, {ok: true, rooms: Array.from(rooms.keys()), sessions: Array.from(rooms.values()).reduce((n, r) => n + r.sessionCount(), 0)});
    if (url.pathname === "/stats") return json(res, 200, statsBody());
    if (url.pathname === "/dev/ticket" && DEV) return void devTicket(req, res, url);
    // Development: the stored records the page walks released animals by (production: the web's /api/ark/control-states).
    if (url.pathname === "/dev/states" && DEV && memory) return json(res, 200, {states: memory.publicStates((url.searchParams.get("island") ?? "wild") as IslandId)});
    json(res, 404, {error: "not found"});
});

server.on("upgrade", (req, socket) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/v1/live") {
        socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
    }
    const island = url.searchParams.get("island") ?? "wild";
    const room = isIslandId(island) ? rooms.get(island) : undefined;
    if (!room) {
        socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
    }
    const ws = acceptUpgrade(req, socket);
    if (!ws) return;
    stats.upgrades++;
    stats.connections++;
    attach(ws, room, url.searchParams.get("tier"));
});

function attach(ws: WsConnection, initial: Room, tier: string | null): void {
    let room = initial;
    let clientId = 0;
    const link: ClientLink = {
        send(data) {
            if (typeof data === "string") return ws.sendText(data);
            // A slow viewer: skip snapshots while its socket is backed up (the next one replaces it anyway).
            if (ws.pending() > BACKPRESSURE_BYTES && new Uint8Array(data)[0] === MSG.SNAPSHOT) {
                stats.skipped++;
                return;
            }
            ws.sendBinary(data);
        },
        close(code, reason) {
            ws.close(code, reason);
        },
        rebind(next, id) {
            room = next;
            clientId = id;
        }
    };
    clientId = room.connect(link, {tier});
    ws.handlers = {
        onText: (text) => room.message(clientId, text),
        onBinary: (data) => room.message(clientId, data),
        onClose: () => {
            stats.connections--;
            room.disconnect(clientId);
        }
    };
}

const timer = setInterval(() => {
    for (const room of Array.from(rooms.values())) room.tick();
}, 100);

setTimeout(() => void refreshNpc(), 1000);
setInterval(() => void refreshNpc(), 60_000);

server.listen(PORT, () => log(`ark-live listening on :${PORT} (${DEV ? "development" : "production store"}; islands ${islands.join(", ")})`));

async function stop(signal: string) {
    log(`${signal}: releasing every animal`);
    clearInterval(timer);
    await Promise.all(Array.from(rooms.values(), (r) => r.shutdown()));
    server.close();
    process.exit(0);
}
process.on("SIGTERM", () => void stop("SIGTERM"));
process.on("SIGINT", () => void stop("SIGINT"));
