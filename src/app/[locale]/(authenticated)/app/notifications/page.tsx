import {AppEmpty, AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import NotificationsClient, {listedNotification} from "@/app/[locale]/(authenticated)/app/notifications/notifications-client";
import {getAppNotifications} from "@/data/authenticated-app";
import {getCompanionWords} from "@/loaders/companion-words";

export default async function NotificationsPage({params}: {params: {locale: string}}) {
    const [all, words] = await Promise.all([getAppNotifications(), getCompanionWords(params.locale)]);
    const items = all.filter(listedNotification);

    return (
        <AppPage>
            <AppPageHeader
                eyebrow="Activity"
                title="Notifications"
                description="Likes, endorsements, trade updates, and collection milestones."
            />
            {items.length ? (
                <NotificationsClient
                    items={items}
                    locale={params.locale}
                    debateWords={{title: words.debates.tab, joined: words.debate.voteQuestion, settled: words.debate.reportTitle, draw: words.debate.draw}}
                />
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
