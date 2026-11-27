import {CurrencyList} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {SettingsScreen} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getCurrencyPreference} from "@/data/account-settings";
import {fillSettingsWords} from "@/lib/settings-words";
import {getSettingsWords} from "@/loaders/settings-words";


export const dynamic = "force-dynamic";

/** iOS `SettingsCurrencyView`: a display preference, remembered in this browser. */
export default async function CurrencySettingsPage({params}: {params: {locale: string}}) {
    const {preference, systemCurrency} = getCurrencyPreference();
    const w = await getSettingsWords(params.locale);
    return (
        <SettingsScreen title={w.currency} backLabel={w.settings} backAriaLabel={fillSettingsWords(w.backTo, {label: w.settings})}>
            <CurrencyList preference={preference} systemCurrency={systemCurrency} locale={params.locale} />
        </SettingsScreen>
    );
}
