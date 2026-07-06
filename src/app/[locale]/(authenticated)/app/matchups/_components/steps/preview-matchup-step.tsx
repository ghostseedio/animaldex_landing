"use client";

import MatchupStatBars from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-stat-bars";
import type {MatchupOpponent, MatchupRosterCapture} from "@/data/matchups-types";

export default function PreviewMatchupStep({
    opponent,
    attacker
}: {
    opponent: MatchupOpponent;
    attacker: MatchupRosterCapture;
}) {
    const stake = opponent.challengeStake;
    const totalPot = stake * 2;
    const payout = Math.max(0, totalPot - 1);
    const burn = 1;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="text-center">
                    <img src={attacker.imageSrc} alt="" className="mx-auto aspect-square w-full max-w-[6.5rem] rounded-2xl border border-white/10 object-cover" />
                    <p className="mt-2 text-sm font-bold text-white">{attacker.animalName}</p>
                    <p className="text-xs text-white/35">You · Tier {attacker.battleTier}</p>
                </div>
                <span className="rounded-full bg-primary-400 px-3 py-1 text-xs font-black text-black">VS</span>
                <div className="text-center">
                    <img src={opponent.imageSrc} alt="" className="mx-auto aspect-square w-full max-w-[6.5rem] rounded-2xl border border-white/10 object-cover" />
                    <p className="mt-2 text-sm font-bold text-white">{opponent.animalName}</p>
                    <p className="text-xs text-white/35">Opponent · Tier {opponent.battleTier}</p>
                </div>
            </div>

            <MatchupStatBars
                attackerLabel="You"
                defenderLabel="Them"
                attackerStats={attacker.gameStats}
                defenderStats={opponent.gameStats}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                    ["You stake", `${stake}`],
                    ["Opponent", `${stake}`],
                    ["Best fit gets", `${payout}`],
                    ["Burn", `${burn}`]
                ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">{label}</p>
                        <p className="mt-1 text-lg font-black text-primary-200">{value}</p>
                    </div>
                ))}
            </div>

            <p className="text-sm leading-6 text-white/45">
                AnimalDex will generate a real-life or survival scenario, compare instincts and stats, then award credits to the best fit.
            </p>
        </div>
    );
}
