import type {MatchupOpponent} from "@/data/matchups-types";

const NEON = "#A7F432";
const HEART = "rgb(250,115,133)";

/** iOS `AnimalDexTheme.battleTierColor`. */
const TIER_COLOR: Record<string, string> = {
    S: NEON,
    A: "rgba(167,244,50,0.92)",
    B: "rgba(50,173,230,0.9)",
    C: "rgba(255,255,255,0.82)",
    D: "rgba(255,149,0,0.86)",
    E: "rgba(255,59,48,0.82)"
};

/**
 * One animal in the Comparisons grid. iOS `MatchupOpponentCardView`: a
 * full-bleed photo tile, two to a row, with the tier top-left and the name,
 * handle, stake, hearts and a scale button over a bottom scrim. The whole tile
 * is the button.
 */
export default function MatchupOpponentCard({
    opponent,
    onChallenge
}: {
    opponent: MatchupOpponent;
    onChallenge: () => void;
}) {
    const tierColor = TIER_COLOR[opponent.battleTier] ?? TIER_COLOR.C;
    const health = Math.max(0, Math.min(3, opponent.challengeHealth));
    const handle = opponent.ownerUsername ? `@${opponent.ownerUsername}` : opponent.ownerName;

    return (
        <button
            type="button"
            onClick={onChallenge}
            aria-label={`Compare with ${opponent.animalName}`}
            className="group relative block h-[196px] w-full overflow-hidden bg-[#141414] text-left md:h-[240px]"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={opponent.imageSrc}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[108px] bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

            <span
                className="absolute left-2.5 top-2.5 rounded-full border bg-black/55 px-2 py-[5px] text-[10px] font-black"
                style={{color: tierColor, borderColor: `color-mix(in srgb, ${tierColor} 35%, transparent)`}}
            >
                Tier {opponent.battleTier}
            </span>

            <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-3">
                <p className="truncate text-[17px] font-black text-white">{opponent.animalName}</p>
                <p className="truncate text-[11px] text-white/60">{handle}</p>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-[7px] py-[5px] text-[11px] font-extrabold" style={{color: "rgb(250,194,61)"}}>
                        <svg viewBox="0 0 12 12" className="h-[9px] w-[9px]" fill="currentColor" aria-hidden="true"><path d="M7 0 1.5 7H5.5L4.5 12 10.5 5H6.5L7 0Z" /></svg>
                        {opponent.challengeStake}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-black/45 px-[7px] py-[5px]" aria-label={`${health} of 3 hearts`}>
                        {[0, 1, 2].map((index) => (
                            <svg key={index} viewBox="0 0 12 11" className="h-[9px] w-[9px]" aria-hidden="true">
                                <path
                                    d="M6 10.5 1.2 5.9A2.9 2.9 0 0 1 6 2.1a2.9 2.9 0 0 1 4.8 3.8L6 10.5Z"
                                    fill={index < health ? HEART : "none"}
                                    stroke={index < health ? HEART : "rgba(255,255,255,0.28)"}
                                    strokeWidth="1.2"
                                />
                            </svg>
                        ))}
                    </span>
                    <span className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-black/30 bg-primary-400 text-black/90" aria-hidden="true">
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 2v12M4 14h8M2.5 5h11M2.5 5 1 9.5a1.8 1.8 0 0 0 3 0L2.5 5ZM13.5 5 12 9.5a1.8 1.8 0 0 0 3 0L13.5 5Z" />
                        </svg>
                    </span>
                </div>
            </div>
        </button>
    );
}
