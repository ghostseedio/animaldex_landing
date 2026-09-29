/**
 * The two orders a capture's media is shown in, ported from the iOS source of
 * truth (`CaptureTimelineMediaPreference` and `AnimalCapture.orderedMediaAssets`
 * / `coverFirstMediaAssets`).
 *
 * They are deliberately different. A timeline card answers "what is new on this
 * capture", so it leads with moving media and then the newest extra photo. A
 * detail card answers "what is this capture", so its carousel keeps the
 * persisted cover as the first page.
 */

export type CaptureMediaKind = "photo" | "loop" | "video";

export type OrderableCaptureMedia = {
    id: string;
    kind: CaptureMediaKind;
    sortOrder: number;
    /** Epoch milliseconds, or null when the row carries no usable timestamp. */
    createdAt: number | null;
};

function kindPriority(kind: CaptureMediaKind) {
    switch (kind) {
        case "video": return 0;
        case "loop": return 1;
        default: return 2;
    }
}

function isMovingMedia(kind: CaptureMediaKind) {
    return kind === "video" || kind === "loop";
}

/**
 * The still the model analysed: the photo at sort order zero. It is the cover,
 * and on a card that has anything newer it is the least interesting page.
 */
export function isAnalysisSourceStill(asset: Pick<OrderableCaptureMedia, "kind" | "sortOrder">) {
    return asset.kind === "photo" && asset.sortOrder === 0;
}

function compareTimeline(left: OrderableCaptureMedia, right: OrderableCaptureMedia) {
    const priority = kindPriority(left.kind) - kindPriority(right.kind);
    if (priority !== 0) return priority;

    // Extra / merged media before the analysis still.
    const leftAnalysis = isAnalysisSourceStill(left);
    const rightAnalysis = isAnalysisSourceStill(right);
    if (leftAnalysis !== rightAnalysis) return leftAnalysis ? 1 : -1;

    // Newest first, so duplicate-merge extras surface ahead of older stills. A
    // row with a timestamp sorts ahead of one without.
    if (left.createdAt != null && right.createdAt != null) {
        if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt;
    } else if (left.createdAt != null) {
        return -1;
    } else if (right.createdAt != null) {
        return 1;
    }

    if (left.sortOrder !== right.sortOrder) return right.sortOrder - left.sortOrder;
    return left.id < right.id ? 1 : left.id > right.id ? -1 : 0;
}

/**
 * Timeline order: video, then loop, then photos newest first with the analysis
 * still last.
 *
 * When the card holds moving media the analysis still is not a page at all — it
 * exists for the model and as a poster — unless dropping it would leave nothing.
 */
export function timelineMediaOrder<T extends OrderableCaptureMedia>(assets: T[]): T[] {
    if (assets.length <= 1) return assets;

    if (assets.some((asset) => isMovingMedia(asset.kind))) {
        const display = assets.filter((asset) => !isAnalysisSourceStill(asset));
        return [...(display.length ? display : assets)].sort(compareTimeline);
    }

    return [...assets].sort(compareTimeline);
}

/**
 * Detail order: the persisted position only. No preference for media kind,
 * analysis status or recency is applied here.
 */
export function coverFirstMediaOrder<T extends OrderableCaptureMedia>(assets: T[]): T[] {
    if (assets.length <= 1) return assets;
    return [...assets].sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
}
