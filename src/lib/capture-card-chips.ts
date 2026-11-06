/**
 * The card's Stats chips (iOS `ScanResultMediaScopedStatsBlock.chipViews`,
 * IOS-22): GRADE, the setting, conservation and rarity, one outlined chip
 * style. Wild is the only setting that carries colour; a free-ranging
 * domestic animal tagged Wild reads "Free-ranging", uncoloured. There is no
 * battle tier letter (JRN-8).
 */

import type {CaptureWords} from "@/lib/capture-words";

type StatsWords = CaptureWords["stats"];

export type StatsChipKind = "grade" | "setting" | "conservation" | "rarity";

export type StatsChip = {
    kind: StatsChipKind;
    /** A small label before the value ("GRADE"), else null. */
    label: string | null;
    /** What the chip says, upper-cased when drawn. */
    value: string;
    /** The plain word, for a sentence ("Why it says Wild"). */
    title: string;
    /** The value's colour; null is the primary text colour. */
    tint: string | null;
    showsInfo: boolean;
};

const NEON = "#A7F432";

/** iOS `AnimalDexInfoChip.gradeTint`, readable on the dark card. */
export function gradeChipTint(grade: number): string | null {
    if (grade >= 9) return "rgb(255 168 64)";
    if (grade >= 7) return "rgb(115 224 250)";
    if (grade >= 5) return NEON;
    if (grade >= 3) return null;
    return "rgb(255 133 122)";
}

type SettingKey = "wild" | "zoo" | "domestic" | "farm";

function settingKey(settingTag: string | null | undefined): SettingKey | null {
    const value = settingTag?.trim().toLowerCase() ?? "";
    return value === "wild" || value === "zoo" || value === "domestic" || value === "farm" ? value : null;
}

/** iOS `isFreeRangingDomestic`: only an explicit pet or livestock context on a Wild capture. */
export function isFreeRangingDomestic(settingTag: string | null | undefined, humanContext: string | null | undefined): boolean {
    if (settingKey(settingTag) !== "wild") return false;
    const context = humanContext?.trim().toLowerCase() ?? "";
    return context === "pet" || context === "livestock";
}

type ConservationKey = "leastConcern" | "nearThreatened" | "vulnerable" | "endangered" | "criticallyEndangered" | "extinctInTheWild" | "extinct";

const CONSERVATION: Record<string, ConservationKey> = {
    lc: "leastConcern", leastconcern: "leastConcern",
    nt: "nearThreatened", nearthreatened: "nearThreatened",
    vu: "vulnerable", vulnerable: "vulnerable",
    en: "endangered", endangered: "endangered",
    cr: "criticallyEndangered", criticallyendangered: "criticallyEndangered",
    ew: "extinctInTheWild", extinctinthewild: "extinctInTheWild",
    ex: "extinct", extinct: "extinct"
};

/** iOS `AnimalDexTheme.tierColor`. */
const CONSERVATION_TINT: Record<ConservationKey, string> = {
    leastConcern: NEON,
    nearThreatened: "rgb(250 219 56)",
    vulnerable: "rgb(250 158 51)",
    endangered: "rgb(250 89 71)",
    criticallyEndangered: "rgb(191 46 242)",
    extinctInTheWild: "rgb(140 140 148)",
    extinct: "rgb(89 89 97)"
};

export function conservationKey(tier: string | null | undefined): ConservationKey | null {
    return CONSERVATION[tier?.trim().toLowerCase().replace(/[^a-z]/g, "") ?? ""] ?? null;
}

type RarityKey = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

/** iOS `RarityTier(rarityValue:)`. */
export function rarityKey(score: number | null | undefined): RarityKey | null {
    if (score == null || !Number.isFinite(score)) return null;
    if (score < 10) return "common";
    if (score < 25) return "uncommon";
    if (score < 45) return "rare";
    if (score < 65) return "epic";
    if (score < 90) return "legendary";
    return "mythic";
}

export function statsClassificationChips(input: {
    captureGrade: number | null;
    settingTag: string | null;
    humanContext: string | null;
    conservationTier: string | null;
    rarity: number | null;
    words: StatsWords;
}): {chips: StatsChip[]; settingIntro: string | null} {
    const {words} = input;
    const chips: StatsChip[] = [];
    if (input.captureGrade != null) {
        chips.push({kind: "grade", label: words.grade, value: String(input.captureGrade), title: String(input.captureGrade), tint: gradeChipTint(input.captureGrade), showsInfo: true});
    }
    const setting = settingKey(input.settingTag);
    let settingIntro: string | null = null;
    if (setting) {
        const freeRanging = isFreeRangingDomestic(input.settingTag, input.humanContext);
        const title = freeRanging ? words.freeRanging : words[setting];
        chips.push({kind: "setting", label: null, value: title, title: words[setting], tint: setting === "wild" && !freeRanging ? NEON : null, showsInfo: false});
        settingIntro = words[`${setting}Intro` as const];
    }
    const conservation = conservationKey(input.conservationTier);
    if (conservation) {
        chips.push({kind: "conservation", label: null, value: words[conservation], title: words[conservation], tint: CONSERVATION_TINT[conservation], showsInfo: false});
    }
    const rarity = rarityKey(input.rarity);
    if (rarity) {
        chips.push({kind: "rarity", label: null, value: words[rarity], title: words[rarity], tint: null, showsInfo: false});
    }
    return {chips, settingIntro};
}
