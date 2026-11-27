import {redirect} from "next/navigation";
import {ArkFounderNameSection, ChatHistorySection, DebateRosterSection, InstagramRow, SoundEffectsRow} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {
    SettingsDivider,
    SettingsIcons,
    SettingsNavigationRow,
    SettingsSection
} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {loadDebatesEnabled, readRosterOptIn} from "@/data/debates";
import {getCompanionWords} from "@/loaders/companion-words";
import {getArkWords} from "@/loaders/ark-words";
import {readArkFounderSettings} from "@/data/ark-founders";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {accountStandingValue, currencySelectionLabel, locationVisibilityTitle, recordPrivacySummary} from "@/lib/account-settings";
import {getLocalePath} from "@/lib/site";
import {getSettingsWords} from "@/loaders/settings-words";
import type {Metadata} from "next";
import {appStoreUrl} from "@/lib/store-links";

export const dynamic = "force-dynamic";
export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    return {title: (await getSettingsWords(params.locale)).title};
}

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
    // Ark founders: "Show my name on my Ark animals", only while the server names founders (its switch on).
    const [debatesEnabled, words, founderSettings, {words: arkWords}, w] = await Promise.all([
        loadDebatesEnabled(),
        getCompanionWords(params.locale),
        readArkFounderSettings(),
        getArkWords(params.locale),
        getSettingsWords(params.locale)
    ]);
    const optedIn = debatesEnabled && supabase ? await readRosterOptIn(supabase) : null;

    const anyPush = Object.values(overview.push).some(Boolean);

    return (
        <div className="mx-auto w-full max-w-2xl space-y-5 pb-10">
            <header className="pt-1">
                <h1 className="text-[17px] font-bold text-white md:font-display md:text-3xl">{w.title}</h1>
            </header>

            {/* "Missions", without a count: "29 active missions" read as a to-do list on a first visit. */}
            <SettingsSection>
                <SettingsNavigationRow href="/app/missions" icon={SettingsIcons.missions} title={w.missions} />
                <SettingsDivider />
                <SettingsNavigationRow
                    href="/app/credits"
                    icon={SettingsIcons.credits}
                    title={w.creditsUnlocks}
                    value={overview.isPro ? null : String(overview.creditBalance)}
                />
                {overview.showsEarnings ? (
                    <>
                        <SettingsDivider />
                        <SettingsNavigationRow href="/app/earnings" icon={SettingsIcons.earnings} title={w.earnings} subtitle={w.earningsSubtitle} />
                    </>
                ) : null}
            </SettingsSection>

            {/* What used to be Profile tabs, then what you have given and traded; not on a new account's first visit (JRN-37). */}
            {overview.isNewAccount ? null : (
                <>
                    <SettingsSection>
                        <SettingsNavigationRow href="/app/profile?tab=shop" icon={SettingsIcons.shop} title={w.shop} />
                        <SettingsDivider />
                        <SettingsNavigationRow href="/app/profile?tab=locations" icon={SettingsIcons.location} title={w.locations} />
                        <SettingsDivider />
                        <SettingsNavigationRow href="/app/guides" icon={SettingsIcons.guides} title={w.wildlifeGuides} />
                    </SettingsSection>

                    <SettingsSection>
                        <SettingsNavigationRow href="/app/settings/gifts" icon={SettingsIcons.gift} title={w.gifts} />
                        {overview.showsTrades ? (
                            <>
                                <SettingsDivider />
                                <SettingsNavigationRow href="/app/trades" icon={SettingsIcons.trade} title={w.trades} />
                            </>
                        ) : null}
                    </SettingsSection>
                </>
            )}

            <SettingsSection title={w.sectionPreferences}>
                <SettingsNavigationRow href="/app/settings/notifications" icon={SettingsIcons.bell} title={w.notifications} value={anyPush ? w.on : w.off} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/language" icon={SettingsIcons.globe} title={w.language} value={LANGUAGE_NAMES[params.locale] ?? params.locale.toUpperCase()} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/currency" icon={SettingsIcons.banknote} title={w.currency} value={currencySelectionLabel(overview.currencyPreference, overview.displayCurrency, w)} />
                <SettingsDivider />
                <SoundEffectsRow />
            </SettingsSection>

            {debatesEnabled ? <DebateRosterSection initial={optedIn} words={words} /> : null}

            {founderSettings?.enabled ? (
                <ArkFounderNameSection initial={founderSettings} title={arkWords.eyebrow} words={arkWords.founders.settings} broughtBy={arkWords.founders.card.broughtBy} />
            ) : null}

            <SettingsSection title={w.sectionPrivacy}>
                <SettingsNavigationRow href="/app/settings/location-privacy" icon={SettingsIcons.location} title={w.locationPrivacy} value={locationVisibilityTitle(overview.locationVisibility, w)} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/record-privacy" icon={SettingsIcons.record} title={w.recordPrivacy} value={recordPrivacySummary(overview.recordPrivacy, w)} />
            </SettingsSection>

            <ChatHistorySection />

            {overview.instagramImportOn ? (
                <SettingsSection title={w.sectionConnected}>
                    <InstagramRow />
                </SettingsSection>
            ) : null}

            <SettingsSection title={w.sectionSupport} footer={w.footerWeb}>
                <SettingsNavigationRow href="/support" icon={SettingsIcons.help} title={w.help} />
                <SettingsDivider />
                <SettingsNavigationRow href={`${appStoreUrl}?action=write-review`} external icon={SettingsIcons.star} title={w.rate} />
                <SettingsDivider />
                <SettingsNavigationRow href="/legal/privacy" icon={SettingsIcons.privacy} title={w.privacyPolicy} />
                <SettingsDivider />
                <SettingsNavigationRow href="/legal/terms" icon={SettingsIcons.terms} title={w.terms} />
            </SettingsSection>

            <SettingsSection title={w.sectionAccount}>
                <SettingsNavigationRow href="/app/settings/account" icon={SettingsIcons.person} title={w.account} value={overview.email} />
                <SettingsDivider />
                <SettingsNavigationRow href="/app/settings/account-standing" icon={SettingsIcons.shield} title={w.accountStanding} value={accountStandingValue(overview.standing, w)} />
            </SettingsSection>
        </div>
    );
}
