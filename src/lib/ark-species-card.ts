/** What the Ark card shows of a species (`/api/ark/species-card`): its AnimalDex index number and its Animal Power. */
export type ArkSpeciesCard = {number: number | null; power: {name: string; lesson: string | null} | null};

/** "#0035": the index number as the apps' cards show it (four digits at least). */
export function arkIndexNumber(number: number): string {
    return `#${String(number).padStart(4, "0")}`;
}

/** The read's answer, or null when it is not one. */
export function decodeArkSpeciesCard(body: unknown): ArkSpeciesCard | null {
    const card = body && typeof body === "object" ? (body as {card?: unknown}).card : null;
    if (!card || typeof card !== "object") return null;
    const raw = card as {number?: unknown; power?: unknown};
    const number = typeof raw.number === "number" && Number.isInteger(raw.number) && raw.number > 0 ? raw.number : null;
    const power = raw.power && typeof raw.power === "object" ? (raw.power as {name?: unknown; lesson?: unknown}) : null;
    const name = typeof power?.name === "string" && power.name.trim() ? power.name.trim() : null;
    const lesson = typeof power?.lesson === "string" && power.lesson.trim() ? power.lesson.trim() : null;
    if (number === null && !name) return null;
    return {number, power: name ? {name, lesson} : null};
}
