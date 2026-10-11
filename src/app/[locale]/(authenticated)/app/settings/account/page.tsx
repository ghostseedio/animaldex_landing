import {redirect} from "next/navigation";
import {ChangePasswordForm, DeleteAccountRow, SignOutRow} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import {SettingsDetailRow, SettingsDivider, SettingsScreen, SettingsSection} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {noEmailFootnote, passwordChangeFootnote} from "@/lib/account-settings";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/** iOS `SettingsAccountView`: sign-in, user id, Sign Out, Delete Account. */
export default async function AccountSettingsPage({params}: {params: {locale: string}}) {
    const overview = await getSettingsOverview();
    if (!overview) redirect(getLocalePath(params.locale, "/account"));
    const methods = overview.signInMethods.join(" · ");

    return (
        <SettingsScreen title="Account">
            <SettingsSection
                title={overview.email ? "SIGN-IN EMAIL" : "SIGN-IN METHOD"}
                footer={overview.canChangePassword ? undefined : passwordChangeFootnote(overview.signInMethods)}
            >
                {overview.email ? (
                    <>
                        <SettingsDetailRow title="Email" value={overview.email} />
                        {methods ? (<><SettingsDivider /><SettingsDetailRow title="Sign-in method" value={methods} /></>) : null}
                    </>
                ) : methods ? (
                    <>
                        <SettingsDetailRow title="Sign-in method" value={methods} />
                        <SettingsDivider />
                        <SettingsDetailRow title="Email" value={noEmailFootnote(overview.signInMethods)} />
                    </>
                ) : (
                    <>
                        <SettingsDetailRow title="Status" value="Signed in" />
                        <SettingsDivider />
                        <SettingsDetailRow title="Email" value="No email is on file for this account." />
                    </>
                )}
            </SettingsSection>

            {overview.canChangePassword ? (
                <section id="change-password" className="-mx-4 border-y border-white/[0.08] bg-[#141414] p-4 md:mx-0 md:rounded-2xl md:border">
                    <h2 className="mb-3 text-[15px] font-bold text-white">Change password</h2>
                    <ChangePasswordForm />
                </section>
            ) : null}

            <SettingsSection footer="Support may ask for this if you report a problem.">
                <SettingsDetailRow title="USER ID" value={overview.userId} selectable />
            </SettingsSection>

            <SignOutRow />
            <DeleteAccountRow />
        </SettingsScreen>
    );
}
