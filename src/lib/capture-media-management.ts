/**
 * What an owner may do to the media on one of their captures, ported from the
 * iOS source of truth (`ScanResultCatalogHeroView`, `CaptureMediaGalleryView`
 * and `ProfilePetSelection`).
 *
 * These rules decide what the interface OFFERS. The server decides what
 * happens: `set_capture_cover_media` refuses a cover that was never analysed,
 * and the delete only ever matches rows above position zero.
 */

export type ManagedCaptureMedia = {
    id: string;
    kind: "photo" | "loop" | "video";
    sortOrder: number;
    /** The `capture_images` row. Absent on a placeholder that stands in for a missing row. */
    mediaRowId?: string | null;
    /** True when the shot has its own observation, as a merged re-capture does. */
    hasIndependentAnalysis?: boolean;
    createdAt?: string | null;
};

/**
 * The still the model analysed: the photo at position zero. It is locked — it
 * can be replaced as the cover, never removed.
 */
export function isAnalysisSourceLocked(asset: Pick<ManagedCaptureMedia, "kind" | "sortOrder">) {
    return asset.kind === "photo" && asset.sortOrder === 0;
}

/** Analysed shots, including merged re-captures, are not "extra media". */
export function isAnalysedMedia(asset: ManagedCaptureMedia) {
    return asset.hasIndependentAnalysis === true || isAnalysisSourceLocked(asset);
}

export function mediaKindBadge(asset: ManagedCaptureMedia) {
    return isAnalysedMedia(asset) ? "Analysis image" : "Extra media";
}

/**
 * Only an analysed shot can become the cover, and never the page that already
 * is one. Carousel invariant: page zero is always the cover.
 */
export function canBecomeCover(asset: ManagedCaptureMedia, index: number) {
    return Boolean(asset.mediaRowId) && index !== 0 && isAnalysedMedia(asset);
}

export function isDeletableMedia(asset: ManagedCaptureMedia) {
    return Boolean(asset.mediaRowId) && !isAnalysisSourceLocked(asset);
}

export function galleryTitle(count: number, selection: {isSelecting: boolean; selectedCount: number}) {
    if (selection.isSelecting) {
        return selection.selectedCount ? `${selection.selectedCount} Selected` : "Select Media";
    }
    return count === 1 ? "1 Photo" : `${count} Items`;
}

export function deleteConfirmTitle(count: number) {
    return count === 1 ? "Remove this media?" : `Remove ${count} items?`;
}

export function deleteConfirmAction(count: number) {
    return count === 1 ? "Delete Media" : `Delete ${count} Items`;
}

export const DELETE_CONFIRM_MESSAGE = "Analysis photos stay locked and are never removed.";

export type MediaDaySection<T> = {
    /** `yyyy-mm-dd` in the viewer's own time zone, or `undated`. */
    key: string;
    title: string;
    entries: Array<{asset: T; index: number}>;
};

function dayKey(value: string | null | undefined) {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The grid, grouped by the day each item was added and newest day first. An
 * item with no usable date is grouped under "Recently added" rather than
 * hidden. `index` is the item's page in the carousel, so tapping a cell can
 * open exactly that page.
 */
export function mediaDaySections<T extends ManagedCaptureMedia>(
    assets: T[],
    formatDay: (date: Date) => string = (date) =>
        date.toLocaleDateString(undefined, {day: "numeric", month: "long", year: "numeric"})
): Array<MediaDaySection<T>> {
    const sections = new Map<string, MediaDaySection<T>>();

    assets.forEach((asset, index) => {
        const key = dayKey(asset.createdAt) ?? "undated";
        const existing = sections.get(key);
        if (existing) {
            existing.entries.push({asset, index});
            return;
        }
        sections.set(key, {
            key,
            title: key === "undated" ? "Recently added" : formatDay(new Date(asset.createdAt as string)),
            entries: [{asset, index}]
        });
    });

    return Array.from(sections.values()).sort((left, right) => {
        if (left.key === "undated") return -1;
        if (right.key === "undated") return 1;
        return left.key < right.key ? 1 : left.key > right.key ? -1 : 0;
    });
}

// MARK: - Pets

const DOMESTIC_PET_TYPE_TAGS = new Set(["pet", "domestic", "farm animal", "livestock", "canine", "feline"]);

function normalized(value: string | null | undefined) {
    return value?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? "";
}

function signal(signals: Record<string, unknown> | null | undefined, snake: string, camel: string) {
    return signals?.[snake] === true || signals?.[camel] === true;
}

/**
 * May this capture be marked as one of the owner's pets?
 *
 * A wild or zoo animal never can, whatever else the analysis says. Otherwise
 * any one domestic signal is enough.
 */
export function isEligibleToMarkAsPet(capture: {
    settingTag?: string | null;
    humanContext?: string | null;
    typeTags?: string[] | null;
    signals?: Record<string, unknown> | null;
}) {
    const setting = normalized(capture.settingTag);
    if (setting === "wild" || setting === "zoo") return false;

    if (normalized(capture.humanContext) === "pet") return true;
    if (setting === "domestic" || setting === "farm") return true;
    if ((capture.typeTags ?? []).some((tag) => DOMESTIC_PET_TYPE_TAGS.has(normalized(tag)))) return true;

    return signal(capture.signals, "farm_context_likely", "farmContextLikely")
        || signal(capture.signals, "domestic_context_likely", "domesticContextLikely")
        || signal(capture.signals, "indoor_home_likely", "indoorHomeLikely");
}

/** What to show when the server refuses a media change. Never a raw code. */
export function mediaMutationMessage(code: string | null | undefined) {
    const value = code ?? "";
    if (value.includes("cover_requires_analysis_image")) return "Only an analysed photo can be the cover.";
    if (value.includes("media_locked_or_unavailable")) return "That media is locked or no longer there.";
    if (value.includes("capture_not_owned")) return "Only the owner can change this capture's media.";
    if (value.includes("invalid_token")) return "Sign in again to change this capture's media.";
    return "That change did not go through. Try again in a moment.";
}
