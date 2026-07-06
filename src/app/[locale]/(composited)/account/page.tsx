import {redirect} from "next/navigation";
import AccountLoginForm from "@/app/[locale]/(composited)/account/account-login-form";
import {getAuthenticatedUserId} from "@/data/user-captures";
import {getScopedTranslator} from "@/loaders/translation";

type AccountPageProps = {
    params: {
        locale: string;
    };
};

export default async function AccountPage({params}: AccountPageProps) {
    const userId = await getAuthenticatedUserId();

    if (userId) {
        redirect(`/${params.locale}/app`);
    }

    const t = await getScopedTranslator(params.locale, "account");

    return (
        <section className="mx-auto w-full max-w-[88rem] px-4 py-12 md:px-8 md:py-20">
            <AccountLoginForm
                redirectTo={`/${params.locale}/app`}
                labels={{
                    eyebrow: t("loginEyebrow"),
                    title: t("loginTitle"),
                    description: t("loginDescription"),
                    emailLabel: t("emailLabel"),
                    passwordLabel: t("passwordLabel"),
                    submit: t("submit"),
                    loading: t("loading"),
                    errorGeneric: t("errorGeneric"),
                    supportOne: t("loginSupportOne"),
                    supportTwo: t("loginSupportTwo"),
                    supportThree: t("loginSupportThree"),
                    browseAnimalsLink: t("browseAnimalsLink"),
                    downloadPrompt: t("downloadPrompt"),
                    downloadApp: t("downloadApp"),
                    backHome: t("backHome"),
                    loginFormTitle: t("loginFormTitle"),
                    loginCardLabel: t("loginCardLabel"),
                    continueWithGoogle: t("continueWithGoogle"),
                    continueWithApple: t("continueWithApple"),
                    emailSeparator: t("emailSeparator")
                }}
            />
        </section>
    );
}
