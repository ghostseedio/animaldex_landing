import Link from "@/app/[locale]/_components/link";
import BattleAvatar from "@/app/[locale]/(composited)/comparisons/_components/battle-avatar";
import type {ComparisonBattle, ComparisonBattlePlayer, ComparisonBattleSide} from "@/data/comparison-battles";

const MAX_SHOWN = 5;

function formatBattleDate(date: string) {
    return new Date(date).toLocaleDateString("en", {day: "numeric", month: "short", year: "numeric"});
}

function PlayerBlock({player, won, align}: {player: ComparisonBattlePlayer; won: boolean; align: "left" | "right"}) {
    const name = (
        <span className="block truncate font-bold text-white">{player.displayName}</span>
    );
    return (
        <div className={`flex min-w-0 items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
            <BattleAvatar name={player.displayName} avatarUrl={player.avatarUrl} size={48} winner={won} />
            <div className="min-w-0">
                {player.username ? <Link href={`/u/${player.username}`} className="hover:underline">{name}</Link> : name}
                <span className="block truncate text-xs text-ink-300">{player.animalName ?? "Their capture"}</span>
                {won ? <span className="mt-1 inline-block text-[0.65rem] font-black uppercase tracking-[0.14em] text-primary-200">Winner</span> : null}
            </div>
        </div>
    );
}

/**
 * Real AnimalDex players who battled this exact species pair in the Arena,
 * from the build-time snapshot. Shown near the top so the page reads as a
 * matchup people actually played, not only an AI verdict.
 */
export default function ComparisonUserBattles({battles}: {battles: ComparisonBattle[]}) {
    if (!battles.length) return null;
    const shown = battles.slice(0, MAX_SHOWN);
    const totalCredits = battles.reduce((sum, battle) => sum + (battle.winner === "draw" ? 0 : battle.payout), 0);

    return (
        <section aria-labelledby="user-battles-title" className="border border-white/10 bg-white/[0.035] p-5 md:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-200">Battled on AnimalDex</p>
                    <h2 id="user-battles-title" className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">
                        {battles.length === 1 ? "Two players settled this one in the Arena" : `${battles.length} Arena battles between players`}
                    </h2>
                </div>
                {totalCredits > 0 ? (
                    <p className="rounded-full border border-primary-400/30 bg-primary-400/10 px-3 py-1 text-sm font-bold text-primary-100">
                        {totalCredits} credits won
                    </p>
                ) : null}
            </div>

            <ol className="mt-5 space-y-4">
                {shown.map((battle) => {
                    // Keep the page's order: animal A's player on the left.
                    const leftSide: ComparisonBattleSide = battle.attacker.comparisonSide === "animalA" ? "attacker" : "defender";
                    const rightSide: ComparisonBattleSide = leftSide === "attacker" ? "defender" : "attacker";
                    const nameOf = (side: ComparisonBattleSide | "draw") => side === "draw" ? "Draw" : battle[side].displayName;
                    return (
                        <li key={battle.id} className="border border-white/10 bg-black/20 p-4 light:bg-surface-800/60">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                                <PlayerBlock player={battle[leftSide]} won={battle.winner === leftSide} align="left" />
                                <div className="text-center">
                                    <p className="font-display text-2xl font-black tabular-nums text-white">
                                        {battle.roundsWon[leftSide]}<span className="mx-1 text-ink-400">–</span>{battle.roundsWon[rightSide]}
                                    </p>
                                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-400">
                                        {battle.format === "best_of_3" ? "Best of 3" : "One round"}
                                    </p>
                                </div>
                                <PlayerBlock player={battle[rightSide]} won={battle.winner === rightSide} align="right" />
                            </div>

                            <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                                {battle.rounds.map((round) => (
                                    <li key={round.number} className="border border-white/10 px-3 py-2 text-sm">
                                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Round {round.number} · {round.label}</p>
                                        {round.detail ? <p className="mt-0.5 truncate text-ink-200">{round.detail}</p> : null}
                                        <p className="mt-0.5 font-semibold text-white">{round.winner === "draw" ? "Draw" : `${nameOf(round.winner)} won`}</p>
                                    </li>
                                ))}
                            </ul>

                            <p className="mt-3 text-xs text-ink-300">
                                {battle.winner === "draw"
                                    ? `Draw · ${battle.stake} credits returned to each player`
                                    : `${nameOf(battle.winner)} won ${battle.payout} credits`}
                                {" · "}{formatBattleDate(battle.date)}
                            </p>
                        </li>
                    );
                })}
            </ol>
            {battles.length > shown.length ? (
                <p className="mt-3 text-sm text-ink-300">and {battles.length - shown.length} more battles.</p>
            ) : null}
        </section>
    );
}
