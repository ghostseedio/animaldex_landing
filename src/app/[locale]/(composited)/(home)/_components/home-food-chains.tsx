import {Fragment} from "react";
import Link from "@/app/[locale]/_components/link";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";
import type {HomeFoodChain} from "@/lib/home-food-chains";

/**
 * The home page's food chain as a picture (`lib/home-food-chains`): each chain a row of animals' icons, eater first,
 * an arrow marked "eats" between them. An icon opens the Ark on that animal. Server-rendered; no state.
 */
export default function HomeFoodChains({chains, locale, arkHref, words}: {chains: HomeFoodChain[]; locale: string; arkHref: string; words: {eats: string; seeInArk: (animal: string) => string}}) {
    return (
        <ul className="grid gap-x-12 gap-y-10 lg:grid-cols-3">
            {chains.map((chain) => (
                <li key={chain.map((s) => s.id).join(">")} className="flex items-start justify-between gap-1 border-t border-line-200 pt-6 sm:justify-start sm:gap-4 lg:justify-between lg:gap-1">
                    {chain.map((species, index) => (
                        <Fragment key={species.id}>
                            {index > 0 ? (
                                <span className="flex h-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 px-0.5 sm:h-20">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-200">{words.eats}</span>
                                    <svg aria-hidden="true" viewBox="0 0 32 12" className="h-3 w-7 text-primary-200" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 6h28M24 1l6 5-6 5" /></svg>
                                </span>
                            ) : null}
                            <Link href={`${arkHref}?focus=${encodeURIComponent(species.slug)}`} locale={locale} aria-label={words.seeInArk(species.name)} className="group flex w-[5.25rem] shrink-0 flex-col items-center gap-2 text-center sm:w-24">
                                <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-line-200 transition group-hover:bg-white/[0.12] group-hover:ring-primary-400 sm:h-20 sm:w-20">
                                    <ArkSpeciesIcon src={arkIconUrl(species.slug)} size={96} className="h-[78%] w-[78%] object-contain" />
                                </span>
                                <span className="text-[13px] font-bold leading-tight text-white [text-wrap:balance]">{species.name}</span>
                            </Link>
                        </Fragment>
                    ))}
                </li>
            ))}
        </ul>
    );
}
