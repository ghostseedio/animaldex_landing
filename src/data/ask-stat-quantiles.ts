import "server-only";

/**
 * The live catalogue's spread of each relative stat (`animal_stat_quantiles`,
 * AnimalDex migration 20261025120000), which the persona's bands are cut on.
 * Read once per server instance every six hours, as the apps' edge function
 * does; null (the measured value cuts) when it cannot be read.
 */

import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {parseAskStatQuantiles, type AskStatQuantiles} from "@/lib/ask-animaldex/persona";

const QUANTILES_TTL_MS = 6 * 60 * 60 * 1000;

let cache: {at: number; value: AskStatQuantiles | null} | null = null;

export async function loadAskStatQuantiles(): Promise<AskStatQuantiles | null> {
    if (cache && Date.now() - cache.at < QUANTILES_TTL_MS) return cache.value;
    let value: AskStatQuantiles | null = null;
    const service = createSupabaseServiceClient();
    if (service) {
        try {
            const {data, error} = await service.rpc("animal_stat_quantiles");
            value = error ? null : parseAskStatQuantiles(data);
        } catch {
            value = null;
        }
    }
    cache = {at: Date.now(), value};
    return value;
}
