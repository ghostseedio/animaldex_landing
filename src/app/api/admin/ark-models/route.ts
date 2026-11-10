import {NextRequest, NextResponse} from "next/server";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkMissingModels, decodeArkMissingModels, type ArkMissingModel} from "@/lib/ark-missing-models";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {TALKING_MODELS_BASE_URL} from "@/lib/talking-models/catalog";

/**
 * Species on the Ark with no Ark model (owner decision A13), for
 * /admin/ark-models: they are drawn as the placeholder figure until one is
 * made. Read-only.
 *
 * From the server's `voyage_missing_models_v1` (service role) when it is
 * applied; until then worked out here: the public read (`voyage_public_v2`,
 * else v1) against the model set's manifest (`<models>/ark/manifest.json`).
 */

export type ArkModelsPayload = {
    ok: boolean;
    error?: string;
    generatedAt: string;
    /** Where the list came from. */
    source: "rpc" | "generated";
    /** Why it was generated (the function is missing, or failed). */
    note?: string;
    manifestSpecies: number | null;
    species: ArkMissingModel[];
};

async function rpc(url: string, key: string, name: string, body: Record<string, unknown>): Promise<{ok: true; data: unknown} | {ok: false; status: number; detail: string}> {
    try {
        const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
            body: JSON.stringify(body),
            cache: "no-store"
        });
        if (!response.ok) return {ok: false, status: response.status, detail: (await response.text()).slice(0, 300)};
        return {ok: true, data: await response.json()};
    } catch (error) {
        return {ok: false, status: 0, detail: error instanceof Error ? error.message : "Request failed"};
    }
}

function modelsBase(): string {
    const configured = process.env.NEXT_PUBLIC_ARK_MODELS_URL?.trim();
    return configured ? configured.replace(/\/+$/, "") : `${TALKING_MODELS_BASE_URL}/ark`;
}

async function manifestSlugs(): Promise<Set<string> | null> {
    try {
        const response = await fetch(`${modelsBase()}/manifest.json`, {cache: "no-store"});
        if (!response.ok) return null;
        const body = await response.json() as {models?: Record<string, unknown>};
        return new Set(Object.keys(body.models ?? {}));
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) {
        return NextResponse.json({ok: false, error: "Supabase access is not configured"}, {status: 500});
    }
    const generatedAt = new Date().toISOString();
    const [read, listed] = await Promise.all([rpc(url, key, "voyage_missing_models_v1", {}), manifestSlugs()]);
    if (read.ok) {
        return NextResponse.json({ok: true, generatedAt, source: "rpc", manifestSpecies: listed?.size ?? null, species: decodeArkMissingModels(read.data)} satisfies ArkModelsPayload);
    }
    const missing = read.status === 404 || /voyage_missing_models_v1|could not find the function/i.test(read.detail);
    // Generated: the public read against the manifest.
    let snapshot = await rpc(url, key, "voyage_public_v2", {p_voyage: "first"});
    if (!snapshot.ok) snapshot = await rpc(url, key, "voyage_public_v1", {p_voyage: "first"});
    if (!snapshot.ok) {
        return NextResponse.json({ok: false, error: `The Ark's public read failed (${snapshot.status}): ${snapshot.detail}`, generatedAt, source: "generated", manifestSpecies: listed?.size ?? null, species: []} satisfies ArkModelsPayload, {status: 502});
    }
    return NextResponse.json({
        ok: true,
        generatedAt,
        source: "generated",
        note: missing ? "voyage_missing_models_v1 is not applied yet: generated from the public read and the model manifest." : `voyage_missing_models_v1 failed (${read.status}): generated instead.`,
        manifestSpecies: listed?.size ?? null,
        species: arkMissingModels(decodeArkSnapshot(snapshot.data), listed)
    } satisfies ArkModelsPayload);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
