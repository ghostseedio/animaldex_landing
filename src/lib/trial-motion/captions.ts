/**
 * Pre-translated Trial Loop captions (`public.trial_motion_caption_translations`,
 * SPEC.md section 6).
 *
 * The site serves English and Indonesian, so the only language it ever asks
 * for is `id`. A row is used only while its `source_captions` are exactly the
 * storyboard's current captions; a storyboard revised after translation keeps
 * its English captions until the row is redone.
 */

import type {TrialStoryboard} from "./storyboard";

/** The non-English page languages that have translated captions on this site. */
const CAPTION_LANGUAGES = ["id"];

/** The caption language for a site locale, or null for English (the storyboard's own captions). */
export function trialMotionCaptionLanguage(locale: string | null | undefined): string | null {
    const normalized = (locale ?? "").trim().toLowerCase();
    return CAPTION_LANGUAGES.includes(normalized) ? normalized : null;
}

/** `/id/...` is Indonesian; every other path is English (`as-needed` prefixes). */
export function trialMotionCaptionLanguageFromPath(pathname: string | null | undefined): string | null {
    const first = (pathname ?? "").split("/").filter(Boolean)[0] ?? null;
    return trialMotionCaptionLanguage(first);
}

export type TrialMotionCaptionRow = {sourceCaptions: string[]; captions: string[]};

function stringList(value: unknown): string[] | null {
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? (value as string[]) : null;
}

/** One `trial_motion_caption_translations` row's two arrays, or null when malformed. */
export function decodeTrialMotionCaptionRow(row: {source_captions?: unknown; captions?: unknown} | null | undefined): TrialMotionCaptionRow | null {
    const sourceCaptions = stringList(row?.source_captions);
    const captions = stringList(row?.captions);
    return sourceCaptions && captions ? {sourceCaptions, captions} : null;
}

/**
 * The translated captions to show, or null for the storyboard's own. Valid only
 * when the row was translated from exactly these captions (same count, same
 * strings) and has one non-empty caption per beat.
 */
export function translatedTrialMotionCaptions(storyboard: TrialStoryboard | null | undefined, row: TrialMotionCaptionRow | null | undefined): string[] | null {
    if (!storyboard || !row) return null;
    const beats = storyboard.beats;
    if (row.sourceCaptions.length !== beats.length || row.captions.length !== beats.length) return null;
    if (!beats.every((beat, index) => beat.caption === row.sourceCaptions[index])) return null;
    if (!row.captions.every((caption) => caption.trim())) return null;
    return row.captions.map((caption) => caption.trim());
}
