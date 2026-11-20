/**
 * The population graphs' words (`ark.graph` in the locale files), in the 45 Ark languages: the order and period
 * switches, a species' graph (its numbers and what happened in the period) and the rows' labels. Drawn by /ark's
 * `ark-population-graph.tsx` and by the apps' embed bars (`ark-scene/live/bars-graph.ts`); both read the words the
 * server hands them (`/api/ark/words`, the page's own) and fall back to this English key by key.
 *
 * Counts sit inside their line ("{count} born"), so a language can put the number where its grammar wants it; the
 * period names are whole phrases ("7 days"), never a number glued to a unit.
 */
export type ArkGraphWords = {
    periods: Record<"24h" | "7d" | "30d" | "all", string>;
    /** The period switch's buttons: as short as the language can say them. */
    periodsShort: Record<"24h" | "7d" | "30d" | "all", string>;
    periodLabel: string;
    sortLabel: string;
    biggest: string;
    thriving: string;
    declining: string;
    noneThriving: string;
    noneDeclining: string;
    back: string;
    now: string;
    change: string;
    peak: string;
    low: string;
    /** What the record says happened in the period: "{count} came aboard" and the four after it. */
    arrived: string;
    born: string;
    revived: string;
    died: string;
    eaten: string;
    /** Kept populations (decision 444): animals born aboard that left the Ark alive. */
    rehomed: string;
    toMarket: string;
    movedZoo: string;
    nothing: string;
    flyTo: string;
    goneNow: string;
    /** A row's sparkline button: "{animal}: population graph". */
    openGraph: string;
    /** The graph's accessible name: "{animal} population, {period}: {start} to {now}". */
    graphLabel: string;
    arkDays: string;
    recordStarts: string;
    /** A point under the finger: "{count} at {time}". */
    pointAt: string;
    /**
     * Where a kind's animals are (owner, 2026-11-20: the chart counts the whole kind, which an axolotl alone in a zoo tank
     * does not say). "{count} in the whole Ark", then the places that have any: wild, homes, farms, town wildlife, the zoo.
     */
    whole: string;
    placeWild: string;
    placeHomes: string;
    placeFarms: string;
    placeTown: string;
    placeZoo: string;
    /** The tapped animal: "This one: alone {where}" and "This one: 1 of {count} {where}", with one of the five `where…` phrases. */
    thisAlone: string;
    thisOneOf: string;
    whereWild: string;
    whereHomes: string;
    whereFarms: string;
    whereTown: string;
    whereZoo: string;
    /** The breeding rule, whatever a place is (a wild island, a zoo enclosure, farms, town wildlife, homes). */
    breedsSamePlace: string;
    /** Under the chart: what makes it rise and fall (a point's own changes show under the finger). */
    riseFall: string;
    /** Under the graph when the period has animals that left alive. */
    riseFallKept: string;
};

/** English, as `en.json` has it (a test holds the two together). */
export const ARK_GRAPH_ENGLISH: ArkGraphWords = {
    periods: {"24h": "24 h", "7d": "7 days", "30d": "30 days", all: "All"},
    periodsShort: {"24h": "24h", "7d": "7d", "30d": "30d", all: "All"},
    periodLabel: "Time period",
    sortLabel: "Order",
    biggest: "Biggest",
    thriving: "Thriving",
    declining: "Declining",
    noneThriving: "No species grew in this period.",
    noneDeclining: "No species fell in this period.",
    back: "All species",
    now: "Now",
    change: "Change",
    peak: "Peak",
    low: "Low",
    arrived: "{count} came aboard",
    born: "{count} born",
    revived: "{count} back from recovery",
    died: "{count} died",
    eaten: "{count} eaten",
    rehomed: "{count} rehomed",
    toMarket: "{count} went to market",
    movedZoo: "{count} moved to another zoo",
    nothing: "No births, arrivals or deaths in this period.",
    flyTo: "Show in the Ark",
    goneNow: "None aboard now",
    openGraph: "{animal}: population graph",
    graphLabel: "{animal} population, {period}: {start} to {now}",
    arkDays: "Ark days {from}–{to}",
    recordStarts: "The record starts {date}",
    pointAt: "{count} at {time}",
    whole: "{count} in the whole Ark",
    placeWild: "{count} wild",
    placeHomes: "{count} in homes",
    placeFarms: "{count} on farms",
    placeTown: "{count} in town wildlife",
    placeZoo: "{count} at the zoo",
    thisAlone: "This one: alone {where}",
    thisOneOf: "This one: 1 of {count} {where}",
    whereWild: "on the wild island",
    whereHomes: "in homes",
    whereFarms: "on farms",
    whereTown: "among town wildlife",
    whereZoo: "in its zoo enclosure",
    breedsSamePlace: "Breeds only with others in the same place.",
    riseFall: "Up: animals brought aboard from photos, or born. Down: animals that died or were eaten.",
    riseFallKept: "Kept animals born aboard can also leave alive: rehomed, sent to market or moved to another zoo."
};

type Loose = Record<string, unknown> | null | undefined;

/** The reader's words with English under every key they lack (a bundle from before this one, a blank string). */
export function arkGraphWords(own: Loose): ArkGraphWords {
    const merge = (english: Record<string, unknown>, mine: Loose): Record<string, unknown> =>
        Object.fromEntries(Object.entries(english).map(([key, value]) => {
            const local = mine?.[key];
            if (value && typeof value === "object") return [key, merge(value as Record<string, unknown>, local && typeof local === "object" ? (local as Record<string, unknown>) : null)];
            return [key, typeof local === "string" && local.trim() ? local : value];
        }));
    return merge(ARK_GRAPH_ENGLISH, own) as ArkGraphWords;
}
