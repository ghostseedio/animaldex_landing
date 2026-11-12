import "server-only";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";
import {readPublicArk} from "@/data/ark-public";
import {arkActivity, isAwake, sunElevation} from "@/lib/ark-daylight";
import {arkHappeningsSince, arkPopulationSeries, arkSeriesTimes} from "@/lib/ark-population-series";
import {arkSpeciesKey} from "@/lib/ark-population";
import {isMissingArkFunction} from "@/lib/ark-story";
import {getSupabaseHeaders, getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import type {ArkLandingSummary} from "@/lib/ark-landing";

export type {ArkLandingSummary};

/**
 * The home page's live Ark (landing lane S2): its numbers, the last day's births and meals, who is awake at each hour,
 * and every population since the voyage began, for `/api/ark/landing`. Also the anonymous snapshot the hero's 3D
 * world mounts (`/api/ark/landing/snapshot`).
 *
 * Real data only, and nobody's: the public read (`voyage_public_v2` through `readPublicArk`, shared with /ark's
 * metadata and the species pages, so it costs no extra read) and the public event log (`voyage_events_since_v1`).
 * Counts and species only: a bringer's label, a step, a debate or a chat never reaches the page.
 *
 * The log is read once from the voyage's start and then only what is new, kept per process (the rows cut to what the
 * counts need), so the Ark's whole history costs one full read per server start and a page or so a minute after.
 *
 * In development without Supabase keys (lanes run without them), both reads come from the live site's public routes
 * (`/api/ark/voyage`, `/api/ark/events`), so the local page shows the real Ark too, never a fixture.
 */

const SUMMARY_TTL_MS = 60_000;
const LOG_REFRESH_MS = 60_000;
const LOG_PAGE = 500;
/** Pages per read: the first read walks the whole log (about 16 pages on 2026-11-12); later ones a page or two. */
const LOG_MAX_PAGES = 60;
/** Moments on the chart, from the voyage's start to now. */
const SERIES_POINTS = 48;
const SERIES_SPECIES = 6;
const DAY_MS = 86_400_000;
const LIVE_SITE = "https://animaldex.app";

type Row = Record<string, unknown>;

function record(value: unknown): Row | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

const development = process.env.NODE_ENV === "development";

// MARK: The snapshot

async function readSnapshot(): Promise<ArkSnapshot | null> {
    if (getSupabaseUrl() && getSupabasePublicKey()) return readPublicArk(300);
    if (!development) return null;
    if (devSnapshot && Date.now() - devSnapshot.at < 60_000) return devSnapshot.promise;
    const promise = fetch(`${LIVE_SITE}/api/ark/voyage`, {cache: "no-store"})
        .then(async (response) => {
            const body = response.ok ? record(await response.json()) : null;
            return body ? decodeArkSnapshot(body.snapshot ?? body) : null;
        })
        .catch(() => null);
    devSnapshot = {at: Date.now(), promise};
    return promise;
}

let devSnapshot: {at: number; promise: Promise<ArkSnapshot | null>} | null = null;

/**
 * The snapshot as the home page's hero mounts it: every bringer anonymous and nothing `mine` (the Ark's display rule
 * for a page anyone may land on), so the world is the same for everyone and no name can reach it.
 */
export async function readArkLandingSnapshot(): Promise<ArkSnapshot | null> {
    const snapshot = await readSnapshot();
    if (!snapshot) return null;
    return {
        ...snapshot,
        animals: snapshot.animals.map((animal) => ({...animal, brought_by: {label: "", named: false}, bringers: [], mine: false})),
        nests: snapshot.nests?.map((nest) => ({...nest, mine: false}))
    };
}

// MARK: The event log, kept per process

type LogState = {rows: Row[]; ids: Set<string>; cursor: string | null; from: string | null; complete: boolean; readAt: number; gapAt: number | null};

const log: LogState = {rows: [], ids: new Set(), cursor: null, from: null, complete: false, readAt: 0, gapAt: null};
let logReading: Promise<void> | null = null;

/** A row cut to what the counts need: its id, time, kind and the animals' ids and species (never a name or a label). */
function slim(item: unknown): Row | null {
    const row = record(item);
    if (!row) return null;
    const animalOf = (value: unknown) => {
        const animal = record(value);
        return animal ? {id: text(animal.id), species_profile_id: text(animal.species_profile_id), model_slug: text(animal.model_slug)} : null;
    };
    return {id: row.id ?? null, at: text(row.at), kind: text(row.kind), species_profile_id: text(row.species_profile_id), animal: animalOf(row.animal), other: animalOf(row.other)};
}

async function readLogPage(since: string): Promise<{events: unknown[]; next: string | null; more: boolean} | null> {
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    try {
        if (url && key) {
            const response = await fetch(`${url}/rest/v1/rpc/voyage_events_since_v1`, {
                method: "POST",
                headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
                body: JSON.stringify({p_since: since, p_limit: LOG_PAGE}),
                cache: "no-store"
            });
            const body = response.ok ? record(await response.json().catch(() => null)) : null;
            if (!body || !Array.isArray(body.events)) {
                if (body && isMissingArkFunction(body as {code?: string; message?: string})) return null;
                return null;
            }
            return {events: body.events, next: text(body.next_since), more: body.more === true};
        }
        if (!development) return null;
        // (Development without keys: the live site's public route, which follows a few pages itself.)
        const response = await fetch(`${LIVE_SITE}/api/ark/events?since=${encodeURIComponent(since)}`, {cache: "no-store"});
        const body = response.ok ? record(await response.json()) : null;
        if (!body || !Array.isArray(body.events)) return null;
        const last = body.events.length ? text(record(body.events[body.events.length - 1])?.at) : null;
        return {events: body.events, next: last, more: body.more === true};
    } catch {
        return null;
    }
}

async function refreshLog(startedAt: string): Promise<void> {
    if (log.from !== startedAt) {
        // A new voyage (or the first read): from its start.
        log.rows = [];
        log.ids = new Set();
        log.cursor = startedAt;
        log.from = startedAt;
        log.complete = false;
        log.gapAt = null;
    }
    let cursor = log.cursor ?? startedAt;
    for (let page = 0; page < LOG_MAX_PAGES; page++) {
        const read = await readLogPage(cursor);
        if (!read) return;
        let last: string | null = null;
        for (const item of read.events) {
            const row = slim(item);
            const id = row && (typeof row.id === "number" || typeof row.id === "string") ? String(row.id) : null;
            if (!row || (id !== null && log.ids.has(id))) continue;
            if (id !== null) log.ids.add(id);
            log.rows.push(row);
            last = text(row.at) ?? last;
        }
        // (The route starts a page at a time; rows at the cursor's moment come again and are skipped by id.)
        if (!read.more) {
            log.complete = true;
            log.cursor = last ?? cursor;
            return;
        }
        let next = read.next ?? last;
        if (development && next && !getSupabaseUrl() && Math.floor(Date.parse(next) / 60_000) === Math.floor(Date.parse(cursor) / 60_000) && !last) {
            // (Development's public route starts at a minute: a minute holding more rows than it pages through is
            // stepped over, and the animals it brought are counted as arriving then.)
            log.gapAt ??= Date.parse(cursor);
            next = new Date((Math.floor(Date.parse(cursor) / 60_000) + 1) * 60_000).toISOString();
        }
        if (!next || next === cursor) break;
        cursor = next;
        log.cursor = cursor;
    }
}

async function readLog(startedAt: string): Promise<{rows: Row[]; complete: boolean; gapAt: number | null}> {
    if (Date.now() - log.readAt > LOG_REFRESH_MS || log.from !== startedAt) {
        logReading ??= refreshLog(startedAt).finally(() => {
            log.readAt = Date.now();
            logReading = null;
        });
        await logReading;
    }
    return {rows: log.rows, complete: log.complete, gapAt: log.gapAt};
}

// MARK: The summary

function awakeByHour(snapshot: ArkSnapshot): number[] {
    const hours = Array.from({length: 24}, () => 0);
    for (const animal of snapshot.animals) {
        const activity = arkActivity(animal.activity);
        for (let hour = 0; hour < 24; hour++) if (isAwake(activity, sunElevation(hour))) hours[hour]++;
    }
    return hours;
}

function topSpecies(snapshot: ArkSnapshot, count: number): ArkLandingSummary["top"] {
    const rows = new Map<string, {name: string; slug: string; count: number}>();
    for (const animal of snapshot.animals) {
        const key = arkSpeciesKey(animal);
        const row = rows.get(key) ?? {name: animal.kind_name ?? animal.name, slug: animal.model_slug, count: 0};
        row.count++;
        rows.set(key, row);
    }
    return Array.from(rows.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, count);
}

const EMPTY: ArkLandingSummary = {available: false, asOf: null, startedAt: null, counts: {animals: 0, species: 0, founders: 0}, today: null, top: [], awake: [], series: null};

async function buildSummary(): Promise<ArkLandingSummary> {
    const snapshot = await readSnapshot();
    if (!snapshot) return EMPTY;
    const startedAt = snapshot.voyage.started_at;
    const now = Date.parse(snapshot.as_of ?? "") || Date.now();
    const {rows, complete, gapAt} = startedAt ? await readLog(startedAt) : {rows: [], complete: false, gapAt: null};
    const since = now - DAY_MS;
    const series = startedAt && rows.length
        ? arkPopulationSeries(snapshot, rows, {times: arkSeriesTimes(Date.parse(startedAt), now, SERIES_POINTS), top: SERIES_SPECIES, complete: complete || gapAt !== null, unloggedCameAt: gapAt})
        : null;
    return {
        available: true,
        asOf: snapshot.as_of,
        startedAt,
        counts: snapshot.counts,
        today: complete || (gapAt !== null && gapAt < since) ? {since: new Date(since).toISOString(), ...arkHappeningsSince(rows, since)} : null,
        top: topSpecies(snapshot, 3),
        awake: awakeByHour(snapshot),
        series
    };
}

let summaryMemo: {at: number; promise: Promise<ArkLandingSummary>} | null = null;

/** The home page's live Ark, computed at most once a minute per process. */
export function readArkLandingSummary(): Promise<ArkLandingSummary> {
    const now = Date.now();
    if (summaryMemo && now - summaryMemo.at < SUMMARY_TTL_MS) return summaryMemo.promise;
    const promise = buildSummary().catch((error) => {
        console.warn("[ark-landing] summary failed", error instanceof Error ? error.message.slice(0, 200) : error);
        return EMPTY;
    });
    summaryMemo = {at: now, promise};
    void promise.then((summary) => {
        if (!summary.available && summaryMemo?.promise === promise) summaryMemo = null;
    });
    return promise;
}
