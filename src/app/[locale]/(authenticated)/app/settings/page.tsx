import {redirect} from "next/navigation";
import {InstagramRow, SoundEffectsRow} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {
    SettingsDivider,
    SettingsIcons,
    SettingsNavigationRow,
    SettingsSection
} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {accountStandingValue, currencySelectionLabel, locationVisibilityTitle, missionsSubtitle} from "@/lib/account-settings";
import {getLocalePath} from "@/lib/site";
import {appStoreUrl} from "@/lib/store-links";

export const dynamic = "force-dynamic";
export const metadata = {title: "Settings & Activity"};

const LANGUAGE_NAMES: Record<string, string> = {en: "English", id: "Bahasa Indonesia"};

/**
 * Settings & Activity — iOS opens it as a drawer from the profile's ☰ button
 * (`settingsActivitySheet` + `SettingsActivitySections`). On the web it is a
 * tab of its own, with the same rows in the same order; each iOS push is a
 * page under /app/settings. iOS-only rows (Widgets, Data & Uploads) are left
 * out: a browser has no Home Screen widgets and no Wi-Fi-only upload queue.
 */
export default async function SettingsPage({params}: {params: {locale: string}}) {
    const overview = await getSettingsOverview();
    if (!overview) redirect(getLocalePath(params.locale, "/account"));

    const anyPush = Object.values(overview.push).some(Boolean);

    return (
        <div className="mx-auto w-full max-w-2xl space-y-5 pb-10">
            <header className="pt-1">
                <h1 className="text-[17px] font-bold text-white md:font-display md:text-3xl">Settings &amp; Activity</h1>
            </header>

            <SettingsSection>
                <SettingsNavigationRow href="/app/settings/endorsements" icon={SettingsIcons.endorse} title="Endorsements" subtitle="Captures you've endorsed" />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/missions" icon={SettingsIcons.missions} title="Missions" subtitle={missionsSubtitle(overview.activeMissionCount)} />
                <SettingsDivider />
                <SettingsNavigationRow
                    href="/app/credits"
                    icon={SettingsIcons.credits}
                    title={overview.isPro ? "Credits & Unlocks" : `Credits & Unlocks (${overview.creditBalance})`}
                />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/earnings" icon={SettingsIcons.earnings} title="Earnings" subtitle="See how earning with AnimalDex works" />
            </SettingsSection>

            <SettingsSection title="PREFERENCES">
                <SettingsNavigationRow href="/app/settings/notifications" icon={SettingsIcons.bell} title="Notifications" value={anyPush ? "On" : "Off"} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/language" icon={SettingsIcons.globe} title="Language" value={LANGUAGE_NAMES[params.locale] ?? params.locale.toUpperCase()} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/currency" icon={SettingsIcons.banknote} title="Currency" value={currencySelectionLabel(overview.currencyPreference, overview.displayCurrency)} />
                <SettingsDivider />
                <SoundEffectsRow />
            </SettingsSection>

            <SettingsSection title="PRIVACY & DATA">
                <SettingsNavigationRow href="/app/settings/location-privacy" icon={SettingsIcons.location} title="Location Privacy" value={locationVisibilityTitle(overview.locationVisibility)} />
            </SettingsSection>

            <SettingsSection title="CONNECTED SERVICES">
                <InstagramRow />
            </SettingsSection>

            <SettingsSection title="SUPPORT & ABOUT" footer="AnimalDex for web">
                <SettingsNavigationRow href="/support" icon={SettingsIcons.help} title="Help & Support" />
                <SettingsDivider />
                <SettingsNavigationRow href={`${appStoreUrl}?action=write-review`} external icon={SettingsIcons.star} title="Rate AnimalDex" />
                <SettingsDivider />
                <SettingsNavigationRow href="/legal/privacy" icon={SettingsIcons.privacy} title="Privacy Policy" />
                <SettingsDivider />
                <SettingsNavigationRow href="/legal/terms" icon={SettingsIcons.terms} title="Terms of Use" />
            </SettingsSection>

            <SettingsSection title="ACCOUNT">
                <SettingsNavigationRow href="/app/settings/account" icon={SettingsIcons.person} title="Account" value={overview.email} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/account-standing" icon={SettingsIcons.shield} title="Account standing" value={accountStandingValue(overview.standing)} />
            </SettingsSection>
        </div>
    );
}
