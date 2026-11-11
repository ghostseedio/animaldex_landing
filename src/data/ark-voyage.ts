import "server-only";
import {cookies} from "next/headers";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";
import {arkFoundersOf, ARK_NO_FOUNDERS, type ArkFounders} from "@/lib/ark-founders";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabasePublicClient, createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * The shared Ark as `voyage_public_v2` returns it (life v2: v1 plus each
 * animal's origin, generation, condition, activity and sociality, and the
 * Ark's day), or `voyage_public_v1` until v2 is applied, read as the visitor: with their session when they have one, so their
 * own animals come back `mine`, and anonymously otherwise.
 *
 * `founders`: the named founders and shared stories in the same answer
 * (`lib/ark-founders.ts`), beside the snapshot (the scene's decoder keeps
 * only the labels). None from v1, or while the server's `founder_names`
 * switch is off.
 *
 * `available: false` until the migration is applied (the function is
 * missing), or when the read fails: the page then says the Ark opens soon.
 */
/** Until when `voyage_public_v2` is known to be missing (asked again a minute later). */
let v2Missing = 0;

export type ArkVoyageRead = {available: true; snapshot: ArkSnapshot; founders: ArkFounders; signedIn: boolean} | {available: false; signedIn: boolean};

export async function readArkVoyage(): Promise<ArkVoyageRead> {
    const signedIn = requestHasSupabaseAuthCookie(cookies().getAll());
    const supabase = signedIn ? createSupabaseServerClient() : createSupabasePublicClient();
    if (!supabase) return {available: false, signedIn};
    // Life v2 first (origin, generation, condition, activity, sociality, the Ark's day); v1 until it is applied.
    let read = v2Missing > Date.now() ? null : await supabase.rpc("voyage_public_v2", {p_voyage: "first"});
    // The contract writes it with no argument (one shared Ark): ask that way too.
    if (read?.error && isMissingArkFunction(read.error)) read = await supabase.rpc("voyage_public_v2");
    if (read?.error && isMissingArkFunction(read.error)) {
        v2Missing = Date.now() + 60_000;
        read = null;
    }
    const {data, error} = read ?? await supabase.rpc("voyage_public_v1", {p_voyage: "first"});
    if (error) {
        console.warn("[ark] voyage_public failed", error.message.slice(0, 200));
        return {available: false, signedIn};
    }
    const snapshot = decodeArkSnapshot(data);
    return snapshot ? {available: true, snapshot, founders: read ? arkFoundersOf(data) : ARK_NO_FOUNDERS, signedIn} : {available: false, signedIn};
}
