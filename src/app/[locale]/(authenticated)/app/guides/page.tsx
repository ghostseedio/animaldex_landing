import {redirect} from "next/navigation";
import GuidesListClient from "@/app/[locale]/(authenticated)/app/guides/guides-list-client";
import {PROFILE_SHOP_LABEL_KEYS} from "@/app/[locale]/(composited)/u/[handle]/profile-shop-labels";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getMyWildlifeGuidePurchases, getMyWildlifeGuides} from "@/data/virtual-wildlife-guides";
import {getScopedTranslator} from "@/loaders/translation";
import {loadAppFeatureFlags} from "@/data/app-feature-flags";
import {isAppFeatureOn} from "@/lib/app-feature-flags";

export const dynamic = "force-dynamic";

/** The author's virtual Wildlife Guides: every guide, the places growing into one, and sharing. */
export default async function GuidesPage({params}: {params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(`/${params.locale}/account?next=${encodeURIComponent(`/${params.locale}/app/guides`)}`);
    const [mine, bought, t, flags] = await Promise.all([
        getMyWildlifeGuides(),
        getMyWildlifeGuidePurchases(),
        getScopedTranslator(params.locale, "profile"),
        loadAppFeatureFlags().catch(() => ({}))
    ]);
    const labels = Object.fromEntries(PROFILE_SHOP_LABEL_KEYS.map((key) => [key, t(`shop.${key}`)]));
    return <GuidesListClient initial={mine} bought={bought} labels={labels} locale={params.locale} guideSales={isAppFeatureOn(flags, "guide_sales")} />;
}
