import {redirect} from "next/navigation";
import AppShell from "@/app/[locale]/(authenticated)/app/_components/app-shell";
import {getAuthenticatedAppContext, getAppNotifications} from "@/data/authenticated-app";
import {getDirectMessageUnreadCount} from "@/data/direct-messages";

export const metadata = {robots: {index: false, follow: false}};

export default async function AuthenticatedAppLayout({children, params}: {children: React.ReactNode; params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(`/${params.locale}/account`);
    const [notifications, unreadMessageCount] = await Promise.all([
        getAppNotifications(),
        getDirectMessageUnreadCount()
    ]);
    return <AppShell profile={{displayName: context.profile.displayName ?? context.profile.username ?? "Collector", username: context.profile.username, avatarUrl: context.profile.avatarUrl}} unreadCount={notifications.filter((item) => !item.readAt).length} unreadMessageCount={unreadMessageCount}>{children}</AppShell>;
}
