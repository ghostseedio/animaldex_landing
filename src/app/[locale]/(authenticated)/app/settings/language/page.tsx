import Link from "@/app/[locale]/_components/link";
import {SelectedMark, SettingsDivider, SettingsIcon, SettingsIcons, SettingsScreen, SettingsSection} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {localeConfig} from "@/i18n";

const LANGUAGES: Record<string, {native: string; english: string}> = {
    en: {native: "English", english: "English"},
    id: {native: "Bahasa Indonesia", english: "Indonesian"}
};

/**
 * iOS `SettingsLanguageView`. The web is translated into the languages its
 * site is published in; choosing one moves to that locale's address.
 */
export default function LanguageSettingsPage({params}: {params: {locale: string}}) {
    return (
        <SettingsScreen title="Language">
            <SettingsSection title="ALL LANGUAGES" footer="Choose the language used for AnimalDex controls and labels.">
                {localeConfig.locales.map((locale, index) => {
                    const language = LANGUAGES[locale] ?? {native: locale.toUpperCase(), english: locale.toUpperCase()};
                    const selected = locale === params.locale;
                    return (
                        <div key={locale}>
                            {index > 0 ? <SettingsDivider /> : null}
                            <Link href="/app/settings/language" locale={locale} className="flex min-h-12 items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04]" aria-current={selected ? "true" : undefined}>
                                <SettingsIcon>{selected ? <SelectedMark selected /> : SettingsIcons.character}</SettingsIcon>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] font-semibold text-white">{language.native}</span>
                                    {language.english !== language.native ? <span className="mt-0.5 block text-[11px] text-white/40">{language.english}</span> : null}
                                </span>
                            </Link>
                        </div>
                    );
                })}
            </SettingsSection>
        </SettingsScreen>
    );
}
