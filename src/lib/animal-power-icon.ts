/**
 * Animal Power icons: one hand-authored line icon per Power, stored in
 * `public.animal_power_icons` (one row per `species_profile_id`, readable by
 * anon). The DB constrains the SVG to a tiny subset:
 *
 *     <svg …24×24 root, stroke = currentColor…>
 *         <path d … /> | <circle cx cy r … />   (fill / stroke: none | currentColor)
 *     </svg>
 *
 * The site never injects that string as HTML. It is parsed here into plain
 * element descriptors, which `AnimalPowerIcon` turns into React elements.
 * Anything outside the subset is dropped; an icon with nothing left is no icon.
 */

export const ANIMAL_POWER_ICON_TABLE = "animal_power_icons";

/** Batch size for one `species_profile_id=in.(…)` read. Keeps URLs short. */
export const ANIMAL_POWER_ICON_BATCH_LIMIT = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAnimalPowerIconId(value: string | null | undefined): value is string {
    return Boolean(value && UUID_PATTERN.test(value));
}

type Paint = "none" | "currentColor";

export type AnimalPowerIconShape =
    | {kind: "path"; d: string; fill?: Paint; stroke?: Paint}
    | {kind: "circle"; cx: number; cy: number; r: number; fill?: Paint; stroke?: Paint};

const ROOT_PATTERN = /^\s*<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/;
const ELEMENT_PATTERN = /<(path|circle)\b([^<>]*?)\/>/g;
const ATTRIBUTE_PATTERN = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
// Path data is commands and numbers only — no url(), no entities, no quotes.
const PATH_DATA_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-eE]+$/;
const NUMBER_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)$/;

function readAttributes(source: string) {
    const attributes: Record<string, string> = {};
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ATTRIBUTE_PATTERN.exec(source))) {
        attributes[match[1]] = match[2];
    }
    return attributes;
}

function readPaint(value: string | undefined): Paint | undefined | null {
    if (value == null) return undefined;
    return value === "none" || value === "currentColor" ? value : null;
}

function readNumber(value: string | undefined) {
    if (!value || !NUMBER_PATTERN.test(value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

/**
 * The drawable shapes in a stored icon, or null when there are none. Unknown
 * elements and shapes with an attribute outside the subset are skipped.
 */
export function parseAnimalPowerIcon(svg: string | null | undefined): AnimalPowerIconShape[] | null {
    if (!svg || svg.length > 8_000) return null;
    const root = ROOT_PATTERN.exec(svg);
    if (!root) return null;

    const shapes: AnimalPowerIconShape[] = [];
    ELEMENT_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ELEMENT_PATTERN.exec(root[1]))) {
        const attributes = readAttributes(match[2]);
        const fill = readPaint(attributes.fill);
        const stroke = readPaint(attributes.stroke);
        if (fill === null || stroke === null) continue;

        if (match[1] === "path") {
            const d = attributes.d?.trim();
            if (!d || !PATH_DATA_PATTERN.test(d)) continue;
            shapes.push({kind: "path", d, fill, stroke});
        } else {
            const cx = readNumber(attributes.cx);
            const cy = readNumber(attributes.cy);
            const r = readNumber(attributes.r);
            if (cx == null || cy == null || r == null || r <= 0) continue;
            shapes.push({kind: "circle", cx, cy, r, fill, stroke});
        }
    }

    return shapes.length ? shapes : null;
}

/** `{species_profile_id: svg}` from PostgREST rows; rows without an svg are skipped. */
export function decodeAnimalPowerIconRows(rows: unknown): Record<string, string> {
    const icons: Record<string, string> = {};
    if (!Array.isArray(rows)) return icons;
    for (const row of rows) {
        const id = typeof row?.species_profile_id === "string" ? row.species_profile_id.toLowerCase() : null;
        const svg = typeof row?.svg === "string" ? row.svg : null;
        if (id && svg) icons[id] = svg;
    }
    return icons;
}
