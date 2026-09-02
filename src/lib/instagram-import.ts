export const INSTAGRAM_IMPORT_PATH = "/app/import/instagram";
export const INSTAGRAM_IMPORT_USE_CASE_PATH = "/use-cases/import-instagram-wildlife-photos";

/**
 * Web-first marketing is live only when this is the string "true".
 * Absent, "false", "1", or any other value is false. Do not use Boolean(env).
 * NEXT_PUBLIC_ values are inlined at Next.js build time — flipping production
 * requires a rebuild after the Vercel env is set.
 */
export function isInstagramWebImportLive(
    value: string | undefined = process.env.NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE
) {
    return value === "true";
}

export const INSTAGRAM_WEB_IMPORT_LIVE = isInstagramWebImportLive();

export function instagramWebImportCtaLabel(_live = INSTAGRAM_WEB_IMPORT_LIVE) {
    return "Check my Instagram";
}

export const ARCHIVE_INTENT_HEROES = {
    casual: {
        title: "How many animals have you already seen?",
        body: "Connect a compatible Instagram account. AnimalDex can scan your past wildlife posts, find animals, and help build a record of what you have already encountered."
    },
    photographer: {
        title: "Turn years of wildlife posts into an AnimalDex.",
        body: "Connect a compatible Instagram account and AnimalDex can scan your archive, find animals in past posts, and help you review them into a lasting record."
    },
    travel: {
        title: "Your past trips may already contain dozens of animals.",
        body: "Safaris, zoos, coasts, and holidays often leave wildlife in old posts. Connect Instagram and AnimalDex can help find those encounters."
    },
    birder: {
        title: "See which birds you’ve already posted.",
        body: "Connect a compatible Instagram account and AnimalDex can scan past bird posts, then help you confirm identity and place before they join your record."
    },
    herper: {
        title: "Build a record from past reptile and amphibian encounters.",
        body: "Connect a compatible Instagram account and AnimalDex can scan older herping posts, then help you review snakes, lizards, frogs, and amphibians you already photographed."
    }
} as const;

export type ArchiveIntent = keyof typeof ARCHIVE_INTENT_HEROES;

export function archiveIntentHero(intent: string | null | undefined) {
    const key = (intent ?? "").trim().toLowerCase();
    if (key in ARCHIVE_INTENT_HEROES) {
        return ARCHIVE_INTENT_HEROES[key as ArchiveIntent];
    }
    return ARCHIVE_INTENT_HEROES.casual;
}

export function uniqueCtaEvents(event: string, extraEvents: string[] = []) {
    return [event, ...extraEvents.filter((name) => name !== event)];
}

export const HIDDEN_REVIEW_STATES = new Set(["approved", "no_animal", "skipped", "failed"]);

export const IMPORT_SETTING_TAGS = ["Wild", "Farm", "Domestic", "Zoo"] as const;
export type ImportSettingTag = (typeof IMPORT_SETTING_TAGS)[number];

export type ReviewState =
    | "ready"
    | "needs_location"
    | "needs_identity"
    | "no_animal"
    | "processing"
    | "skipped"
    | "approved"
    | "failed"
    | string;

export type LocationState = "needs_review" | "confirmed" | "unknown" | string;
export type CatalogState = "ready" | "pending" | "needs_review" | "broad" | "none" | string;

export type AnimalDexIndexMatch = {
    species_profile_id: string;
    animaldex_number?: number | null;
    display_name?: string | null;
    scientific_name?: string | null;
    normalized_identity_key?: string | null;
    identity_kind?: string | null;
    match_level?: string | null;
    is_indexed?: boolean | null;
    confidence?: number | null;
    evidence_source?: string | null;
};

export type ExternalImportScreeningEvidence = {
    screening_outcome?: string | null;
    requires_frames?: boolean | null;
    requires_confirmation?: boolean | null;
    contradictory_animal_signals?: boolean | null;
    several_individuals?: boolean | null;
    multi_animal_detected?: boolean | null;
    /** Model name from thumbnail/frame screening. Production screening still
     *  writes here even when identified_display_name is left null. */
    vision_animal_name?: string | null;
    catalog_state?: CatalogState | null;
    catalog_display_name?: string | null;
    catalog_scientific_name?: string | null;
};

export type ExternalImportMediaRow = {
    source_media_id: string;
    media_type: string;
    sort_order?: number;
    include_on_approval?: boolean;
    thumbnail_reference?: string | null;
    preview_reference?: string | null;
    has_playable_source?: boolean | null;
    is_reel?: boolean | null;
    is_deleted?: boolean | null;
};

export type ExternalImportCandidateRow = {
    candidate_id: string;
    source_post_id: string;
    review_state: ReviewState;
    species_profile_id?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    location_display_label?: string | null;
    location_confirmed_at?: string | null;
    location_state?: LocationState | null;
    catalog_state?: CatalogState | null;
    identified_display_name?: string | null;
    identified_scientific_name?: string | null;
    caption?: string | null;
    permalink?: string | null;
    source_timestamp?: string | null;
    identity_confidence?: number | null;
    proposed_index_match?: AnimalDexIndexMatch | null;
    identity_alternatives?: AnimalDexIndexMatch[] | null;
    identity_evidence?: ExternalImportScreeningEvidence | null;
    media: ExternalImportMediaRow[];
};

export type ExternalImportConnectionRow = {
    connection_id: string;
    provider: string;
    provider_username?: string | null;
    account_type?: string | null;
    status: string;
    last_scanned_at?: string | null;
};

export type ExternalImportOperation = {
    id: string;
    connection_id: string;
    state: string;
    operation_kind: "scan" | "recheck" | string;
    stage: "discovery" | "thumbnail_screening" | "frame_screening" | "review_ready" | string;
    discovery_cursor?: string | null;
    last_error?: string | null;
    billing_status?: string | null;
    quoted_credit_cost?: number | null;
    pricing_explanation?: string | null;
};

export const INSTAGRAM_IMPORT_BILLING_CONTRACT_VERSION = 2;

export type InstagramImportQuote = {
    operation_id: string;
    quote_id: string;
    billing_status: string;
    pricing_version?: string;
    total_posts_seen: number;
    posts_requiring_processing: number;
    posts_remaining_after_batch?: number;
    free_sample?: number;
    credit_cost: number;
    pro_included: boolean;
    pricing_explanation: string;
    expires_at?: string | null;
    accepted?: boolean;
    balance: number;
    sufficient_credits: boolean;
    billing_contract_version?: number;
    zero_cost_reason?: string | null;
    billing_exempt?: boolean;
    billing_exemption_reason?: string | null;
    lifetime_free_remaining?: number;
    paid_units_unbilled?: number;
    paid_units_per_credit?: number;
};

export type InstagramMaterializationQuote = {
    quote_id: string;
    photo_equivalent_count: number;
    video_equivalent_count: number;
    credit_cost: number;
    pro_included: boolean;
    pricing_explanation: string;
    balance: number;
    sufficient_credits: boolean;
    billing_contract_version?: number;
    zero_cost_reason?: string | null;
    accepted?: boolean;
};

export function screeningCostLabel(quote: InstagramImportQuote) {
    if (quote.pro_included) return "Included with Pro";
    if (quote.zero_cost_reason === "lifetime_free") return "On us";
    if (quote.zero_cost_reason === "meter_carry") return "0 Credits";
    if (quote.zero_cost_reason === "empty") return "Nothing new";
    if (quote.credit_cost === 1) return "1 Credit";
    return `${quote.credit_cost} Credits`;
}

export function materializationCostLabel(quote: InstagramMaterializationQuote) {
    if (quote.pro_included) return "Included with Pro";
    if (quote.credit_cost === 1) return "1 Credit";
    return `${quote.credit_cost} Credits`;
}

export type ImportBlocker = "needsIdentity" | "confirmSpecies" | "needsLocation" | "noAnimal" | "skipped";

export type PrimaryReviewAction = "confirmSpecies" | "importPosts" | "disabled";

export function isActiveInstagramConnection(row: ExternalImportConnectionRow | null | undefined) {
    return Boolean(row && row.provider === "instagram" && row.status === "active");
}

export function requiresReauthorizationStatus(row: ExternalImportConnectionRow | null | undefined) {
    return Boolean(row && row.provider === "instagram" && row.status === "reauthorization_required");
}

export function pickInstagramConnection(rows: Array<Partial<ExternalImportConnectionRow> | null | undefined> | null | undefined): ExternalImportConnectionRow | null {
    const list = (rows ?? []).filter((row): row is ExternalImportConnectionRow => Boolean(
        row
        && typeof row.connection_id === "string"
        && row.provider === "instagram"
        && typeof row.status === "string"
    ));
    return list.find((row) => row.status === "active")
        ?? list.find((row) => row.status === "reauthorization_required")
        ?? list[0]
        ?? null;
}

export function connectionStatusLabel(row: ExternalImportConnectionRow | null | undefined, connecting = false) {
    if (connecting) return "Checking…";
    if (requiresReauthorizationStatus(row)) return "Reauthorization required";
    if (isActiveInstagramConnection(row)) {
        const name = row?.provider_username?.trim();
        return name ? `Connected as @${name.replace(/^@/, "")}` : "Connected";
    }
    return "Not connected";
}

export function hasConfirmedLocation(candidate: ExternalImportCandidateRow) {
    return candidate.location_state === "confirmed" && candidate.location_lat != null && candidate.location_lng != null;
}

export function hasResolvedLocation(candidate: ExternalImportCandidateRow) {
    return hasConfirmedLocation(candidate);
}

export function locationIsUnknown(candidate: ExternalImportCandidateRow) {
    return candidate.location_state === "unknown";
}

export function locationSummary(candidate: ExternalImportCandidateRow) {
    const label = candidate.location_display_label?.trim();
    if (label) return label;
    if (hasConfirmedLocation(candidate)) return "Location added";
    if (candidate.location_state === "unknown") return "Location unknown";
    return "No location yet";
}

export function isImportable(candidate: ExternalImportCandidateRow) {
    return candidate.review_state === "ready" && hasResolvedLocation(candidate);
}

export function suggestedMatch(candidate: ExternalImportCandidateRow): AnimalDexIndexMatch | null {
    if (candidate.proposed_index_match) return candidate.proposed_index_match;
    const indexed = (candidate.identity_alternatives ?? []).filter((match) => match.animaldex_number != null);
    return indexed.slice().sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))[0] ?? null;
}

export function catalogStateOf(candidate: ExternalImportCandidateRow): CatalogState {
    if (candidate.catalog_state) return candidate.catalog_state;
    const fromEvidence = candidate.identity_evidence?.catalog_state;
    if (fromEvidence) return fromEvidence;
    return "none";
}

export function titleText(candidate: ExternalImportCandidateRow) {
    const evidence = candidate.identity_evidence;
    return suggestedMatch(candidate)?.display_name?.trim()
        || candidate.identified_display_name?.trim()
        || evidence?.catalog_display_name?.trim()
        || candidate.identified_scientific_name?.trim()
        || evidence?.catalog_scientific_name?.trim()
        || evidence?.vision_animal_name?.trim()
        || candidate.proposed_index_match?.display_name?.trim()
        || "Unknown animal";
}

export function displayName(candidate: ExternalImportCandidateRow) {
    const name = titleText(candidate);
    return name === "Unknown animal" ? "this post" : name;
}

export function catalogStatusLine(candidate: ExternalImportCandidateRow) {
    switch (catalogStateOf(candidate)) {
        case "ready":
            return null;
        case "pending":
            return "Preparing AnimalDex entry";
        case "needs_review":
            return "Needs catalog review";
        case "broad":
            return "Needs a more specific species";
        case "none":
            return candidate.species_profile_id ? null : "Needs species";
        default:
            return null;
    }
}

export function candidateBlocker(candidate: ExternalImportCandidateRow): ImportBlocker | null {
    if (candidate.review_state === "approved" || candidate.review_state === "ready") return null;
    if (candidate.review_state === "no_animal") return "noAnimal";
    if (candidate.review_state === "skipped") return "skipped";
    if (!candidate.species_profile_id) {
        return suggestedMatch(candidate) ? "confirmSpecies" : "needsIdentity";
    }
    if (!hasResolvedLocation(candidate)) return "needsLocation";
    return "needsIdentity";
}

export function blockerTitle(blocker: ImportBlocker) {
    switch (blocker) {
        case "needsIdentity":
            return "Needs species";
        case "confirmSpecies":
            return "Confirm species";
        case "needsLocation":
            return "Needs location";
        case "noAnimal":
            return "No animal";
        case "skipped":
            return "Skipped";
    }
}

export function severalIndividualsNote(candidate: ExternalImportCandidateRow) {
    if (candidate.species_profile_id) return null;
    const evidence = candidate.identity_evidence;
    if (evidence?.contradictory_animal_signals) return "Different animals in shot";
    if (evidence?.several_individuals || evidence?.multi_animal_detected) {
        return suggestedMatch(candidate) ? "Several in shot · confirm" : "Several animals";
    }
    return null;
}

export function speciesChoices(candidate: ExternalImportCandidateRow) {
    const seen = new Set<string>();
    const choices: AnimalDexIndexMatch[] = [];
    const append = (match: AnimalDexIndexMatch | null | undefined) => {
        if (!match?.species_profile_id || seen.has(match.species_profile_id)) return;
        seen.add(match.species_profile_id);
        choices.push(match);
    };
    append(suggestedMatch(candidate));
    for (const alternative of candidate.identity_alternatives ?? []) append(alternative);
    return choices;
}

export function indexedTitle(match: AnimalDexIndexMatch) {
    const name = match.display_name?.trim() || "Unknown animal";
    return match.animaldex_number != null ? `#${match.animaldex_number} ${name}` : name;
}

export function isGroupLevel(match: AnimalDexIndexMatch) {
    return match.match_level === "group_level" || match.identity_kind === "group";
}

export function reviewCandidates(all: ExternalImportCandidateRow[]) {
    return all.filter((candidate) => !HIDDEN_REVIEW_STATES.has(candidate.review_state));
}

export function mediaPreviewUrl(media: ExternalImportMediaRow | undefined) {
    return media?.preview_reference || media?.thumbnail_reference || null;
}

export function isVideoMedia(media: ExternalImportMediaRow | undefined) {
    return media?.media_type === "video";
}

export function selectedRows(candidates: ExternalImportCandidateRow[], selected: Set<string>) {
    return candidates.filter((candidate) => selected.has(candidate.candidate_id));
}

export function canImportSelection(rows: ExternalImportCandidateRow[]) {
    return rows.length > 0 && rows.every(isImportable);
}

export function primaryReviewAction(rows: ExternalImportCandidateRow[]): PrimaryReviewAction {
    if (rows.length === 0) return "disabled";
    if (rows.some((row) => locationIsUnknown(row) || !hasResolvedLocation(row))) return "disabled";
    if (rows.some((row) => !row.species_profile_id)) return "confirmSpecies";
    return canImportSelection(rows) ? "importPosts" : "disabled";
}

export function locationButtonTitle(count: number) {
    return count <= 1 ? "Location" : `Location for ${count}`;
}

export function importButtonTitle(count: number) {
    return count === 0 ? "Import" : `Import ${count}`;
}

export function primaryButtonTitle(action: PrimaryReviewAction, count: number) {
    return action === "confirmSpecies" ? "Confirm species" : importButtonTitle(count);
}

export function reviewHint(action: PrimaryReviewAction, rows: ExternalImportCandidateRow[]) {
    switch (action) {
        case "confirmSpecies":
            return "Location is set. Confirm the species next.";
        case "importPosts":
            return "Ready to add to your Dex.";
        case "disabled":
            if (rows.length === 0) return "Tap posts to select them.";
            if (rows.some((row) => locationIsUnknown(row) || !hasResolvedLocation(row))) {
                return "Set a capture location first.";
            }
            return "These posts aren't ready to import yet.";
    }
}

export function selectionBlocker(rows: ExternalImportCandidateRow[]): {message: string; tone: "warn" | "info"} | null {
    if (rows.length === 0) return {message: "Pick the posts you want to add.", tone: "info"};
    const unknown = rows.filter(locationIsUnknown).length;
    if (unknown > 0) {
        return {
            message: unknown === 1
                ? "A confirmed capture location is required to import this post."
                : `A confirmed capture location is required — ${unknown} selected posts are marked unknown.`,
            tone: "warn"
        };
    }
    const noLocation = rows.filter((row) => !hasResolvedLocation(row)).length;
    if (noLocation > 0) {
        return {
            message: noLocation === 1
                ? "1 post still needs a capture location."
                : `${noLocation} posts still need a capture location.`,
            tone: "warn"
        };
    }
    const noSpecies = rows.filter((row) => !row.species_profile_id).length;
    if (noSpecies > 0) {
        return {
            message: noSpecies === 1
                ? "Confirm the species to import this post."
                : `Confirm the species on ${noSpecies} selected posts.`,
            tone: "info"
        };
    }
    return null;
}

export function summaryHeadline(imported: number, failed: number) {
    if (failed === 0) {
        return imported === 1 ? "1 animal added to your Dex" : `${imported} animals added to your Dex`;
    }
    if (imported === 0) return "Nothing could be imported";
    return `${imported} added · ${failed} couldn't be imported`;
}

export function progressHeadlineForSearch(kind: "new" | "recheck" | "thumbnails" | "frames-new" | "frames-recheck") {
    switch (kind) {
        case "new":
            return "Looking for new posts…";
        case "recheck":
            return "Taking another look…";
        case "thumbnails":
            return "Spotting the animals…";
        case "frames-new":
            return "Taking a closer look at your videos…";
        case "frames-recheck":
            return "Re-checking your videos…";
    }
}

export function humanizeImportError(error: unknown) {
    const raw = (error instanceof Error ? error.message : String(error)).toLowerCase();
    if (raw.includes("missingoperation") || raw.includes("missing_operation")) {
        return "We couldn't start this Instagram check. Try again.";
    }
    if (raw.includes("frameextractioninterrupted") || raw.includes("frame_extraction")) {
        return "We couldn't finish checking one video. Your progress was saved; try again to resume.";
    }
    if (raw.includes("account_suspended")) return "This account is suspended.";
    if (raw.includes("candidate_accuracy_attestation_required")) {
        return "Confirm these details are accurate before importing.";
    }
    if (raw.includes("candidate_location_required")) {
        return "A confirmed capture location is required to import this post.";
    }
    if (raw.includes("source_media_missing") || raw.includes("source_media_deleted")) {
        return "The original post is no longer available on Instagram.";
    }
    if (raw.includes("poster_unavailable") || raw.includes("poster_invalid")) {
        return "We couldn't get a cover image for this video.";
    }
    if (raw.includes("source_too_large")) return "This video is too large to import right now.";
    if (raw.includes("source_truncated") || raw.includes("mp4_") || raw.includes("jpeg_")) {
        return "The download from Instagram was incomplete. Try again.";
    }
    if (raw.includes("materialization_in_progress")) return "This post is already being imported.";
    if (raw.includes("instagram_reauthorization_required") || raw.includes("reauthorization")) {
        return "Instagram needs you to sign in again.";
    }
    if (raw.includes("candidate_not_approvable") || raw.includes("candidate_identity_required")) {
        return "This post still needs a species.";
    }
    if (raw.includes("unauthenticated")) return "Please sign in again.";
    if (raw.includes("invalid_prepared_media_path")) {
        return "We couldn't store this post's video in the right place. Reported for investigation.";
    }
    if (raw.includes("video_poster_required")) return "This video has no usable cover image yet.";
    if (raw.includes("exactly_one_primary")) return "This post's media couldn't be ordered correctly.";
    if (raw.includes("invalid_canonical_identity")) return "This species isn't ready in the AnimalDex index yet.";
    if (raw.includes("instagram_not_connected")) return "Connect Instagram to continue.";
    if (raw.includes("import_stage_busy") || raw.includes("import_cancelled")) {
        return raw.includes("import_cancelled")
            ? "This Instagram check was stopped. Already imported captures are still in your Dex."
            : "Checking your wildlife posts is taking a little longer because your archive is large.";
    }
    if (raw.includes("insufficient_credits")) {
        return "You do not have enough Credits. Your selected posts are still here — buy Credits or Go Pro, then continue.";
    }
    if (raw.includes("entitlement_changed")) {
        return "Your Pro status changed. Refresh this import and try again.";
    }
    if (raw.includes("import_quote_price_changed") || raw.includes("quote_expired") || raw.includes("quote expired")) {
        return "The import cost changed. Your posts are still here. Refresh the quote before continuing.";
    }
    if (raw.includes("already_pro")) {
        return "This account already has AnimalDex Pro. Refresh the quote — Instagram Import should now be included.";
    }
    if (raw.includes("paddle_sandbox_not_configured") || raw.includes("checkout could not start")) {
        return "Web checkout is not available yet. Your Instagram import is still here.";
    }
    if (raw.includes("import_materialization_quote_required") || raw.includes("import_materialization_in_progress")) {
        return "Confirm the import cost before AnimalDex adds these animals.";
    }
    if (raw.includes("import_quote_required") || raw.includes("import_quote_exhausted")) {
        return "Confirm this check before AnimalDex continues.";
    }
    if (
        raw.includes("invalid_thumbnail_screen_scope")
        || raw.includes("invalid_frame_target_scope")
        || raw.includes("invalid_frame_screen_scope")
        || raw.includes("candidate_outside_operation_scope")
    ) {
        return "This Instagram check could not continue from where it stopped. Tap Check for new posts to resume — your reviewed posts are still here.";
    }
    if (raw.includes("session") && raw.includes("expir")) {
        return "Your session expired. Sign in again — your Instagram import progress is saved on this account.";
    }
    if (raw.includes("decoding") || raw.includes("couldn't be read") || raw.includes("json")) {
        return "We couldn't load your Instagram posts. Refresh and try again.";
    }
    return "Something went wrong checking your posts. Your reviewed posts are still here — try again to resume.";
}

export function requiresReauthorization(error: unknown) {
    const raw = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return raw.includes("instagram_reauthorization_required") || raw.includes("reauthorization");
}

export function appDestinationHref(localePrefix: string, path: string, signedIn = false) {
    const destination = path.startsWith("http") ? path : `${localePrefix}${path.startsWith("/") ? path : `/${path}`}`;
    if (signedIn || !path.startsWith("/app")) return destination;
    return `${localePrefix}/account?next=${encodeURIComponent(destination)}`;
}

export function instagramImportAccountHref(localePrefix: string, signedIn = false) {
    return appDestinationHref(localePrefix, INSTAGRAM_IMPORT_PATH, signedIn);
}

export function parseConnectQuery(value: string | null | undefined): "ok" | "failed" | "cancelled" | null {
    if (value === "ok" || value === "failed" || value === "cancelled") return value;
    return null;
}

export function connectQueryMessage(status: "ok" | "failed" | "cancelled" | null) {
    if (status === "failed") return "Instagram was not connected. Try again.";
    if (status === "cancelled") return "Instagram connect was cancelled.";
    return null;
}

export function isAllowedInstagramMediaHost(hostname: string) {
    const host = hostname.toLowerCase();
    return host === "instagram.com"
        || host === "www.instagram.com"
        || host.endsWith(".cdninstagram.com")
        || host.endsWith(".fbcdn.net")
        || host.endsWith(".instagram.com");
}
