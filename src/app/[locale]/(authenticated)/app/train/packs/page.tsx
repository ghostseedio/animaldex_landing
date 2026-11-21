import {AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {
    getTrainAnimalPacks,
    getTrainPackEligibleCaptures
} from "@/data/train-modules";
import {getScopedTranslator} from "@/loaders/translation";
import PacksClient from "./packs-client";

export default async function PacksPage({params}: {params: {locale: string}}) {
    const [packs, eligibleCaptures, t] = await Promise.all([
        getTrainAnimalPacks(),
        getTrainPackEligibleCaptures(),
        getScopedTranslator(params.locale, "battleTier")
    ]);

    return (
        <div className="space-y-8">
            <div>
                <TrainBackLink />
                <div className="mt-5">
                    <AppPageHeader
                        eyebrow="Sealed collection"
                        title="Your Packs"
                        description="Open purchased packs, track listings, and build new sealed drops from your captures."
                    />
                </div>
            </div>

            <PacksClient initialPacks={packs} initialEligibleCaptures={eligibleCaptures} unratedLabel={t("unrated")} />
        </div>
    );
}
