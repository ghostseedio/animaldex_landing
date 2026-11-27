import "server-only";
import {loadLocaleMessages} from "@/loaders/locale";
import {companionWords, companionWordsForHearts, type CompanionWords} from "@/lib/companion-bond";
import {readArkHeartsRules} from "@/data/ark-hearts-rules";
import type {ArkHeartsRules} from "@/lib/ark-hearts-rules";
import {createSupabasePublicClient, createSupabaseServiceClient} from "@/lib/supabase/server";

/**
 * The Companions tab's, the bond screens' and the group picker's words in the
 * reader's language (`companions` in the locale file), English for any key
 * the locale lacks. Handed to the client components as a prop, as every
 * other label in this codebase is.
 *
 * Hearts are Ark lives (AnimalDex docs/ark/HEARTS-LIVES-DESIGN.md section 6): the debate copy follows the server's
 * `debates_config_v1().hearts_in_debates` (false: no heart stake, no Credits, the XP said instead) and the card's
 * hearts band its `ark_hearts`. Before the migration the read has neither, and the words are as they were.
 */
export async function getCompanionWords(locale: string): Promise<CompanionWords> {
    let words: CompanionWords;
    try {
        const messages = await loadLocaleMessages(locale);
        words = companionWords(messages?.companions);
    } catch {
        words = companionWords(null);
    }
    return companionWordsForHearts(words, await readHeartsFlags());
}

type HeartsFlags = {heartsInDebates: boolean | null; arkHearts: boolean | null; rules: ArkHeartsRules | null};
const FLAGS_TTL_MS = 60_000;
let cached: {at: number; flags: HeartsFlags} | null = null;

/** The server's two switches, read at most once a minute per server process; unknown (null) when they can't be read. */
async function readHeartsFlags(): Promise<HeartsFlags> {
    if (cached && Date.now() - cached.at < FLAGS_TTL_MS) return cached.flags;
    let flags: HeartsFlags = {heartsInDebates: null, arkHearts: null, rules: null};
    try {
        const supabase = createSupabaseServiceClient() ?? createSupabasePublicClient();
        const config = supabase ? await supabase.rpc("debates_config_v1") : null;
        const row = config && !config.error && config.data && typeof config.data === "object" ? config.data as Record<string, unknown> : null;
        // (The hearts rule beside them: a heart a survived attack, `hearts_escape`; null from a server that does not say it.)
        if (row) flags = {heartsInDebates: typeof row.hearts_in_debates === "boolean" ? row.hearts_in_debates : null, arkHearts: typeof row.ark_hearts === "boolean" ? row.ark_hearts : null, rules: await readArkHeartsRules(60)};
    } catch {
        // As they were.
    }
    cached = {at: Date.now(), flags};
    return flags;
}
