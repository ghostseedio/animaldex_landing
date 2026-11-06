import InstagramImportClient from "./instagram-import-client";
import {loadAppFeatureFlags} from "@/data/app-feature-flags";
import {isAppFeatureOn} from "@/lib/app-feature-flags";
import PausedFeature from "@/app/[locale]/(authenticated)/app/_components/paused-feature";

export const dynamic = "force-dynamic";

export default async function InstagramImportPage() {
    // Instagram import paused (shared SPEC section 3.2).
    if (!isAppFeatureOn(await loadAppFeatureFlags(), "instagram_import")) return <PausedFeature />;
    return <InstagramImportClient />;
}
