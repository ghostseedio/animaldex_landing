import "server-only";
import {cookies} from "next/headers";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabasePublicClient, createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * The shared Ark as `voyage_public_v1` returns it (Ark v1 contract, section
 * 2), read as the visitor: with their session when they have one, so their
 * own animals come back `mine`, and anonymously otherwise.
 *
 * `available: false` until the migration is applied (the function is
 * missing), or when the read fails: the page then says the Ark opens soon.
 */
export type ArkVoyageRead = {available: true; snapshot: ArkSnapshot; signedIn: boolean} | {available: false; signedIn: boolean};

export async function readArkVoyage(): Promise<ArkVoyageRead> {
    const signedIn = requestHasSupabaseAuthCookie(cookies().getAll());
    const supabase = signedIn ? createSupabaseServerClient() : createSupabasePublicClient();
    if (!supabase) return {available: false, signedIn};
    const {data, error} = await supabase.rpc("voyage_public_v1", {p_voyage: "first"});
    if (error) {
        console.warn("[ark] voyage_public_v1 failed", error.message.slice(0, 200));
        return {available: false, signedIn};
    }
    const snapshot = decodeArkSnapshot(data);
    return snapshot ? {available: true, snapshot, signedIn} : {available: false, signedIn};
}
