"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import GuideAgentPanel, {GuideAgentEntry} from "@/components/wildlife-guides/guide-agent-panel";
import {AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {OwnerShopGuides} from "@/app/[locale]/(composited)/u/[handle]/profile-shop-guides";
import Link from "@/app/[locale]/_components/link";
import {GUIDE_BAND, GuideBandHeader, GuideCoverTiles} from "@/components/wildlife-guides/guide-ui";
import type {ProfileShopLabels} from "@/app/[locale]/(composited)/u/[handle]/profile-shop-labels";
import {guideAuthorName, type GuideBought, type MyWildlifeGuides} from "@/lib/virtual-wildlife-guides";
import {guideEarnSteps} from "@/data/earn-economy";

export default function GuidesListClient({initial, bought, labels, locale}: {initial: MyWildlifeGuides | null; bought: GuideBought[]; labels: ProfileShopLabels; locale: string}) {
    const router = useRouter();
    const [askOpen, setAskOpen] = useState(false);
    const hasGuides = (initial?.guides.length ?? 0) > 0;
    return (
        <AppPage narrow>
            <div className="px-[18px] pt-6">
                <AppPageHeader
                    eyebrow="Shop"
                    title="Wildlife Guides"
                    description="Virtual guides AnimalDex builds from your wild sightings, one per place. Explorers pay a small fee for your notes, a chat with you and introductions to local people."
                />
            </div>
            <div className="flex flex-col">
                {hasGuides ? (
                    askOpen ? (
                        <GuideAgentPanel onChange={() => router.refresh()} onClose={() => setAskOpen(false)} />
                    ) : (
                        <GuideAgentEntry
                            title="Ask AnimalDex to edit your guides"
                            detail="Change titles, prices, animals or notes by asking."
                            onOpen={() => setAskOpen(true)}
                        />
                    )
                ) : null}
                <OwnerShopGuides initial={initial} labels={labels} locale={locale} />
                {bought.length > 0 ? (
                    <>
                        <GuideBandHeader title="Guides you bought" />
                        {bought.map((item) => (
                            <Link
                                key={item.purchaseId}
                                href={`/app/guides/bought/${item.guide.id}`}
                                className={`${GUIDE_BAND} flex items-start gap-3.5 px-[18px] py-3 transition hover:bg-[#262626]`}
                            >
                                <GuideCoverTiles media={item.guide.coverMedia} banner={item.guide.banner} size={64} />
                                <span className="min-w-0 flex-1">
                                    <span className="line-clamp-2 block text-sm font-semibold text-white">{item.guide.title}</span>
                                    <span className="mt-1 block truncate text-xs text-white/60">{item.guide.areaLabel}</span>
                                    {item.status === "refunded" ? (
                                        <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.06em] text-white/40">Refunded</span>
                                    ) : item.seller ? (
                                        <span className="mt-1 block truncate text-[11px] font-semibold text-white/40">By {guideAuthorName(item.seller)}</span>
                                    ) : null}
                                </span>
                            </Link>
                        ))}
                    </>
                ) : null}
                <GuideBandHeader title="How guides work" />
                {guideEarnSteps.map((step, index) => (
                    <div key={step.title} className={`${GUIDE_BAND} flex items-start gap-3 px-[18px] py-3.5`}>
                        <span className="w-5 shrink-0 font-display text-sm font-bold tabular-nums text-white/40">{index + 1}</span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-white">{step.title}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-white/60">{step.detail}</span>
                        </span>
                    </div>
                ))}
            </div>
        </AppPage>
    );
}
