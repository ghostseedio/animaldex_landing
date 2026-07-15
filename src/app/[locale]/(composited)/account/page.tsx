import {redirect} from "next/navigation";
import AccountLoginForm from "@/app/[locale]/(composited)/account/account-login-form";
import {getAuthenticatedUserId} from "@/data/user-captures";
import {getScopedTranslator} from "@/loaders/translation";

type AccountPageProps = {
    params: {
        locale: string;
    };
    searchParams?: {
        next?: string;
    };
};

function safeRedirectTarget(next: string | undefined, locale: string) {
    if (!next || !next.startsWith("/") || next.startsWith("//")) {
        return `/${locale}/app`;
    }

    if (next.includes("://")) {
        return `/${locale}/app`;
    }

    return next;
}

export default async function AccountPage({params, searchParams}: AccountPageProps) {
    const userId = await getAuthenticatedUserId();
    const redirectTo = safeRedirectTarget(searchParams?.next, params.locale);

    if (userId) {
        redirect(redirectTo);
    }

    const t = await getScopedTranslator(params.locale, "account");

    return (
        <section className="mx-auto w-full max-w-[88rem] px-4 py-12 md:px-8 md:py-20">
            <AccountLoginForm
                redirectTo={redirectTo}
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
