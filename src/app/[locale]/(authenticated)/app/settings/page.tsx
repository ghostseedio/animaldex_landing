import {redirect} from "next/navigation";
import {ChatHistorySection, DebateRosterSection, InstagramRow, SoundEffectsRow} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {
    SettingsDivider,
    SettingsIcons,
    SettingsNavigationRow,
    SettingsSection
} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {loadDebatesEnabled, readRosterOptIn} from "@/data/debates";
import {getCompanionWords} from "@/loaders/companion-words";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {accountStandingValue, currencySelectionLabel, locationVisibilityTitle, recordPrivacySummary} from "@/lib/account-settings";
import {getLocalePath} from "@/lib/site";
import {appStoreUrl} from "@/lib/store-links";

export const dynamic = "force-dynamic";
export const metadata = {title: "Settings & activity"};

const LANGUAGE_NAMES: Record<string, string> = {en: "English", id: "Bahasa Indonesia"};

/**
 * Settings & activity — iOS opens it from the profile's ••• button
 * (`settingsActivitySheet` + `SettingsActivitySections`). On the web it is a
 * page of its own, with the same rows in the same order; each iOS push is a
 * page under /app/settings.
 *
 * Left out on purpose: Widgets and Data & uploads (a browser has no Home
 * Screen widgets and no Wi-Fi-only upload queue) and Animal narration (the
 * web's story player has no rewritten voiceover to switch off).
 */
export default async function SettingsPage({params}: {params: {locale: string}}) {
    const overview = await getSettingsOverview();
    if (!overview) redirect(getLocalePath(params.locale, "/account"));
    // 3.2 Debates: the public roster opt-in, while the server has Debates on.
    const supabase = createSupabaseServerClient();
    const [debatesEnabled, words] = await Promise.all([loadDebatesEnabled(), getCompanionWords(params.locale)]);
    const optedIn = debatesEnabled && supabase ? await readRosterOptIn(supabase) : null;

    const anyPush = Object.values(overview.push).some(Boolean);

    return (
        <div className="mx-auto w-full max-w-2xl space-y-5 pb-10">
            <header className="pt-1">
                <h1 className="text-[17px] font-bold text-white md:font-display md:text-3xl">Settings &amp; activity</h1>
            </header>

            {/* "Missions", without a count: "29 active missions" read as a to-do list on a first visit. */}
            <SettingsSection>
                <SettingsNavigationRow href="/app/missions" icon={SettingsIcons.missions} title="Missions" />
                <SettingsDivider />
                <SettingsNavigationRow
                    href="/app/credits"
                    icon={SettingsIcons.credits}
                    title="Credits & unlocks"
                    value={overview.isPro ? null : String(overview.creditBalance)}
                />
                {overview.showsEarnings ? (
                    <>
                        <SettingsDivider />
                        <SettingsNavigationRow href="/app/earnings" icon={SettingsIcons.earnings} title="Earnings" subtitle="See how earning with AnimalDex works" />
                    </>
                ) : null}
            </SettingsSection>

            {/* What used to be Profile tabs, then what you have given and traded; not on a new account's first visit (JRN-37). */}
            {overview.isNewAccount ? null : (
                <>
                    <SettingsSection>
                        <SettingsNavigationRow href="/app/profile?tab=shop" icon={SettingsIcons.shop} title="Shop" />
                        <SettingsDivider />
                        <SettingsNavigationRow href="/app/profile?tab=locations" icon={SettingsIcons.location} title="Locations" />
                        <SettingsDivider />
                        <SettingsNavigationRow href="/app/guides" icon={SettingsIcons.guides} title="Wildlife Guides" />
                    </SettingsSection>

                    <SettingsSection>
                        <SettingsNavigationRow href="/app/settings/gifts" icon={SettingsIcons.gift} title="Gifts" />
                        {overview.showsTrades ? (
                            <>
                                <SettingsDivider />
                                <SettingsNavigationRow href="/app/trades" icon={SettingsIcons.trade} title="Trades & offers" />
                            </>
                        ) : null}
                    </SettingsSection>
                </>
            )}

            <SettingsSection title="PREFERENCES">
                <SettingsNavigationRow href="/app/settings/notifications" icon={SettingsIcons.bell} title="Notifications" value={anyPush ? "On" : "Off"} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/language" icon={SettingsIcons.globe} title="Language" value={LANGUAGE_NAMES[params.locale] ?? params.locale.toUpperCase()} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/currency" icon={SettingsIcons.banknote} title="Currency" value={currencySelectionLabel(overview.currencyPreference, overview.displayCurrency)} />
                <SettingsDivider />
                <SoundEffectsRow />
            </SettingsSection>

            {debatesEnabled ? <DebateRosterSection initial={optedIn} words={words} /> : null}

            <SettingsSection title="PRIVACY & DATA">
                <SettingsNavigationRow href="/app/settings/location-privacy" icon={SettingsIcons.location} title="Location privacy" value={locationVisibilityTitle(overview.locationVisibility)} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/record-privacy" icon={SettingsIcons.record} title="Record privacy" value={recordPrivacySummary(overview.recordPrivacy)} />
            </SettingsSection>

            <ChatHistorySection />

            {overview.instagramImportOn ? (
                <SettingsSection title="CONNECTED SERVICES">
                    <InstagramRow />
                </SettingsSection>
            ) : null}

            <SettingsSection title="SUPPORT & ABOUT" footer="AnimalDex for web">
                <SettingsNavigationRow href="/support" icon={SettingsIcons.help} title="Help & support" />
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
