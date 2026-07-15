import AppShell from "@/app/[locale]/(authenticated)/app/_components/app-shell";
import {AppCreditsProvider} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {getAuthenticatedAppContext, getAppCreditBalance, getAppNotifications, type AppNotification} from "@/data/authenticated-app";
import {getDirectMessageUnreadCount} from "@/data/direct-messages";

export const metadata = {robots: {index: false, follow: false}};

export default async function AuthenticatedAppLayout({children, params}: {children: React.ReactNode; params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    const [notifications, unreadMessageCount, creditBalance] = context
        ? await Promise.all([
            getAppNotifications(),
            getDirectMessageUnreadCount(),
            getAppCreditBalance()
        ])
        : [[], 0, null] as [AppNotification[], number, number | null];

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
