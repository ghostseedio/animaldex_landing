export type CollectorScoreBand = {
    upperBound: number | null;
    descriptor: string;
    tierLabel: string;
    accentClass: string;
    /** Six-digit hex, so callers can safely derive alpha variants. */
    accentColor: string;
    /** The opacity iOS bakes into `ScoreBand.accent`. */
    accentOpacity: number;
};

const scoreBands: CollectorScoreBand[] = [
    {upperBound: 300, descriptor: "Field Scout", tierLabel: "Rising", accentClass: "text-emerald-300", accentColor: "#00C7BE", accentOpacity: 1},
    {upperBound: 800, descriptor: "Trail Tracker", tierLabel: "Proven", accentClass: "text-cyan-300", accentColor: "#32ADE6", accentOpacity: 1},
    {upperBound: 1_600, descriptor: "Wildlife Hunter", tierLabel: "Seasoned", accentClass: "text-primary-300", accentColor: "#21C05E", accentOpacity: 0.9},
    {upperBound: 2_800, descriptor: "Habitat Reader", tierLabel: "Advanced", accentClass: "text-teal-300", accentColor: "#30B0C7", accentOpacity: 0.92},
    {upperBound: 4_200, descriptor: "Rare Naturalist", tierLabel: "Expert", accentClass: "text-primary-200", accentColor: "#A7F432", accentOpacity: 1},
    {upperBound: 6_000, descriptor: "Expedition Leader", tierLabel: "Master", accentClass: "text-violet-300", accentColor: "#9454FA", accentOpacity: 1},
    {upperBound: 8_500, descriptor: "Apex Collector", tierLabel: "Apex", accentClass: "text-orange-300", accentColor: "#EB5138", accentOpacity: 1},
    {upperBound: 11_500, descriptor: "Legend Archivist", tierLabel: "Legend", accentClass: "text-pink-300", accentColor: "#FF2D55", accentOpacity: 0.88},
    {upperBound: null, descriptor: "Mythic Fieldmaster", tierLabel: "Mythic", accentClass: "text-amber-200", accentColor: "#FFD60A", accentOpacity: 0.92}
];

export function getCollectorScoreBand(score: number): CollectorScoreBand {
    return scoreBands.find((band) => band.upperBound === null || score < band.upperBound) ?? scoreBands[scoreBands.length - 1];
}

/** `rgba()` for a band accent at `alpha` × the band's own opacity. */
export function collectorScoreAccent(band: CollectorScoreBand, alpha = 1) {
    const value = Number.parseInt(band.accentColor.slice(1), 16);
    const red = (value >> 16) & 0xff;
    const green = (value >> 8) & 0xff;
    const blue = value & 0xff;

    return `rgba(${red}, ${green}, ${blue}, ${alpha * band.accentOpacity})`;
}
