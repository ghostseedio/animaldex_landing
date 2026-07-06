export type CollectorScoreBand = {
    upperBound: number | null;
    descriptor: string;
    tierLabel: string;
    accentClass: string;
};

const scoreBands: CollectorScoreBand[] = [
    {upperBound: 300, descriptor: "Field Scout", tierLabel: "Rising", accentClass: "text-emerald-300"},
    {upperBound: 800, descriptor: "Trail Tracker", tierLabel: "Proven", accentClass: "text-cyan-300"},
    {upperBound: 1_600, descriptor: "Wildlife Hunter", tierLabel: "Seasoned", accentClass: "text-green-300"},
    {upperBound: 2_800, descriptor: "Habitat Reader", tierLabel: "Advanced", accentClass: "text-teal-300"},
    {upperBound: 4_200, descriptor: "Rare Naturalist", tierLabel: "Expert", accentClass: "text-primary-200"},
    {upperBound: 6_000, descriptor: "Expedition Leader", tierLabel: "Master", accentClass: "text-violet-300"},
    {upperBound: 8_500, descriptor: "Apex Collector", tierLabel: "Apex", accentClass: "text-orange-300"},
    {upperBound: 11_500, descriptor: "Legend Archivist", tierLabel: "Legend", accentClass: "text-pink-300"},
    {upperBound: null, descriptor: "Mythic Fieldmaster", tierLabel: "Mythic", accentClass: "text-amber-200"}
];

export function getCollectorScoreBand(score: number): CollectorScoreBand {
    return scoreBands.find((band) => band.upperBound === null || score < band.upperBound) ?? scoreBands[scoreBands.length - 1];
}
