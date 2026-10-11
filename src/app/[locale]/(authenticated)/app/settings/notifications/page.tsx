import {redirect} from "next/navigation";
import {PushPreferencesList} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {SettingsIcons, SettingsNavigationRow, SettingsScreen, SettingsSection} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * iOS `SettingsNotificationsView`. The alert types are account settings
 * (`profiles.push_*_enabled`) and apply to the phone. The master switch is a
 * device permission on iOS, so the web keeps the list of alerts it has already
 * received a tap away instead.
 */
export default async function NotificationSettingsPage({params}: {params: {locale: string}}) {
    const overview = await getSettingsOverview();
    if (!overview) redirect(getLocalePath(params.locale, "/account"));

    return (
        <SettingsScreen title="Notifications">
            <SettingsSection footer="You will hear about updates to your captures, people you follow, new messages, and Credit bonuses in the AnimalDex app.">
                <SettingsNavigationRow href="/app/notifications" icon={SettingsIcons.bell} title="Notifications" subtitle="Recent AnimalDex notifications and account activity." />
            </SettingsSection>
            <PushPreferencesList initial={overview.push} />
        </SettingsScreen>
    );
}
