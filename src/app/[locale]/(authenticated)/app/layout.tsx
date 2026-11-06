import AppShell from "@/app/[locale]/(authenticated)/app/_components/app-shell";
import {AppCreditsProvider} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {WebStoreAvailabilityProvider} from "@/app/[locale]/(authenticated)/app/_components/web-store-availability";
import {paddleProductAvailability} from "@/lib/paddle-server";
import {getAuthenticatedAppShellData} from "@/data/authenticated-app";
import {createDevRequestTimer, finishDevRequestTimer, timeDevStep} from "@/lib/dev-request-timing";
import {loadLocaleMessages} from "@/loaders/locale";
import {appShellWords} from "@/lib/app-shell-words";
import {getCompanionWords} from "@/loaders/companion-words";

export const metadata = {robots: {index: false, follow: false}};

export default async function AuthenticatedAppLayout({children, params}: {children: React.ReactNode; params: {locale: string}}) {
    const timer = createDevRequestTimer("app.layout");
    const [{context, notifications, unreadMessageCount, creditBalance}, messages, companionWords] = await Promise.all([
        timeDevStep(timer, "shell-data", () => getAuthenticatedAppShellData()),
        loadLocaleMessages(params.locale).catch(() => null),
        getCompanionWords(params.locale)
    ]);
    finishDevRequestTimer(timer, {authenticated: Boolean(context)});

    return (
        <AppCreditsProvider initialBalance={creditBalance}>
            <WebStoreAvailabilityProvider availability={paddleProductAvailability()}>
                <AppShell
                    profile={context ? {displayName: context.profile.displayName ?? context.profile.username ?? "Collector", username: context.profile.username, avatarUrl: context.profile.avatarUrl} : null}
                    isAuthenticated={Boolean(context)}
                    unreadCount={notifications.filter((item) => !item.readAt).length}
                    unreadMessageCount={unreadMessageCount}
                    words={appShellWords(messages?.appShell)}
                    companionWords={companionWords}
                >
                    {children}
                </AppShell>
            </WebStoreAvailabilityProvider>
        </AppCreditsProvider>
    );
}
