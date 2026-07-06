import {AppEmpty, AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import NotificationsClient from "@/app/[locale]/(authenticated)/app/notifications/notifications-client";
import {getAppNotifications} from "@/data/authenticated-app";

export default async function NotificationsPage({params}: {params: {locale: string}}) {
    const items = await getAppNotifications();

    return (
        <AppPage>
            <AppPageHeader
                eyebrow="Activity"
                title="Notifications"
                description="Likes, endorsements, trade updates, and collection milestones."
            />
            {items.length ? (
                <NotificationsClient items={items} locale={params.locale} />
            ) : (
                <AppEmpty
                    icon="bell"
                    title="No notifications yet"
                    detail="When your public captures get noticed or a collector sends an offer, you will see it here."
                />
            )}
        </AppPage>
    );
}
