/**
 * AnimalDex 3.2 "Your step" (docs/your-step/SPEC.md): the one step an animal
 * sets its owner, what they tell it when they have done it, and the private
 * record of every step they finished together.
 *
 * The animal sets the step in conversation (its hidden `TRIAL:` line) and
 * decides in conversation when it is done (`DONE:`). The site only shows the
 * step the server holds, never a card the model wrote, and calls the client
 * RPCs (`accept_animal_step_v1`, `drop_animal_step_v1`,
 * `set_animal_step_from_trial_v1`, `attach_animal_step_report_v1`,
 * `animal_step_records_v1`, `animal_open_steps_v1`) as the reader.
 *
 * Pure: the routes, the chat drawer, the Bond tab, Companions and the tests
 * share these decoders. A malformed field is dropped, never the whole read.
 */

export type StepFrequency = "LOW" | "MID" | "HIGH";

/** The step object (`animal_companion_state.open_trial` and the RPCs). */
export type AnimalStep = {
    id: string;
    step: string;
    setAt: string | null;
    /** Null until they said "I'll do it". A step made from a Trial is accepted at once. */
    acceptedAt: string | null;
    /** The Trial it came from (LOW / MID / HIGH); null for a personal step. */
    trialFrequency: StepFrequency | null;
    /** They tapped "I did it" and their report is attached, waiting for the animal. */
    hasReport: boolean;
};

/** One row of `animal_open_steps_v1`: an open step on one of their animals. */
export type OpenStepRow = AnimalStep & {
    speciesProfileId: string;
    /** Their newest visible card of the animal: where its chat opens. */
    captureId: string | null;
    animal: string;
    nickname: string | null;
    /** The species' icon-art slug (added by the route), when known. */
    slug: string | null;
};

/** One done step from `animal_step_records_v1`, newest first. */
export type StepRecord = {
    id: string;
    step: string;
    trialFrequency: StepFrequency | null;
    /** What they told the animal, in their own words. */
    account: string | null;
    /** The animal's own line on what they did (the `DONE:` line). */
    evidence: string | null;
    mediaPaths: string[];
    doneAt: string | null;
    xpAwarded: number;
};

/** A record's photo or video, signed for the reader by the route. */
export type StepRecordMedia = {path: string; url: string; kind: "photo" | "video"};

export type StepRecordWithMedia = StepRecord & {media: StepRecordMedia[]};

/** The report: at least this many characters of their own words (SPEC section 5). */
export const MIN_STEP_REPORT_CHARACTERS = 3;
/** `account` is at most 1500 characters on the server. */
export const MAX_STEP_REPORT_CHARACTERS = 1500;
/** `media_paths` holds at most four paths. */
export const MAX_STEP_MEDIA_PATHS = 4;
/** A video keeps its clip and this many frames for the record's thumbnail (clip + frames ≤ 4). */
export const STEP_VIDEO_FRAMES = 3;
/** The private bucket the record's photos and videos live in. */
export const STEP_MEDIA_BUCKET = "journal-proofs";

/** The bucket's own types (`journal-proofs`, no HEIC): a photo is turned into a JPEG before it goes. */
export const STEP_PHOTO_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
export const STEP_VIDEO_TYPES: readonly string[] = ["video/mp4", "video/quicktime", "video/webm"];
/** What the attach button offers: any photo or video (a photo the bucket cannot take is redrawn as a JPEG). */
export const STEP_MEDIA_ACCEPT = "image/*,video/*";

/**
 * The codes the step RPCs raise (docs/your-step/SERVER.md), and the route's
 * own for an upload: each is said in calm words (`journey.problems`), never
 * as the code.
 */
export const STEP_PROBLEM_CODES = [
    "not_authenticated",
    "step_not_found",
    "step_not_open",
    "species_not_found",
    "invalid_frequency",
    "species_not_unlocked",
    "trial_not_found",
    "account_too_short",
    "too_many_media",
    "media_path_not_owned",
    "media_not_supported",
    "media_too_large",
    "upload_failed"
] as const;

export type StepProblemCode = (typeof STEP_PROBLEM_CODES)[number] | "step_unavailable";

/** The code inside an RPC error's message (the message is the code), or `step_unavailable`. */
export function stepProblemCode(message: unknown): StepProblemCode {
    const text = typeof message === "string" ? message.toLowerCase() : "";
    return STEP_PROBLEM_CODES.find((code) => text.includes(code)) ?? "step_unavailable";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);

function object(value: unknown): Record<string, unknown> | null {
    if (typeof value === "string") {
        try {
            return object(JSON.parse(value));
        } catch {
            return null;
        }
    }
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function list(value: unknown): unknown[] {
    if (typeof value === "string") {
        try {
            return list(JSON.parse(value));
        } catch {
            return [];
        }
    }
    return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

export function stepUuid(value: unknown): string | null {
    const candidate = text(value);
    return candidate && UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

export function stepFrequency(value: unknown): StepFrequency | null {
    const candidate = text(value)?.toUpperCase();
    return candidate === "LOW" || candidate === "MID" || candidate === "HIGH" ? candidate : null;
}

function count(value: unknown): number {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * The step object, from any of the places it arrives: `{id, step, set_at,
 * accepted_at, trial_frequency, has_report}`, or the `done` event's
 * `companion.open_step` (`{id, step, accepted_at, trial_frequency}`). Null
 * without an id and a step: there is nothing to act on.
 */
export function decodeAnimalStep(raw: unknown): AnimalStep | null {
    const row = object(raw);
    const id = stepUuid(row?.id);
    const step = text(row?.step);
    if (!row || !id || !step) return null;
    return {
        id,
        step,
        setAt: text(row.set_at),
        acceptedAt: text(row.accepted_at),
        trialFrequency: stepFrequency(row.trial_frequency),
        hasReport: row.has_report === true
    };
}

/** An RPC that answers `{step}` or the step object itself. */
export function decodeStepResult(raw: unknown): AnimalStep | null {
    const row = object(raw);
    return decodeAnimalStep(row?.step) ?? decodeAnimalStep(row);
}

export function decodeOpenSteps(raw: unknown): OpenStepRow[] {
    return list(raw).flatMap((item) => {
        const row = object(item);
        const step = decodeAnimalStep(row);
        const speciesProfileId = stepUuid(row?.species_profile_id);
        if (!row || !step || !speciesProfileId) return [];
        return [{
            ...step,
            speciesProfileId,
            captureId: stepUuid(row.capture_id),
            animal: text(row.animal) ?? "",
            nickname: text(row.nickname),
            slug: text(row.slug)
        }];
    });
}

export function decodeStepRecords(raw: unknown): StepRecord[] {
    return list(raw).flatMap((item) => {
        const row = object(item);
        const id = stepUuid(row?.id);
        const step = text(row?.step);
        if (!row || !id || !step) return [];
        return [{
            id,
            step,
            trialFrequency: stepFrequency(row.trial_frequency),
            account: text(row.account),
            evidence: text(row.evidence),
            mediaPaths: list(row.media_paths).flatMap((path) => (text(path) ? [text(path) as string] : [])).slice(0, MAX_STEP_MEDIA_PATHS),
            doneAt: text(row.done_at),
            xpAwarded: count(row.xp_awarded)
        }];
    });
}

// MARK: - The step card

/** Where a step stands: offered (not yet accepted), accepted, or reported back and waiting for the animal. */
export type StepCardState = "offered" | "accepted" | "reported";

export function stepCardState(step: Pick<AnimalStep, "acceptedAt" | "hasReport">): StepCardState {
    if (step.hasReport) return "reported";
    return step.acceptedAt ? "accepted" : "offered";
}

/** The step as it reads once accepted: the moment and the report change it in place. */
export function acceptingStep(step: AnimalStep, now = new Date()): AnimalStep {
    return step.acceptedAt ? step : {...step, acceptedAt: now.toISOString()};
}

export function reportingStep(step: AnimalStep, now = new Date()): AnimalStep {
    return {...acceptingStep(step, now), hasReport: true};
}

/** The report's text as it is sent: whitespace folded, at most 1500 characters. */
export function cleanStepReport(raw: string): string {
    return raw.replace(/\s+/g, " ").trim().slice(0, MAX_STEP_REPORT_CHARACTERS);
}

export function stepReportReady(raw: string): boolean {
    return cleanStepReport(raw).length >= MIN_STEP_REPORT_CHARACTERS;
}

// MARK: - The record's media

/**
 * A file's extension as stored: one of the bucket's (`jpg png webp mp4 mov
 * webm`). An image of any other type has been turned into a JPEG first.
 */
export function stepMediaExtension(file: {type?: string | null; name?: string | null}): "jpg" | "png" | "webp" | "mp4" | "mov" | "webm" {
    const type = (file.type ?? "").toLowerCase();
    const name = (file.name ?? "").toLowerCase();
    if (type === "image/png" || name.endsWith(".png")) return "png";
    if (type === "image/webp" || name.endsWith(".webp")) return "webp";
    if (type.startsWith("image/")) return "jpg";
    if (type === "video/quicktime" || name.endsWith(".mov")) return "mov";
    if (type === "video/webm" || name.endsWith(".webm")) return "webm";
    if (type.startsWith("video/")) return "mp4";
    return "jpg";
}

export function isStepVideoFile(file: {type?: string | null; name?: string | null}): boolean {
    const extension = stepMediaExtension(file);
    return extension === "mp4" || extension === "mov" || extension === "webm";
}

/** A file the bucket takes as it is: a JPEG, PNG or WebP photo, or an MP4, MOV or WebM video. */
export function isAcceptedStepMedia(file: {type?: string | null}): boolean {
    const type = (file.type ?? "").toLowerCase();
    return STEP_PHOTO_TYPES.includes(type) || STEP_VIDEO_TYPES.includes(type);
}

/** `<uid>/steps/<species>/<uuid>.<ext>`: the caller's own folder, which the storage rules and the attach RPC check. */
export function stepMediaPath(userId: string, speciesProfileId: string, id: string, extension: string): string {
    return `${userId.toLowerCase()}/steps/${speciesProfileId.toLowerCase()}/${id.toLowerCase()}.${extension.replace(/^\./, "").toLowerCase()}`;
}

/** A path the reader may sign or attach: inside their own steps folder, nothing climbing out of it. */
export function isOwnStepMediaPath(userId: string, path: string): boolean {
    const prefix = `${userId.toLowerCase()}/steps/`;
    return path.toLowerCase().startsWith(prefix) && !path.includes("..") && !path.includes("//");
}

export function stepMediaKind(path: string): "photo" | "video" {
    const extension = path.split(".").pop()?.toLowerCase() ?? "";
    return VIDEO_EXTENSIONS.has(extension) ? "video" : "photo";
}

/** The record's thumbnail: a photo, or a video's first frame; null when it has none. */
export function stepRecordThumbnail(media: StepRecordMedia[]): StepRecordMedia | null {
    return media.find((item) => item.kind === "photo") ?? null;
}

/** `step_report` on a chat request: the step they reported back on. Null when absent or malformed. */
export function resolveStepReport(raw: unknown): {stepId: string} | null {
    const row = object(raw);
    const stepId = stepUuid(row?.step_id);
    return stepId ? {stepId} : null;
}
