import {redirect} from "next/navigation";
import {ChangePasswordForm, DeleteAccountRow, SignOutRow} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {SettingsDetailRow, SettingsDivider, SettingsScreen, SettingsSection} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {localizedSignInMethodLabel, noEmailFootnote, passwordChangeFootnote} from "@/lib/account-settings";
import {fillSettingsWords} from "@/lib/settings-words";
import {getSettingsWords} from "@/loaders/settings-words";

import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/** iOS `SettingsAccountView`: sign-in, user id, Sign Out, Delete Account. */
export default async function AccountSettingsPage({params}: {params: {locale: string}}) {
    const overview = await getSettingsOverview();
    if (!overview) redirect(getLocalePath(params.locale, "/account"));
    const w = await getSettingsWords(params.locale);
    const methods = overview.signInMethods.map((label) => localizedSignInMethodLabel(label, w)).join(" · ");

    return (
        <SettingsScreen title={w.account} backLabel={w.settings} backAriaLabel={fillSettingsWords(w.backTo, {label: w.settings})}>
            <SettingsSection
                title={overview.email ? w.signInEmailHeader : w.signInMethodHeader}
                footer={overview.canChangePassword ? undefined : passwordChangeFootnote(overview.signInMethods, w)}
            >
                {overview.email ? (
                    <>
                        <SettingsDetailRow title={w.email} value={overview.email} />
                        {methods ? (<><SettingsDivider /><SettingsDetailRow title={w.signInMethod} value={methods} /></>) : null}
                    </>
                ) : methods ? (
                    <>
                        <SettingsDetailRow title={w.signInMethod} value={methods} />
                        <SettingsDivider />
                        <SettingsDetailRow title={w.email} value={noEmailFootnote(overview.signInMethods, w)} />
                    </>
                ) : (
                    <>
                        <SettingsDetailRow title={w.status} value={w.signedIn} />
                        <SettingsDivider />
                        <SettingsDetailRow title={w.email} value={w.noEmailOnFile} />
                    </>
                )}
            </SettingsSection>

            {overview.canChangePassword ? (
                <section id="change-password" className="-mx-4 border-y border-white/[0.08] bg-[#141414] p-4 md:mx-0 md:border">
                    <h2 className="mb-3 text-[15px] font-bold text-white">{w.changePassword}</h2>
                    <ChangePasswordForm />
                </section>
            ) : null}

            <SettingsSection footer={w.userIdFooter}>
                <SettingsDetailRow title={w.userId} value={overview.userId} selectable />
            </SettingsSection>

            <SignOutRow />
            <DeleteAccountRow />
        </SettingsScreen>
    );
}
