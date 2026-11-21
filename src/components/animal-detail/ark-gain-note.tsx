import {fillCaptureWords, type CaptureWords} from "@/lib/capture-words";
import {ARK_STAT_GAIN_STATS, type CardStatGains} from "@/lib/ark-stat-gains";

/**
 * STATS-GROW: "+2 from the Ark" under the stats, and which stats ("+1 Dominance · +1 Speed"): the points the card's own
 * Ark animal earned aboard (the server's `ark_stat_gain_totals`; already in the effective stats above). A plain line,
 * square, no inset box.
 */
export function ArkGainNote({gain, words, labels}: {gain: CardStatGains; words: CaptureWords["stats"]; labels: Record<string, string>}) {
    const parts = ARK_STAT_GAIN_STATS.filter((stat) => gain[stat] > 0).map((stat) => `+${gain[stat]} ${labels[stat]}`).join(" · ");
    return (
        <p data-testid="stats-ark-gain" className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 text-xs font-semibold text-white/[0.62]">
            <span className="font-extrabold text-primary-400">{fillCaptureWords(words.fromArk, {n: gain.total})}</span>
            <span>{fillCaptureWords(words.fromArkDetail, {stats: parts})}</span>
        </p>
    );
}
