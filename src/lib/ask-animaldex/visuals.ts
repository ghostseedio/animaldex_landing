/**
 * The non-prose mediums an answer can contain, and the lenient decoding that
 * turns a model's freehand JSON into one.
 *
 * Ported from `AssistantVisual` / `AssistantVisualJSON` on iOS. Every
 * normalisation rule here exists because it is a plausible way to write the
 * same thing, not because a model was seen doing it once: being liberal on
 * input is what decides whether a chart appears, or whether the sentence that
 * introduced it points at nothing.
 */

export type AskFlowStep = {
    label: string;
    detail: string | null;
};

export type AskFlowSpec = {
    title: string | null;
    steps: AskFlowStep[];
    /** True when the last step feeds the first — a self-reinforcing cycle. */
    loops: boolean;
};

export type AskScaleSpec = {
    title: string | null;
    low: string;
    balanced: string;
    high: string;
    /** Which zone the answer is about, when it is about one of them. */
    marker: "low" | "balanced" | "high" | null;
};

export type AskChartPoint = {x: number; y: number};

export type AskChartSeries = {
    label: string | null;
    points: AskChartPoint[];
};

export type AskChartSpec = {
    type: "line" | "area" | "bar" | "threshold";
    title: string | null;
    xAxisLabel: string | null;
    yAxisLabel: string | null;
    series: AskChartSeries[];
    annotations: string[];
};

export type AskPhotoSpec = {
    callout: string;
};

/**
 * The animal's kind doing it: one of its own Trial loops, by frequency
 * (`{"frequency":"MID","caption":"…"}`). Which animal is the chat's, never
 * the model's (`AnimalChatBlockContext`).
 */
export type AskLoopSpec = {
    frequency: "LOW" | "MID" | "HIGH";
    caption: string | null;
};

/**
 * A picture AnimalDex already has: the chat animal's Power icon
 * (`{"of":"power"}`), or the art of a species it compares itself with
 * (`{"of":"species","name":"Red Fox"}`). Nothing is generated.
 */
export type AskImageSpec =
    | {of: "power"; caption: string | null}
    | {of: "species"; name: string; caption: string | null};

export type AskVisual =
    | {kind: "flow"; spec: AskFlowSpec}
    | {kind: "scale"; spec: AskScaleSpec}
    | {kind: "chart"; spec: AskChartSpec}
    | {kind: "photo"; spec: AskPhotoSpec}
    | {kind: "loop"; spec: AskLoopSpec}
    | {kind: "image"; spec: AskImageSpec};

export function isAskVisualLanguage(language: string): boolean {
    return language.startsWith("animaldex-");
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max = 240): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function num(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

/** Moves a value from one of several plausible keys onto the canonical one. */
function renamed(input: Json, mapping: Record<string, string>): Json {
    const object: Json = {...input};
    for (const [from, to] of Object.entries(mapping)) {
        if (object[to] === undefined && object[from] !== undefined) {
            object[to] = object[from];
            delete object[from];
        }
    }
    return object;
}

function decodeFlow(input: Json): AskFlowSpec | null {
    const object = renamed(input, {
        nodes: "steps",
        stages: "steps",
        isLoop: "loops",
        cycle: "loops"
    });

    const rawSteps = Array.isArray(object.steps) ? object.steps : [];
    const steps = rawSteps.flatMap((step): AskFlowStep[] => {
        if (typeof step === "string") {
            const label = text(step, 120);
            return label ? [{label, detail: null}] : [];
        }
        if (!isRecord(step)) return [];
        const label = text(step.label, 120)
            ?? text(step.title, 120)
            ?? text(step.name, 120)
            ?? text(step.text, 120);
        if (!label) return [];
        return [{label, detail: text(step.detail, 160) ?? text(step.description, 160)}];
    }).slice(0, 6);

    if (steps.length < 2) return null;
    return {
        title: text(object.title, 120),
        steps,
        loops: object.loops === true
    };
}

function decodeScale(input: Json): AskScaleSpec | null {
    const object = renamed(input, {
        deficient: "low",
        too_little: "low",
        tooLittle: "low",
        mid: "balanced",
        middle: "balanced",
        excess: "high",
        too_much: "high",
        tooMuch: "high"
    });

    const low = text(object.low, 160);
    const balanced = text(object.balanced, 160);
    const high = text(object.high, 160);
    if (!low || !balanced || !high) return null;

    const rawMarker = typeof object.marker === "string" ? object.marker.toLowerCase().trim() : "";
    const marker = rawMarker === "low"
        ? "low" as const
        : rawMarker === "high"
            ? "high" as const
            : ["balanced", "mid", "middle"].includes(rawMarker)
                ? "balanced" as const
                : null;

    return {title: text(object.title, 120), low, balanced, high, marker};
}

function decodeChartSeries(entry: unknown): AskChartSeries | null {
    if (!isRecord(entry)) return null;
    const series = renamed(entry, {data: "points", values: "points"});
    const rawPoints = Array.isArray(series.points) ? series.points : [];

    const points = rawPoints.flatMap((point): Array<{x: number | null; y: number}> => {
        // [x, y] pairs are a common shorthand.
        if (Array.isArray(point) && point.length >= 2) {
            const x = num(point[0]);
            const y = num(point[1]);
            return y === null ? [] : [{x, y}];
        }
        const scalar = num(point);
        if (scalar !== null) return [{x: null, y: scalar}];
        if (!isRecord(point)) return [];
        const y = num(point.y) ?? num(point.value) ?? num(point.intensity) ?? num(point.amount);
        if (y === null) return [];
        return [{x: num(point.x), y}];
    });

    if (points.length < 2) return null;

    // A series indexes its own points when only y values were given.
    const resolved = points.map((point, index) => ({
        x: point.x ?? index,
        y: point.y
    }));

    return {
        label: text(series.label, 80) ?? text(series.name, 80),
        points: resolved.slice(0, 40)
    };
}

const CHART_TYPES = new Set(["line", "area", "bar", "threshold"]);

function decodeChart(input: Json): AskChartSpec | null {
    const object = renamed(input, {
        xAxis: "x_axis",
        yAxis: "y_axis",
        accessibilitySummary: "accessibility_summary",
        textSummary: "text_summary"
    });

    const axisLabel = (value: unknown): string | null => {
        if (typeof value === "string") return text(value, 60);
        if (isRecord(value)) return text(value.label, 60) ?? text(value.title, 60);
        return null;
    };

    // "annotations": ["Pounce event"] is at least as natural to write as an
    // array of objects, and a strict decoder rejects it outright.
    const rawAnnotations = Array.isArray(object.annotations) ? object.annotations : [];
    const annotations = rawAnnotations.flatMap((entry): string[] => {
        if (typeof entry === "string") {
            const label = text(entry, 80);
            return label ? [label] : [];
        }
        if (!isRecord(entry)) return [];
        const label = text(entry.label, 80) ?? text(entry.text, 80);
        return label ? [label] : [];
    }).slice(0, 4);

    const rawSeries = Array.isArray(object.series)
        ? object.series
        : isRecord(object.series)
            ? [object.series]
            : [];
    const series = rawSeries
        .map(decodeChartSeries)
        .filter((entry): entry is AskChartSeries => entry !== null)
        .slice(0, 3);
    if (series.length === 0) return null;

    const rawType = typeof object.type === "string" ? object.type.toLowerCase().trim() : "";
    const type = (CHART_TYPES.has(rawType) ? rawType : "line") as AskChartSpec["type"];

    return {
        type,
        title: text(object.title, 120),
        xAxisLabel: axisLabel(object.x_axis),
        yAxisLabel: axisLabel(object.y_axis),
        series,
        annotations
    };
}

function decodePhoto(input: Json): AskPhotoSpec | null {
    const object = renamed(input, {caption: "callout", text: "callout", label: "callout"});
    const callout = text(object.callout, 200);
    return callout ? {callout} : null;
}

const LOOP_FREQUENCIES = new Set(["LOW", "MID", "HIGH"]);

/** A loop names one of the animal's three Trials; anything else is no loop. */
function decodeLoop(input: Json): AskLoopSpec | null {
    const object = renamed(input, {freq: "frequency", trial: "frequency", level: "frequency", text: "caption", label: "caption"});
    const frequency = typeof object.frequency === "string" ? object.frequency.trim().toUpperCase() : "";
    if (!LOOP_FREQUENCIES.has(frequency)) return null;
    return {frequency: frequency as AskLoopSpec["frequency"], caption: text(object.caption, 200)};
}

/**
 * Its Power's icon, or another species' art by its common name; nothing else
 * is ours to show. The spellings iOS reads (`power_icon`, `icon`, `animal`)
 * are read here too.
 */
function decodeImage(input: Json): AskImageSpec | null {
    const object = renamed(input, {kind: "of", type: "of", show: "of", animal: "name", species_name: "name", text: "caption", label: "caption"});
    const of = typeof object.of === "string" ? object.of.trim().toLowerCase() : "";
    const caption = text(object.caption, 200);
    if (of === "power" || of === "power_icon" || of === "icon") return {of: "power", caption};
    if (of === "species" || of === "animal") {
        const name = text(object.name, 80);
        return name ? {of: "species", name, caption} : null;
    }
    return null;
}

/**
 * Decodes one fenced visual block. A block that cannot be decoded returns null
 * and is dropped by the parser: a reader should never be handed raw JSON
 * because the model mis-typed a field.
 */
export function decodeAskVisual(language: string, payload: string): AskVisual | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(payload);
    } catch {
        return null;
    }
    if (!isRecord(parsed)) return null;

    switch (language) {
        case "animaldex-flow": {
            const spec = decodeFlow(parsed);
            return spec ? {kind: "flow", spec} : null;
        }
        case "animaldex-scale": {
            const spec = decodeScale(parsed);
            return spec ? {kind: "scale", spec} : null;
        }
        case "animaldex-chart": {
            const spec = decodeChart(parsed);
            return spec ? {kind: "chart", spec} : null;
        }
        case "animaldex-photo": {
            const spec = decodePhoto(parsed);
            return spec ? {kind: "photo", spec} : null;
        }
        case "animaldex-loop": {
            const spec = decodeLoop(parsed);
            return spec ? {kind: "loop", spec} : null;
        }
        case "animaldex-image": {
            const spec = decodeImage(parsed);
            return spec ? {kind: "image", spec} : null;
        }
        default:
            return null;
    }
}

/** Stable key for a visual, so React does not remount it on every stream tick. */
export function askVisualIdentity(visual: AskVisual): string {
    switch (visual.kind) {
        case "flow":
            return `flow-${visual.spec.steps.map((step) => step.label).join(">")}`;
        case "scale":
            return `scale-${visual.spec.low}-${visual.spec.balanced}-${visual.spec.high}`;
        case "chart":
            return `chart-${visual.spec.title ?? visual.spec.series.map((series) => series.label).join("|")}`;
        case "photo":
            return `photo-${visual.spec.callout}`;
        case "loop":
            return `loop-${visual.spec.frequency}`;
        case "image":
            return visual.spec.of === "species" ? `image-species-${visual.spec.name}` : "image-power";
    }
}

/** What a screen reader, and a copied answer, say in place of the drawing. */
export function askVisualSpokenSummary(visual: AskVisual): string {
    switch (visual.kind) {
        case "flow": {
            const steps = visual.spec.steps.map((step) => step.label).join(", then ");
            const loop = visual.spec.loops ? ", and back to the start" : "";
            return [visual.spec.title, `${steps}${loop}`].filter(Boolean).join(": ");
        }
        case "scale":
            return [
                visual.spec.title,
                `Too little: ${visual.spec.low}. Balanced: ${visual.spec.balanced}. Too much: ${visual.spec.high}`
            ].filter(Boolean).join(": ");
        case "chart": {
            const axes = [visual.spec.yAxisLabel, visual.spec.xAxisLabel].filter(Boolean).join(" against ");
            return [visual.spec.title ?? "Chart", axes || null].filter(Boolean).join(": ");
        }
        case "photo":
            return `Your photo of this animal: ${visual.spec.callout}`;
        case "loop":
            return visual.spec.caption ?? "Its kind doing it";
        case "image":
            return visual.spec.of === "species"
                ? [visual.spec.name, visual.spec.caption].filter(Boolean).join(": ")
                : visual.spec.caption ?? "";
    }
}

/**
 * What this surface can draw, sent with every request so the model is only
 * offered mediums the reader will actually see rendered.
 *
 * The photo medium is only offered when the reader's own photo is on screen, so
 * the model can never point at a picture that is not there.
 */
export function askSupportedVisuals(hasReaderPhoto: boolean): Array<"flow" | "scale" | "chart" | "photo"> {
    return hasReaderPhoto ? ["flow", "scale", "chart", "photo"] : ["flow", "scale", "chart"];
}

/** The two drawings that need the chat's animal (`AnimalChatBlockContext`). */
export const ASK_CHAT_BLOCK_VISUALS = ["loop", "image"] as const;
export type AskChatBlockVisual = (typeof ASK_CHAT_BLOCK_VISUALS)[number];

/**
 * The chat's own drawings a request says it draws (`supported_visuals`), in
 * order: a client that sends neither "loop" nor "image" is described neither.
 */
export function askChatBlockVisuals(advertised: readonly unknown[]): AskChatBlockVisual[] {
    return ASK_CHAT_BLOCK_VISUALS.filter((name) => advertised.includes(name));
}

/**
 * The art slug for a species the model names in an image ("Red Fox" →
 * "red-fox", "Harris's Hawk" → "harriss-hawk", as the artwork files are
 * named); the artwork route finds the file or a close relative's from it.
 */
export function askSpeciesArtSlug(name: string): string | null {
    const slug = name
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || null;
}

/**
 * Whether a loaded picture from the artwork route is a species' art. The
 * route answers a species without any with its stand-in
 * (`SPECIES_NO_IMAGE_SRC`, drawn 1200 × 900), and an image block draws
 * nothing rather than that.
 */
export function askIsSpeciesArt(width: number, height: number): boolean {
    return width > 0 && height > 0 && !(width === 1200 && height === 900);
}
