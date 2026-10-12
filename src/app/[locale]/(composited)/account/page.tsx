import {cookies, headers} from "next/headers";
import {redirect} from "next/navigation";
import {Metadata} from "next";
import AccountLoginForm from "@/app/[locale]/(composited)/account/account-login-form";
import AccountWelcome from "@/app/[locale]/(composited)/account/account-welcome";
import {getAuthenticatedUserId} from "@/data/user-captures";
import {getScopedTranslator} from "@/loaders/translation";
import {WELCOME_OFFERED_LANGUAGES, loadWelcomeIntroLanguage} from "@/loaders/welcome-intro";
import {localeConfig} from "@/i18n";
import {WELCOME_LANGUAGE_COOKIE, resolveWelcomeIntroLanguage} from "@/lib/welcome-intro";

type AccountPageProps = {
    params: {
        locale: string;
    };
    searchParams?: {
        next?: string;
        /** Dev only: play the intro in this language code without changing the locale (`xx` = the local fixture). */
        welcomeLang?: string;
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

/**
 * The intro's language, read on the server so the page renders in it with no
 * flash: a remembered choice for this locale, else (on the unprefixed site)
 * the browser's language, else the site locale. In development `?welcomeLang=`
 * forces any code (`xx` = the local fixture manifest).
 */
function welcomeIntroLanguage(locale: string, forced: string | undefined) {
    if (process.env.NODE_ENV !== "production" && forced && /^[a-z]{2,3}(-[a-z]{2,4})?$/.test(forced)) return forced;
    return resolveWelcomeIntroLanguage({
        locale,
        defaultLocale: localeConfig.defaultLocale,
        cookie: cookies().get(WELCOME_LANGUAGE_COOKIE)?.value,
        acceptLanguage: headers().get("accept-language"),
        offered: WELCOME_OFFERED_LANGUAGES
    });
}

export default async function AccountPage({params, searchParams}: AccountPageProps) {
    const userId = await getAuthenticatedUserId();
    const redirectTo = safeRedirectTarget(searchParams?.next, params.locale);

    if (userId) {
        redirect(redirectTo);
    }

    const [t, intro] = await Promise.all([
        getScopedTranslator(params.locale, "account"),
        loadWelcomeIntroLanguage(welcomeIntroLanguage(params.locale, searchParams?.welcomeLang))
    ]);

    return (
        <AccountWelcome
            headline={t("welcomeHeadline")}
            soundOnLabel={t("welcomeSoundOn")}
            soundOffLabel={t("welcomeSoundOff")}
            locale={params.locale}
            intro={intro}
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
