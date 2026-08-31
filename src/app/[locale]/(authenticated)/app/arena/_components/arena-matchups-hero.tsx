import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {APP_MODULE_THUMBNAILS} from "@/lib/app-module-thumbnails";

function matchupStatusLabel(count: number) {
    if (count <= 0) return null;
    return count === 1 ? "1 opponent" : `${count} opponents`;
}

export default function ArenaMatchupsHero({opponentCount}: {opponentCount: number}) {
    const statusLabel = matchupStatusLabel(opponentCount);

    return (
        <Link
            href="/app/matchups"
            className="group block overflow-hidden rounded-[24px] shadow-[0_10px_20px_rgba(139,92,246,0.14)] ring-[1.5px] ring-primary-400/45 transition active:scale-[0.99]"
        >
            <div className="relative h-[132px] w-full overflow-hidden">
                <div
                    className="absolute inset-0 bg-[linear-gradient(135deg,rgb(13,42,22)_0%,rgba(167,244,50,0.42)_48%,rgb(33,192,94)_100%)]"
                    aria-hidden="true"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={APP_MODULE_THUMBNAILS.matchupsHero}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    loading="eager"
                    decoding="async"
                />
                <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/[0.55]"
                    aria-hidden="true"
                />
            </div>

            <div className="bg-gradient-to-b from-[#141714] to-[#1f1f1f] p-[18px]">
                <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <span className="inline-flex rounded-full bg-primary-400/[0.14] px-[9px] py-[5px] text-[0.62rem] font-black uppercase tracking-[0.08em] text-primary-300">
                            Featured
                        </span>
                        <h2 className="mt-1.5 font-display text-[28px] font-black leading-none text-white">Matchups</h2>
                    </div>
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                        <AppIcon name="chevron" className="h-3.5 w-3.5" />
                    </span>
                </div>

                <p className="mt-3.5 text-sm leading-snug text-white/55">
                    Challenge other animals, wager credits, and see which instincts win the scenario.
                </p>

                <div className="mt-3.5 space-y-2">
                    <span className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-primary-400 py-[13px] text-sm font-black text-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                        <AppIcon name="boltShield" className="h-[13px] w-[13px] stroke-[2.2]" />
                        Enter Matchup Arena
                    </span>
                    {statusLabel ? (
                        <span className="inline-flex rounded-full bg-white/[0.08] px-2.5 py-[7px] text-[0.62rem] font-black text-white">
                            {statusLabel}
                        </span>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}
