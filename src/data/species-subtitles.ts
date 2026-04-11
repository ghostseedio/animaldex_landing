import {getSpeciesDescriptorBySlug} from "@/data/species-descriptors";
import {getSpeciesSubtitleStoryBySlug} from "@/data/species-subtitle-stories";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

export type SpeciesSubtitleRecord = {
    descriptor: string | null;
    subtitleStory: string | null;
};

type SpeciesSubtitleOptions = {
    fresh?: boolean;
};

function getFallbackSpeciesSubtitle(slug: string): SpeciesSubtitleRecord {
    return {
        descriptor: getSpeciesDescriptorBySlug(slug) ?? null,
        subtitleStory: getSpeciesSubtitleStoryBySlug(slug) ?? null
    };
}

async function fetchSpeciesSubtitleFromSupabase(locale: string, slug: string, options?: SpeciesSubtitleOptions): Promise<SpeciesSubtitleRecord | null> {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabaseServerReadKey();

    if (!supabaseUrl || !anonKey) {
        return null;
    }

    const fetchByLocale = async (targetLocale: string) => {
        const searchParams = new URLSearchParams({
            select: "descriptor,subtitle_story",
            locale: `eq.${targetLocale}`,
            slug: `eq.${slug}`,
            limit: "1"
        });
        const response = await fetch(`${supabaseUrl}/rest/v1/species_subtitles?${searchParams.toString()}`, {
            headers: getSupabaseHeaders(anonKey),
            ...(options?.fresh ? {cache: "no-store" as const} : {next: {revalidate: 3600}})
        });

        if (!response.ok) {
            throw new Error(`Supabase subtitle fetch failed with status ${response.status}`);
        }

        const [row] = await response.json() as Array<{descriptor: string; subtitle_story: string}>;

        if (!row) {
            return null;
        }

        return {
            descriptor: row.descriptor,
            subtitleStory: row.subtitle_story
        };
    };

    try {
        return await fetchByLocale(locale) ?? (locale === "en" ? null : await fetchByLocale("en"));
    } catch {
        return null;
    }
}

export async function getSpeciesSubtitle(slug: string, locale = "en", options?: SpeciesSubtitleOptions): Promise<SpeciesSubtitleRecord> {
    const supabaseRecord = await fetchSpeciesSubtitleFromSupabase(locale, slug, options);

    if (supabaseRecord) {
        return supabaseRecord;
    }

    return getFallbackSpeciesSubtitle(slug);
}
