import {redirect} from "next/navigation";
import {SettingsDetailRow, SettingsDivider, SettingsScreen, SettingsSection} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {accountStandingFooter, accountStandingValue} from "@/lib/account-settings";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/** iOS `SettingsAccountStandingView` (RPC `my_account_standing`). */
export default async function AccountStandingPage({params}: {params: {locale: string}}) {
    const overview = await getSettingsOverview();
    if (!overview) redirect(getLocalePath(params.locale, "/account"));
    const {standing} = overview;

    return (
        <SettingsScreen title="Account standing">
            <SettingsSection title="STATUS" footer={accountStandingFooter(standing)}>
                <SettingsDetailRow title="Standing" value={accountStandingValue(standing)} />
                <SettingsDivider />
                <SettingsDetailRow title="Strikes" value={`${standing.strikeCount} / ${standing.maxStrikes}`} />
            </SettingsSection>
            {standing.strikes.length ? (
                <SettingsSection title="STRIKES">
                    {standing.strikes.map((strike, index) => (
                        <div key={strike.id}>
                            {index > 0 ? <SettingsDivider /> : null}
                            <div className="px-4 py-3">
                                <p className="text-[15px] font-semibold text-white">{strike.reason}</p>
                                {strike.createdAt ? (
                                    <p className="mt-0.5 text-xs text-white/40">
                                        {new Date(strike.createdAt).toLocaleString(params.locale, {dateStyle: "medium", timeStyle: "short"})}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </SettingsSection>
            ) : null}
        </SettingsScreen>
    );
}
