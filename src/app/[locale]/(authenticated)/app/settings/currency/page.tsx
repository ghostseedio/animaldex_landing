import {CurrencyList} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {SettingsScreen} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getCurrencyPreference} from "@/data/account-settings";

export const dynamic = "force-dynamic";

/** iOS `SettingsCurrencyView`: a display preference, remembered in this browser. */
export default function CurrencySettingsPage() {
    const {preference, systemCurrency} = getCurrencyPreference();
    return (
        <SettingsScreen title="Currency">
            <CurrencyList preference={preference} systemCurrency={systemCurrency} />
        </SettingsScreen>
    );
}
