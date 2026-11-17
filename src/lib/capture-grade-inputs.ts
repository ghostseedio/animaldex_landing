import {computeCaptureGradeBreakdown, type CaptureGradeBreakdown, type CaptureGradeSource} from "@/lib/capture-grade";

/**
 * The editable inputs behind a capture's grade, for the admin inspector.
 *
 * The grade itself is the server's stored `capture_grade`; this module names the
 * analysis inputs the grade is built from, which factor each one moves, and
 * where it is stored, so the admin panel can show a what-if preview. That
 * preview runs the legacy local arithmetic and is never saved: grades are
 * owned by the server and are not written from the website.
 */

/** The analysis_results columns a grade is built from. */
export type CaptureGradeRow = {
    capture_id?: string;
    animal_name?: string | null;
    scientific_name?: string | null;
    breed_guess?: string | null;
    human_context?: string | null;
    zoo_or_wild?: string | null;
    confidence?: number | null;
    breed_confidence?: number | null;
    signals?: Record<string, unknown> | null;
    premium_details?: Record<string, unknown> | null;
    observed_market_modifiers?: Record<string, unknown> | null;
    raw_json?: Record<string, unknown> | null;
    capture_grade?: number | null;
};

export type CaptureGradeInputValue = string | number | boolean | null;
export type CaptureGradeInputs = Record<string, CaptureGradeInputValue>;

type InputKind =
    | {kind: "number"; min: number; max: number; step: number}
    | {kind: "select"; options: Array<{value: string; label: string}>}
    | {kind: "boolean"};

export type CaptureGradeInputField = {
    id: string;
    label: string;
    /** The grade factor this input moves, matching CaptureGradeFactor.id. */
    factor: string;
    hint: string;
} & InputKind;

const SETTING_OPTIONS = ["wild", "zoo", "domestic", "farm", "unknown"]
    .map((value) => ({value, label: value[0].toUpperCase() + value.slice(1)}));

const AESTHETIC_OPTIONS = ["", "striking", "photogenic", "neutral", "plain", "cluttered"]
    .map((value) => ({value, label: value ? value[0].toUpperCase() + value.slice(1) : "Not set"}));

export const CAPTURE_GRADE_INPUTS: CaptureGradeInputField[] = [
    {
        id: "confidence",
        label: "ID confidence",
        factor: "accuracy",
        kind: "number",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Drives the heaviest factor, and a value under 0.4 also trips the uncertainty penalty."
    },
    {
        id: "authenticity_status",
        label: "Authenticity",
        factor: "accuracy",
        kind: "select",
        options: [
            {value: "", label: "No concern"},
            {value: "likely_non_live_source", label: "Likely photo of a screen"}
        ],
        hint: "A non-live source costs a flat 0.22 off the weighted score."
    },
    {
        id: "image_quality",
        label: "Image quality",
        factor: "clarity",
        kind: "select",
        options: [
            {value: "clear", label: "Clear"},
            {value: "usable", label: "Usable"},
            {value: "weak", label: "Weak"}
        ],
        hint: "Clarity and focus, and it also feeds the estimated shot quality."
    },
    {
        id: "setting_tag",
        label: "Setting",
        factor: "habitat",
        kind: "select",
        options: SETTING_OPTIONS,
        hint: "Wild scores highest; zoo, domestic and farm each score lower by design."
    },
    {
        id: "wild_habitat_likely",
        label: "Wild habitat evidence",
        factor: "habitat",
        kind: "boolean",
        hint: "Lifts a wild setting to its full habitat score."
    },
    {
        id: "shot_aesthetic",
        label: "Shot aesthetic",
        factor: "aesthetic",
        kind: "select",
        options: AESTHETIC_OPTIONS,
        hint: "Set it when the model misread an obviously strong or cluttered photo."
    },
    {
        id: "head_visible",
        label: "Head visible",
        factor: "body_visibility",
        kind: "boolean",
        hint: "Body detail is scored from which features are actually visible."
    },
    {id: "eyes_visible", label: "Eyes visible", factor: "body_visibility", kind: "boolean", hint: "Optional feature; counts when true."},
    {id: "limbs_visible", label: "Limbs visible", factor: "body_visibility", kind: "boolean", hint: "Skipped for anatomies without limbs."},
    {id: "tail_visible", label: "Tail visible", factor: "body_visibility", kind: "boolean", hint: "Optional feature; counts when true."},
    {id: "full_body_visible", label: "Full body visible", factor: "body_visibility", kind: "boolean", hint: "The largest single contributor to body detail."},
    {
        id: "visible_condition_delta_pct",
        label: "Condition delta %",
        factor: "condition",
        kind: "number",
        min: -60,
        max: 60,
        step: 1,
        hint: "Negative values are what usually drag an otherwise good capture down."
    },
    {
        id: "composition_delta_pct",
        label: "Composition delta %",
        factor: "aesthetic",
        kind: "number",
        min: -60,
        max: 60,
        step: 1,
        hint: "Feeds shot quality alongside the aesthetic tier."
    },
    {
        id: "visual_appeal_delta_pct",
        label: "Visual appeal delta %",
        factor: "aesthetic",
        kind: "number",
        min: -60,
        max: 60,
        step: 1,
        hint: "Feeds shot quality alongside the aesthetic tier."
    }
];

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? {...value as Record<string, unknown>} : {};
}

function asBoolean(value: unknown) {
    return value === true;
}

/** Mirrors the grade engine's own parsing, which matches on a lowercased substring. */
function normaliseSetting(value: unknown) {
    const lower = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!lower) return "unknown";
    for (const tag of ["zoo", "farm", "domestic", "wild"]) {
        if (lower.includes(tag)) return tag;
    }
    return "unknown";
}

function asNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/** Assembles the grade source from the analysis columns; endorsements do not lift the grade. */
export function buildCaptureGradeSource(row: CaptureGradeRow): CaptureGradeSource {
    return {
        capture_grade: row.capture_grade ?? null,
        raw_json: row.raw_json ?? null,
        animal_name: row.animal_name ?? null,
        scientific_name: row.scientific_name ?? null,
        breed_guess: row.breed_guess ?? null,
        human_context: row.human_context ?? null,
        zoo_or_wild: row.zoo_or_wild ?? null,
        confidence: row.confidence ?? null,
        breed_confidence: row.breed_confidence ?? null,
        signals: (row.signals ?? null) as CaptureGradeSource["signals"],
        premium_details: (row.premium_details ?? null) as CaptureGradeSource["premium_details"],
        observed_market_modifiers: (row.observed_market_modifiers ?? null) as CaptureGradeSource["observed_market_modifiers"]
    };
}

/** The current value of every editable input, for populating the form. */
export function readCaptureGradeInputs(row: CaptureGradeRow): CaptureGradeInputs {
    const signals = asRecord(row.signals);
    const features = asRecord(signals.visible_body_features);
    const market = asRecord(row.observed_market_modifiers);
    const model = asRecord(asRecord(row.raw_json).model);

    return {
        confidence: row.confidence ?? null,
        authenticity_status: typeof model.authenticity_status === "string" ? model.authenticity_status : "",
        image_quality: typeof model.image_quality === "string" ? model.image_quality : "",
        // Stored capitalised ("Wild", "Zoo"), read case-insensitively everywhere.
        setting_tag: normaliseSetting(row.zoo_or_wild ?? model.zoo_or_wild ?? model.setting_tag),
        wild_habitat_likely: asBoolean(signals.wild_habitat_likely),
        shot_aesthetic: typeof signals.shot_aesthetic === "string" ? signals.shot_aesthetic : "",
        head_visible: asBoolean(features.head_visible),
        eyes_visible: asBoolean(features.eyes_visible),
        limbs_visible: asBoolean(features.limbs_visible),
        tail_visible: asBoolean(features.tail_visible),
        full_body_visible: asBoolean(features.full_body_visible),
        visible_condition_delta_pct: asNumber(market.visible_condition_delta_pct),
        composition_delta_pct: asNumber(market.composition_delta_pct),
        visual_appeal_delta_pct: asNumber(market.visual_appeal_delta_pct)
    };
}

/**
 * Folds edited inputs back into the row's own columns. Returns a new row, so the
 * client can grade a candidate without touching what is on screen and the server
 * can persist the same shape it graded.
 */
export function applyCaptureGradeInputs(row: CaptureGradeRow, inputs: CaptureGradeInputs): CaptureGradeRow {
    const signals = asRecord(row.signals);
    const features = asRecord(signals.visible_body_features);
    const market = asRecord(row.observed_market_modifiers);
    const rawJson = asRecord(row.raw_json);
    const model = asRecord(rawJson.model);
    const confidence = inputs.confidence == null || inputs.confidence === ""
        ? null
        : Math.min(1, Math.max(0, asNumber(inputs.confidence)));
    const setting = normaliseSetting(inputs.setting_tag);
    // The column stores a capitalised label. Rewriting it only because an
    // operator opened the panel would churn every row's casing, so the original
    // string is kept whenever the setting itself has not changed.
    const settingChanged = setting !== normaliseSetting(row.zoo_or_wild);
    const settingValue = settingChanged
        ? setting[0].toUpperCase() + setting.slice(1)
        : row.zoo_or_wild ?? setting;
    const authenticity = String(inputs.authenticity_status ?? "");
    const aesthetic = String(inputs.shot_aesthetic ?? "");

    const nextSignals = {
        ...signals,
        wild_habitat_likely: asBoolean(inputs.wild_habitat_likely),
        // Setting flags are what the habitat factor reads when the tag alone is
        // ambiguous, so they are kept consistent with the chosen setting.
        zoo_context_likely: setting === "zoo",
        domestic_context_likely: setting === "domestic",
        farm_context_likely: setting === "farm",
        visible_body_features: {
            ...features,
            head_visible: asBoolean(inputs.head_visible),
            eyes_visible: asBoolean(inputs.eyes_visible),
            limbs_visible: asBoolean(inputs.limbs_visible),
            tail_visible: asBoolean(inputs.tail_visible),
            full_body_visible: asBoolean(inputs.full_body_visible)
        },
        ...(aesthetic ? {shot_aesthetic: aesthetic} : {shot_aesthetic: null})
    };

    return {
        ...row,
        confidence,
        zoo_or_wild: settingValue,
        signals: nextSignals,
        observed_market_modifiers: {
            ...market,
            visible_condition_delta_pct: asNumber(inputs.visible_condition_delta_pct),
            composition_delta_pct: asNumber(inputs.composition_delta_pct),
            visual_appeal_delta_pct: asNumber(inputs.visual_appeal_delta_pct)
        },
        raw_json: {
            ...rawJson,
            model: {
                ...model,
                confidence,
                zoo_or_wild: settingValue,
                setting_tag: settingValue,
                image_quality: String(inputs.image_quality ?? ""),
                authenticity_status: authenticity
            }
        }
    };
}

/**
 * What-if preview for the admin inspector: the legacy local arithmetic over the
 * inputs as edited, with no stored grade so it is not pinned to the saved one.
 * Preview only, never shown to users and never written.
 */
export function previewCaptureRowGrade(row: CaptureGradeRow): CaptureGradeBreakdown | null {
    return computeCaptureGradeBreakdown({...buildCaptureGradeSource(row), capture_grade: null});
}
