import {notFound} from "next/navigation";
import NotificationsClient from "@/app/[locale]/(authenticated)/app/notifications/notifications-client";
import {getCurrentUserId} from "@/data/direct-messages";
import {getNotificationsPage} from "@/data/notifications";
import {notificationWords} from "@/lib/notification-words";
import {loadLocaleMessages} from "@/loaders/locale";

/** Notifications (iOS `NotificationsView`): the first page of All, then the client pages and filters. */
export default async function NotificationsPage({params}: {params: {locale: string}}) {
    const [currentUserId, page, messages] = await Promise.all([
        getCurrentUserId(),
        getNotificationsPage("all", 0),
        loadLocaleMessages(params.locale).catch(() => null)
    ]);
    if (!currentUserId) notFound();

    return (
        <NotificationsClient
            initialPage={page.ok ? page.value : null}
            currentUserId={currentUserId}
            locale={params.locale}
            words={notificationWords(messages?.appNotifications)}
        />
    );
}
