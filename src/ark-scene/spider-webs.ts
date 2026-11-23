/**
 * Spider webs (lane ARK-WEBS, the owner 2026-11-21: "i'm not seeing any spider webs"). Which spiders aboard spin a
 * capture web, what kind, where it hangs, when it is spun again, and where its spider is on it. Pure: a function of the
 * species, the animal's id and the island's hour, so every viewer sees the same web at the same stage. Acting only:
 * nothing here decides a meal, a move of home, a birth or a death; identity and population are the server's.
 *
 * The web's kind is read from the species' stored scientific name (genus, else family), else its slug's words, against
 * the spiders' families' web habits (real biology, never invented):
 *
 * - Orb weavers (Araneidae, Nephilidae): a vertical orb of radii and a sticky spiral, its frame strung between plants,
 *   posts, eaves or window frames. Most take the sticky spiral down and spin it again every day (Foelix, Biology of
 *   Spiders, 3rd ed. 2011, ch. 5; Zschokke & Vollrath 1995, "Web construction patterns in a range of orb-weaving
 *   spiders", Eur. J. Entomol. 92: about half an hour to spin). Per species below.
 * - Cobweb spiders (Theridiidae) and cellar spiders (Pholcidae): a lasting three-dimensional tangle in a sheltered
 *   corner (house corners, sheds, under eaves, window frames); theridiids add sticky "gumfoot" lines down to the
 *   surface below (Benjamin & Zschokke 2003, "Webs of theridiid spiders", Biol. J. Linn. Soc. 78: 293-305); Pholcus
 *   phalangioides hangs upside down in a loose tangle in ceiling corners (Jackson & Brassington 1987, J. Zool. 211).
 * - Funnel weavers (Agelenidae): a lasting horizontal sheet running back into a funnel retreat in a corner, at a
 *   wall's foot, in a shed or in dense grass (Roberts, Collins Field Guide: Spiders of Britain & Northern Europe, 1995).
 * - No capture web: hunters (wolf spiders Lycosidae and fishing spiders Pisauridae; jumping spiders Salticidae;
 *   wandering spiders Ctenidae; sac spiders Cheiracanthiidae and woodlouse hunters Dysderidae spin only a silk retreat;
 *   tarantulas Theraphosidae line a burrow), and harvestmen (Opiliones), which have no silk glands at all.
 */

import {hashString} from "@/ark-scene/world";

export type WebKind = "orb" | "tangle" | "sheet";
export type WebHabit = {
    kind: WebKind;
    /** The capture area's radius (m) at most (an orb's radius, a tangle's or a sheet's reach). */
    radius: number;
    /** The island hour its orb is taken down and spun again (null: the web lasts, mended as it goes). */
    spinHour: number | null;
    /** By day in a retreat at the web's edge, at the hub only at night. */
    nightOnly: boolean;
    /** Argiope's silk band at the hub: a zigzag above and below, or an X of four arms. */
    band: "zigzag" | "cross" | "debris" | null;
    /** Hangs upside down under its tangle (Pholcus). */
    hangs: boolean;
    /** Where it hangs: low among plants, under cover (an eave, a wall's corner), or at a wall's foot. */
    site: "plants" | "corner" | "foot";
    /** Its source, for the tests and the code's readers. */
    source: string;
};

const ORB = (radius: number, spinHour: number | null, band: WebHabit["band"], source: string, nightOnly = false): WebHabit => ({kind: "orb", radius, spinHour, nightOnly, band, hangs: false, site: "plants", source});
const TANGLE = (radius: number, hangs: boolean, source: string): WebHabit => ({kind: "tangle", radius, spinHour: null, nightOnly: false, band: null, hangs, site: "corner", source});
const SHEET = (radius: number, source: string): WebHabit => ({kind: "sheet", radius, spinHour: null, nightOnly: false, band: null, hangs: false, site: "foot", source});

/** By genus (the stored scientific name's first word). */
const GENERA: Record<string, WebHabit> = {
    // Argiope aurantia: an orb up to about 60 cm across among tall plants in sunny gardens, a zigzag silk band above
    // and below the hub (Herberstein et al. 2000, "The functional significance of silk decorations of orb-web
    // spiders", Biol. Rev. 75: 649-669), the female head down at the hub day and night; she eats the orb's round part
    // each night and spins it again (Bugguide and Wikipedia, Argiope aurantia). Argiope anasuja, the signature spider:
    // its band is an X of four arms (`SPECIES`).
    Argiope: ORB(0.3, 2.5, "zigzag", "Argiope: hub-sitter, orb renewed each night (Bugguide)"),
    // Nephila pilipes: the giant golden orb, often over 1 m across, golden silk, hub high in the orb; the web is kept
    // and mended for days, not spun again each day (Robinson & Robinson 1973, Smithson. Contrib. Zool. 149).
    Nephila: ORB(0.6, null, null, "Nephila: lasting orb, mended (Robinson & Robinson 1973)"),
    Trichonephila: ORB(0.5, null, null, "Trichonephila: lasting orb, mended"),
    // Nuctenea umbratica, the walnut orb weaver: spins at dusk, sits at the hub at night, hides by day in a crevice of
    // bark or a fence post at the web's edge (Roberts 1995).
    Nuctenea: ORB(0.18, 19.5, null, "Nuctenea umbratica: spins at dusk, bark retreat by day (Roberts 1995)", true),
    // Cyclosa, the trashline orb weavers: a small orb with a line of prey remains and egg sacs through the hub, the
    // spider sitting in the line (Foelix 2011; Wikipedia, Cyclosa); a daytime orb, spun in the early morning.
    Cyclosa: ORB(0.12, 5, "debris", "Cyclosa: trashline orb (Foelix 2011)"),
    // Araneus and their kin (the garden cross spider's genus): renewed daily before dawn (Foelix 2011).
    Araneus: ORB(0.2, 4, null, "Araneus: orb renewed before dawn (Foelix 2011)"),
    Neoscona: ORB(0.2, 19.5, null, "Neoscona: spins at dusk (Bugguide)"),
    Larinioides: ORB(0.2, 19.5, null, "Larinioides: spins at dusk (Roberts 1995)", true),
    // Theridiidae: lasting tangles with gumfoot lines in sheltered corners.
    Parasteatoda: TANGLE(0.18, false, "Parasteatoda tepidariorum: tangle in house corners and sheds (Benjamin & Zschokke 2003)"),
    Steatoda: TANGLE(0.15, false, "Steatoda grossa: tangle in dark corners of houses and sheds (Roberts 1995)"),
    Latrodectus: TANGLE(0.2, false, "Latrodectus geometricus: tangle under eaves and in sheltered spots (Benjamin & Zschokke 2003)"),
    Theridion: TANGLE(0.1, false, "Theridion: small tangle among plants"),
    // Pholcidae: loose tangles in ceiling and wall corners, hanging upside down.
    Pholcus: TANGLE(0.22, true, "Pholcus phalangioides: loose tangle in house corners, hangs upside down (Jackson & Brassington 1987)"),
    // Agelenidae: sheet and funnel.
    Eratigena: SHEET(0.2, "Eratigena atrica: sheet and funnel in house corners, sheds, wall feet (Roberts 1995)"),
    Tegenaria: SHEET(0.18, "Tegenaria: sheet and funnel (Roberts 1995)"),
    Agelenopsis: SHEET(0.25, "Agelenopsis: grass spider, sheet and funnel in grass (Bugguide)"),
    Agelena: SHEET(0.25, "Agelena: sheet and funnel in low plants (Roberts 1995)"),
    // ARK-WEBS 2026-11-23: the web spiders aboard the first list missed (no web was drawn for them). Each from the
    // species' own stored text (its field guide row, as `data/ark/hunt-acts.json` quotes it) and its family's habit.
    // Gasteracantha cancriformis: "insects trapped in orb webs" (stored diet text); an araneid orb, renewed as its family.
    Gasteracantha: ORB(0.2, 4, null, "Gasteracantha cancriformis: orb web (stored diet text); renewed as Araneidae (Foelix 2011)"),
    // Macracantha arcuata: "the spiny orb-weaver subfamily of the orb-web family Araneidae" (stored text).
    Macracantha: ORB(0.2, 4, null, "Macracantha arcuata: Gasteracanthinae orb (stored text); renewed as Araneidae (Foelix 2011)"),
    // Caerostris darwini: "Orb web hung in open air over water, not among foliage" (stored text); the largest orbs known,
    // up to 2.8 m2 (Kuntner & Agnarsson 2010, J. Arachnol. 38: 346-356): a radius near a metre.
    Caerostris: ORB(0.9, null, null, "Caerostris darwini: giant orb over water, up to 2.8 m2 (Kuntner & Agnarsson 2010)"),
    // Long-jawed orb weavers: "Orb web with open hub in many species" (stored text).
    Tetragnatha: ORB(0.15, 19.5, null, "Tetragnatha: open-hub orb (stored text), spun at dusk (Roberts 1995)"),
    Leucauge: ORB(0.15, 4, null, "Leucauge: open-hub orb (stored text)"),
    // Thwaitesia (mirror spider), a comb-footed spider (stored text): a theridiid's small tangle among leaves.
    Thwaitesia: TANGLE(0.1, false, "Thwaitesia: comb-footed (Theridiidae) tangle (stored text; Benjamin & Zschokke 2003)"),
    // Eresus (ladybird spider): "the sheet of woolly, sticky silk around the burrow mouth" (stored text).
    Eresus: SHEET(0.12, "Eresus: sheet of woolly sticky silk round its burrow's mouth (stored text)")
};

/** By species, where it differs from its genus. */
const SPECIES: Record<string, WebHabit> = {
    // The signature spider's band is a cross of four arms, often only some of them (Herberstein et al. 2000).
    "Argiope anasuja": {...GENERA.Argiope, band: "cross", source: "Argiope anasuja: cross-shaped band (Herberstein et al. 2000)"}
};

/** By family (a stored name that is a family: "Araneidae"). */
const FAMILIES: Record<string, WebHabit> = {
    Araneidae: ORB(0.2, 4, null, "Araneidae: orb renewed daily (Foelix 2011)"),
    Nephilidae: GENERA.Nephila,
    Theridiidae: GENERA.Parasteatoda,
    Pholcidae: GENERA.Pholcus,
    Agelenidae: GENERA.Eratigena,
    Tetragnathidae: {...GENERA.Tetragnatha, source: "Tetragnathidae: open-hub orb (stored text)"},
    Eresidae: GENERA.Eresus
};

/** The slug's words when no name says (an "-orb-weaver" is an araneid). */
const SLUG_WORDS: Array<[RegExp, WebHabit]> = [
    [/orb-weaver|garden-spider|cross-spider/, FAMILIES.Araneidae],
    [/cobweb-spider|house-spider$|widow-spider/, GENERA.Parasteatoda],
    [/daddy-long-legs-spider|cellar-spider/, GENERA.Pholcus],
    [/funnel-weaver|grass-spider/, GENERA.Agelenopsis]
];

/** A spider's web, if it spins a capture web (null: a hunter, a harvestman, anything else). */
export function webHabit(slug: string, scientificName?: string | null): WebHabit | null {
    const name = (scientificName ?? "").trim();
    const genus = name.split(/\s+/)[0] ?? "";
    const species = name.split(/\s+/).slice(0, 2).join(" ");
    if (SPECIES[species]) return SPECIES[species];
    if (genus && GENERA[genus]) return GENERA[genus];
    if (genus && FAMILIES[genus]) return FAMILIES[genus];
    // A stored name of another genus or family is a no-web spider (a wolf spider's Hogna): only a missing name falls
    // back to the slug's words. (The Australian funnel-web, Atracidae, lines a burrow: no sheet, no slug match.)
    if (name) return null;
    for (const [pattern, habit] of SLUG_WORDS) if (pattern.test(slug)) return habit;
    return null;
}

// MARK: The day of a web

/** Taking the old sticky spiral down (h): the spider eats it. */
export const TAKE_DOWN_HOURS = 0.1;
/** Spinning it again (h): about half an hour (Zschokke & Vollrath 1995). */
export const SPIN_HOURS = 0.5;
/** What is left of a web while it is taken down and spun again: the frame threads (`web-spin.ts` threadOrder's anchors). */
export const FRAME_LEFT = 0.08;

const unitOf = (key: string) => (hashString(key) % 100000) / 100000;
const wrap = (hours: number) => ((hours % 24) + 24) % 24;

/** Its own moment: within about forty minutes of its kind's hour, so a hedge's webs never fill in together. */
export function spinStart(habit: WebHabit, id: string): number | null {
    return habit.spinHour === null ? null : wrap(habit.spinHour + (unitOf(`web:${id}`) - 0.5) * 1.3);
}

export type WebStage = {
    /** How much of the web is spun (0–1, `web-spin.ts` threadOrder). */
    built: number;
    /** Spinning now: the spider is at the thread being laid. */
    spinning: boolean;
    /** Taking it down now: the spider is at the hub, eating the spiral. */
    takingDown: boolean;
};

/** Its web at island hour `hours`. */
export function webStage(habit: WebHabit, id: string, hours: number): WebStage {
    const start = spinStart(habit, id);
    if (start === null) return {built: 1, spinning: false, takingDown: false};
    const since = wrap(hours - start);
    if (since < TAKE_DOWN_HOURS) return {built: 1 - (1 - FRAME_LEFT) * (since / TAKE_DOWN_HOURS), spinning: false, takingDown: true};
    if (since < TAKE_DOWN_HOURS + SPIN_HOURS) return {built: FRAME_LEFT + (1 - FRAME_LEFT) * ((since - TAKE_DOWN_HOURS) / SPIN_HOURS), spinning: true, takingDown: false};
    return {built: 1, spinning: false, takingDown: false};
}

/** Night for a night spinner: from its spinning at dusk to the morning (it goes to its retreat at 6:30). */
export function atHub(habit: WebHabit, id: string, hours: number): boolean {
    if (!habit.nightOnly) return true;
    const start = spinStart(habit, id) ?? 19.5;
    return wrap(hours - start) < wrap(6.5 - start);
}

/**
 * Its trips along the silk (s of the island's clock): every few minutes out along a radius (or a thread of its
 * tangle, or over its sheet) and back, as a spider mends its web and checks its lines. 0 at the hub (or its retreat),
 * 1 at the far end. A pure rule in its id and the clock.
 */
export function silkTrip(id: string, seconds: number): {out: number; thread: number} {
    const period = 300 + unitOf(`trip:${id}`) * 240;
    const t = seconds + unitOf(`trip0:${id}`) * period;
    const k = Math.floor(t / period);
    const u = t / period - k;
    // Out in 6 s, a pause of 8 s, back in 6 s; still the rest of the time.
    const s = u * period;
    const ease = (x: number) => x * x * (3 - 2 * x);
    const out = s < 6 ? ease(s / 6) : s < 14 ? 1 : s < 20 ? 1 - ease((s - 14) / 6) : 0;
    return {out, thread: hashString(`thread:${id}:${k}`) % 1024};
}
