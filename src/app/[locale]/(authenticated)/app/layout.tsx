import AppShell from "@/app/[locale]/(authenticated)/app/_components/app-shell";
import {AppCreditsProvider} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {getAuthenticatedAppShellData} from "@/data/authenticated-app";
import {createDevRequestTimer, finishDevRequestTimer, timeDevStep} from "@/lib/dev-request-timing";

export const metadata = {robots: {index: false, follow: false}};

export default async function AuthenticatedAppLayout({children}: {children: React.ReactNode; params: {locale: string}}) {
    const timer = createDevRequestTimer("app.layout");
    const {context, notifications, unreadMessageCount, creditBalance} = await timeDevStep(
        timer,
        "shell-data",
        () => getAuthenticatedAppShellData()
    );
    finishDevRequestTimer(timer, {authenticated: Boolean(context)});

    return (
        <AppCreditsProvider initialBalance={creditBalance}>
            <AppShell
                profile={context ? {displayName: context.profile.displayName ?? context.profile.username ?? "Collector", username: context.profile.username, avatarUrl: context.profile.avatarUrl} : null}
                isAuthenticated={Boolean(context)}
                unreadCount={notifications.filter((item) => !item.readAt).length}
                unreadMessageCount={unreadMessageCount}
            >
                {children}
            </AppShell>
        </AppCreditsProvider>
    );
}
