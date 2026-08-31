import type {MatchupOpponent} from "@/data/matchups-types";
import ChallengeHearts from "@/app/[locale]/(authenticated)/app/matchups/_components/challenge-hearts";

export default function MatchupOpponentCard({
    opponent,
    onChallenge
}: {
    opponent: MatchupOpponent;
    onChallenge: () => void;
}) {
    return (
        <article className="group overflow-hidden rounded-[1.45rem] border border-white/10 bg-[linear-gradient(145deg,rgba(18,24,20,0.98),rgba(8,10,9,0.98))] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.95)] transition hover:border-primary-400/30">
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(167,244,50,0.16),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.18),transparent_50%)]" />
                <div className="relative grid gap-4 p-4 sm:grid-cols-[7.5rem_1fr]">
                    <div className="relative mx-auto w-full max-w-[7.5rem] sm:mx-0">
                        <img
                            src={opponent.imageSrc}
                            alt=""
                            className="aspect-square w-full rounded-[1.15rem] border border-white/10 object-cover"
                        />
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-primary-200">
                            VS
                        </span>
                    </div>
                    <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary-400/15 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-primary-200">
                                Scenario Arena
                            </span>
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[0.62rem] font-bold text-white/45">
                                Tier {opponent.battleTier}
                            </span>
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[0.62rem] font-bold text-white/45">
                                Lvl {opponent.level}
                            </span>
                        </div>
                        <div>
                            <h3 className="font-display text-2xl font-bold text-white">{opponent.animalName}</h3>
                            <p className="mt-1 text-sm text-white/45">
                                {opponent.ownerUsername ? `@${opponent.ownerUsername}` : opponent.ownerName}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[0.68rem] font-bold">
                            <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-amber-200">
                                Guarding {opponent.challengeStake} credits
                            </span>
                            <span className="inline-flex items-center rounded-full bg-rose-400/10 px-2.5 py-1">
                                <ChallengeHearts challengeHealth={opponent.challengeHealth} />
                            </span>
                            {opponent.powerTag ? (
                                <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-violet-200">
                                    {opponent.powerTag}
                                </span>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={onChallenge}
                            className="w-full rounded-2xl bg-primary-400 px-4 py-3 text-sm font-black text-black transition hover:brightness-105"
                        >
                            Challenge this animal
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}
