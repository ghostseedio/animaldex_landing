import {redirect} from "next/navigation";
import {LocationPrivacyList} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {SettingsScreen} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/** iOS `SettingsLocationPrivacyView`. */
export default async function LocationPrivacyPage({params}: {params: {locale: string}}) {
    const overview = await getSettingsOverview();
    if (!overview) redirect(getLocalePath(params.locale, "/account"));
    return (
        <SettingsScreen title="Location Privacy">
            <LocationPrivacyList initial={overview.locationVisibility} />
        </SettingsScreen>
    );
}
