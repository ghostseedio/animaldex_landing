/**
 * Load test for `ark-live` (design §10 item 1.9): bots that control animals with the page's own mover (so every pose
 * is one a real client would send) and watchers that only receive, against a local development server. It reports
 * what the server spent (CPU, memory) and sent (bytes per client per second, with the wire's framing), and how many
 * poses were corrected (should be none).
 *
 *   ARK_LIVE_DEV=1 npx tsx ark-live/server.mts &
 *   npx tsx ark-live/bots.mts --controllers 50 --watchers 50 --seconds 60 [--tier high] [--url ws://localhost:8787]
 */

import {abilitiesOf} from "@/ark-live/species";
import {LazyTerrain} from "@/ark-live/terrain";
import {NO_INPUT, startMover, stepMover, type MoverState} from "@/ark-live/movement";
import {decodeBinary, encodePing, encodePose, type StartPose, type TextToClient} from "@/ark-live/protocol";
import {worldSampler} from "@/ark-scene/world-sampler";
import {defaultHomePlots} from "@/ark-scene/props/home-layout";
import {ZONE_SITES} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const URL_BASE = args.get("url") ?? "ws://localhost:8787";
const HTTP_BASE = URL_BASE.replace(/^ws/, "http");
const CONTROLLERS = Number(args.get("controllers") ?? 10);
const WATCHERS = Number(args.get("watchers") ?? 10);
const SECONDS = Number(args.get("seconds") ?? 30);
const TIER = args.get("tier") ?? "high";

const SPECIES: Array<{slug: string; zone: ArkZone}> = [
    {slug: "red-fox", zone: "woodland"},
    {slug: "roe-deer", zone: "woodland"},
    {slug: "cheetah", zone: "grassland"},
    {slug: "golden-eagle", zone: "mountains"},
    {slug: "mallard", zone: "river_lake"},
    {slug: "european-otter", zone: "river_lake"},
    {slug: "dromedary-camel", zone: "desert"},
    {slug: "lar-gibbon", zone: "rainforest"}
];

const sampler = worldSampler();
const terrain = new LazyTerrain("wild", 132, sampler, {plots: defaultHomePlots()});

type Counter = {bytes: number; messages: number; snapshots: number; corrections: number; entities: number};

function uuid(prefix: number, i: number): string {
    return `00000000-0000-4000-${String(prefix).padStart(4, "0")}-${String(i).padStart(12, "0")}`;
}

async function controller(i: number, counter: Counter, stopAt: number): Promise<void> {
    const species = SPECIES[i % SPECIES.length];
    const site = ZONE_SITES[species.zone];
    const a = abilitiesOf(species.slug);
    const facts = {id: uuid(1, i), slug: species.slug, zone: species.zone, area: null, enclosure: null};
    // A start near its zone's site, on ground it can stand on.
    let x = site.x + ((i * 7) % 11) - 5;
    let z = site.z + ((i * 13) % 11) - 5;
    for (let k = 0; k < 40; k++) {
        const c = terrain.cell(x, z);
        if (c && c.depth <= 0 && !(c.flags & 2)) break;
        x = site.x + ((k * 3) % 9) - 4;
        z = site.z + ((k * 5) % 9) - 4;
    }
    const start: StartPose = {x, y: terrain.height(x, z), z, yaw: 0, mode: "ground"};
    const user = uuid(2, i);
    const ticketRes = await fetch(`${HTTP_BASE}/dev/ticket?animal=${facts.id}&user=${user}&slug=${species.slug}&zone=${species.zone}`);
    const ticket = (await ticketRes.json()) as {ok: boolean; ticket?: string; reason?: string};
    if (!ticket.ok || !ticket.ticket) throw new Error(`ticket for bot ${i}: ${ticket.reason}`);
    const ws = new WebSocket(`${URL_BASE}/v1/live?island=wild&tier=${TIER}`);
    ws.binaryType = "arraybuffer";
    let unit = 0.01;
    let epochBase = 0;
    let offset = 0;
    let state: MoverState | null = null;
    let seq = 0;
    const ctx = {a, facts, terrain, sig: null};
    let heading = (i * 0.7) % (Math.PI * 2);
    await new Promise<void>((resolve, reject) => {
        ws.onerror = () => reject(new Error(`socket ${i}`));
        ws.onclose = () => resolve();
        ws.onmessage = (event) => {
            const data = event.data as ArrayBuffer | string;
            counter.bytes += (typeof data === "string" ? data.length : data.byteLength) + 66;
            counter.messages++;
            if (typeof data === "string") {
                const m = JSON.parse(data) as TextToClient;
                if (m.t === "welcome") {
                    unit = m.unit;
                    epochBase = m.epochBase;
                    offset = Date.now() - epochBase;
                    ws.send(JSON.stringify({t: "hello", proto: 1, island: "wild", tier: TIER, client: "bot"}));
                    ws.send(JSON.stringify({t: "control", ticket: ticket.ticket, start}));
                    ws.send(encodePing(Date.now() - epochBase));
                } else if (m.t === "control-ok") {
                    state = startMover(m.start, ctx);
                    const timer = setInterval(() => {
                        if (Date.now() > stopAt || !state) {
                            clearInterval(timer);
                            ws.send(JSON.stringify({t: "release"}));
                            setTimeout(() => ws.close(), 300);
                            return;
                        }
                        // A wandering walk: turn a little now and then, run sometimes.
                        heading += (Math.sin(Date.now() / 3000 + i) * 0.4) * 0.1;
                        const t = (Date.now() / 1000 + i) % 20;
                        state = stepMover(state, {...NO_INPUT, dirX: Math.sin(heading), dirZ: Math.cos(heading), amount: 1, run: t > 12, takeoff: a.canFly && t > 5 && t < 5.1, vertical: a.canFly ? (t < 9 ? 0.5 : t > 16 ? -1 : 0) : 0, flap: t < 9}, 0.1, ctx);
                        seq = (seq + 1) & 0xffff;
                        ws.send(encodePose({...state, seq, t: Date.now() - epochBase, flags: 0}, unit));
                        if (seq % 100 === 0) ws.send(encodePing(Date.now() - epochBase));
                    }, 100);
                } else if (m.t === "control-denied") {
                    reject(new Error(`bot ${i} denied: ${m.reason}`));
                }
                return;
            }
            const d = decodeBinary(data, unit);
            if (d?.type === "snapshot") {
                counter.snapshots++;
                counter.entities += d.snapshot.entities.length;
            } else if (d?.type === "correction" && state) {
                counter.corrections++;
                const c = d.correction;
                state = {...state, x: c.x, y: c.y, z: c.z, yaw: c.yaw, mode: c.mode, speed: 0};
            }
        };
    });
    void offset;
}

async function watcher(i: number, counter: Counter, stopAt: number): Promise<void> {
    const ws = new WebSocket(`${URL_BASE}/v1/live?island=wild&tier=${TIER}`);
    ws.binaryType = "arraybuffer";
    await new Promise<void>((resolve) => {
        ws.onclose = () => resolve();
        ws.onerror = () => resolve();
        ws.onmessage = (event) => {
            const data = event.data as ArrayBuffer | string;
            counter.bytes += (typeof data === "string" ? data.length : data.byteLength) + 66;
            counter.messages++;
            if (typeof data === "string") {
                const m = JSON.parse(data) as TextToClient;
                if (m.t === "welcome") ws.send(JSON.stringify({t: "view", x: 0, z: 0, r: 200}));
                return;
            }
            const d = decodeBinary(data, 0.01);
            if (d?.type === "snapshot") {
                counter.snapshots++;
                counter.entities += d.snapshot.entities.length;
            }
        };
        const timer = setInterval(() => {
            if (Date.now() > stopAt) {
                clearInterval(timer);
                ws.close();
            }
        }, 200);
    });
    void i;
}

async function serverStats(): Promise<{cpu_user_ms: number; cpu_system_ms: number; rss_mb: number; rooms: Record<string, {bytesOut: number; corrections: number; accepted: number; posesIn: number; tickMs: number; ticks: number}>}> {
    return (await (await fetch(`${HTTP_BASE}/stats`)).json()) as never;
}

async function main(): Promise<void> {
    const before = await serverStats();
    const t0 = Date.now();
    const warm = 4000;
    const stopAt = t0 + warm + SECONDS * 1000;
    const control: Counter = {bytes: 0, messages: 0, snapshots: 0, corrections: 0, entities: 0};
    const watch: Counter = {bytes: 0, messages: 0, snapshots: 0, corrections: 0, entities: 0};
    const jobs: Array<Promise<void>> = [];
    for (let i = 0; i < CONTROLLERS; i++) jobs.push(controller(i, control, stopAt).catch((e: Error) => console.error(e.message)));
    for (let i = 0; i < WATCHERS; i++) jobs.push(watcher(i, watch, stopAt));
    // Sample the server once everyone is in and moving.
    await new Promise((r) => setTimeout(r, warm));
    const mid0 = await serverStats();
    const mid0At = Date.now();
    const rssPeak: number[] = [];
    const sampler2 = setInterval(async () => rssPeak.push((await serverStats()).rss_mb), 5000);
    await new Promise((r) => setTimeout(r, SECONDS * 1000 - 200));
    const mid1 = await serverStats();
    const mid1At = Date.now();
    clearInterval(sampler2);
    await Promise.all(jobs);
    const wall = (mid1At - mid0At) / 1000;
    const cpu = (mid1.cpu_user_ms + mid1.cpu_system_ms - mid0.cpu_user_ms - mid0.cpu_system_ms) / 1000 / wall;
    const room0 = mid0.rooms.wild;
    const room1 = mid1.rooms.wild;
    const clients = CONTROLLERS + WATCHERS;
    const report = {
        controllers: CONTROLLERS,
        watchers: WATCHERS,
        tier: TIER,
        seconds: Math.round(wall),
        server_cpu_cores: Math.round(cpu * 1000) / 1000,
        server_rss_mb: Math.max(mid1.rss_mb, ...rssPeak),
        server_rss_idle_mb: before.rss_mb,
        egress_bytes_per_s_total: Math.round((room1.bytesOut - room0.bytesOut) / wall),
        egress_bytes_per_client_s: Math.round((room1.bytesOut - room0.bytesOut) / wall / Math.max(clients, 1)),
        received_controller_bytes_per_s: Math.round(control.bytes / ((stopAt - t0) / 1000) / Math.max(CONTROLLERS, 1)),
        received_watcher_bytes_per_s: Math.round(watch.bytes / ((stopAt - t0) / 1000) / Math.max(WATCHERS, 1)),
        poses_accepted: room1.accepted - room0.accepted,
        poses_in: room1.posesIn - room0.posesIn,
        corrections: room1.corrections - room0.corrections,
        tick_ms_mean: Math.round(((room1.tickMs - room0.tickMs) / Math.max(room1.ticks - room0.ticks, 1)) * 1000) / 1000,
        mean_entities_per_snapshot: Math.round((watch.entities / Math.max(watch.snapshots, 1)) * 10) / 10
    };
    console.log(JSON.stringify(report, null, 2));
}

main().then(() => process.exit(0), (error: Error) => {
    console.error(error);
    process.exit(1);
});
