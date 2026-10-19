"use client";

import {AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {OwnerShopGuides} from "@/app/[locale]/(composited)/u/[handle]/profile-shop-guides";
import {GUIDE_BAND, GuideBandHeader} from "@/components/wildlife-guides/guide-ui";
import type {ProfileShopLabels} from "@/app/[locale]/(composited)/u/[handle]/profile-shop-labels";
import type {MyWildlifeGuides} from "@/lib/virtual-wildlife-guides";
import {guideEarnSteps} from "@/data/earn-economy";

export default function GuidesListClient({initial, labels}: {initial: MyWildlifeGuides | null; labels: ProfileShopLabels}) {
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
                <OwnerShopGuides initial={initial} labels={labels} locale="en" />
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
