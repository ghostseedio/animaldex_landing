"use client";

import Link from "@/app/[locale]/_components/link";
import {AppEmpty} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import AnimalPowerIcon from "@/components/animal-detail/animal-powers/animal-power-icon";
import {POWER_HISTORY_COPY, type PlayPowerHistoryItem, powerHistoryDetailLine, powerHistoryHref} from "@/lib/power-history";

const NEON = "#A7F432";
const VIOLET = "#8B5CF6";

function AnimalIcon({src, size}: {src: string | null; size: number}) {
    return (
        <span
            className="grid shrink-0 place-items-center overflow-hidden bg-[#1c1c1c] text-white/35"
            style={{width: size, height: size, borderRadius: size * 0.25}}
        >
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
                <span aria-hidden="true" style={{fontSize: size * 0.4}}>🐾</span>
            )}
        </span>
    );
}

/** The History segment's Powers page: every Power earned, newest first. */
export function PowerHistoryList({items, loaded}: {items: PlayPowerHistoryItem[]; loaded: boolean}) {
    if (!items.length) {
        return loaded ? (
            <AppEmpty icon="spark" title="No Powers yet" detail="Powers you earn show up here, with how and when you earned them." />
        ) : null;
    }
    return (
        <div className="-mx-4 md:mx-0 md:overflow-hidden md:border md:border-white/[0.08]">
            {items.map((item) => {
                const row = (
                    <>
                        <AnimalIcon src={item.imageSrc} size={40} />
                        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                            <span className="flex min-w-0 items-center gap-[5px]">
                                {item.isFused ? (
                                    <span className="rounded-full px-[5px] py-[2px] text-[8px] font-black tracking-[0.06em] text-black/85" style={{backgroundColor: VIOLET}}>
                                        {POWER_HISTORY_COPY.fused}
                                    </span>
                                ) : null}
                                <span className="truncate text-sm font-extrabold text-white">
                                    {item.isFused ? null : (
                                        <AnimalPowerIcon
                                            speciesProfileId={item.speciesProfileId}
                                            style={{color: NEON}}
                                            fallback={<span aria-hidden="true" className="mr-[5px] text-[10px]" style={{color: NEON}}>⚡</span>}
                                        />
                                    )}
                                    {item.powerName}
                                </span>
                            </span>
                            <span className="truncate text-[11px] text-white/60">{powerHistoryDetailLine(item)}</span>
                        </span>
                        <span aria-hidden="true" className="shrink-0 text-xs font-bold text-white/35">›</span>
                    </>
                );
                const className = "flex w-full items-center gap-3 border-b border-white/[0.08] bg-[#141414] px-4 py-3 text-left transition hover:bg-white/[0.03]";
                const href = powerHistoryHref(item);
                return href ? (
                    <Link key={item.id} href={href} className={className}>{row}</Link>
                ) : (
                    <div key={item.id} className={className}>{row}</div>
                );
            })}
        </div>
    );
}
