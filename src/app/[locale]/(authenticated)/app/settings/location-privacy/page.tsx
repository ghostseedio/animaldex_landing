import {redirect} from "next/navigation";
import {LocationPrivacyList} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {SettingsScreen} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {getLocalePath} from "@/lib/site";
import {fillSettingsWords} from "@/lib/settings-words";
import {getSettingsWords} from "@/loaders/settings-words";


export const dynamic = "force-dynamic";

/** iOS `SettingsLocationPrivacyView`. */
export default async function LocationPrivacyPage({params}: {params: {locale: string}}) {
    const overview = await getSettingsOverview();
    if (!overview) redirect(getLocalePath(params.locale, "/account"));
    const w = await getSettingsWords(params.locale);
    return (
        <SettingsScreen title={w.locationPrivacy} backLabel={w.settings} backAriaLabel={fillSettingsWords(w.backTo, {label: w.settings})}>
            <LocationPrivacyList initial={overview.locationVisibility} />
        </SettingsScreen>
    );
}
