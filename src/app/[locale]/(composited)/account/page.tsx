import {redirect} from "next/navigation";
import {Metadata} from "next";
import AccountLoginForm from "@/app/[locale]/(composited)/account/account-login-form";
import AccountWelcome from "@/app/[locale]/(composited)/account/account-welcome";
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

export const metadata: Metadata = {
    title: "Sign in",
    robots: {index: false, follow: false}
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
        <AccountWelcome
            headline={t("welcomeHeadline")}
            soundOnLabel={t("welcomeSoundOn")}
            soundOffLabel={t("welcomeSoundOff")}
        >
            <AccountLoginForm
                redirectTo={redirectTo}
                labels={{
                    emailLabel: t("emailLabel"),
                    passwordLabel: t("passwordLabel"),
                    submit: t("submit"),
                    loading: t("loading"),
                    errorGeneric: t("errorGeneric"),
                    browseAnimalsLink: t("browseAnimalsLink"),
                    downloadPrompt: t("downloadPrompt"),
                    downloadApp: t("downloadApp"),
                    loginFormTitle: t("loginFormTitle"),
                    continueWithGoogle: t("continueWithGoogle"),
                    continueWithApple: t("continueWithApple"),
                    emailSeparator: t("emailSeparator")
                }}
            />
        </AccountWelcome>
    );
}
