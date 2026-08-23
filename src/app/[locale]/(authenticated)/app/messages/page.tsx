import {AppAvatar, AppBadge, AppEmpty, AppListRow, AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {getDirectMessageInbox} from "@/data/direct-messages";
import {formatAppInboxWhen} from "@/lib/app-dates";

export default async function MessagesPage({params}: {params: {locale: string}}) {
    const inbox = await getDirectMessageInbox();

    return (
        <AppPage narrow>
            <AppPageHeader
                eyebrow="Community"
                title="Messages"
                description="Direct conversations with collectors and official AnimalDex support."
            />
            {inbox.length ? (
                <div className="space-y-3">
                    {inbox.map((summary) => (
                        <AppListRow
                            key={summary.otherUser.userId}
                            href={`/app/messages/${encodeURIComponent(summary.otherUser.userId)}`}
                            unread={summary.unreadCount > 0}
                            avatar={<AppAvatar src={summary.otherUser.avatarUrl} name={summary.otherUser.displayName} />}
                            title={summary.otherUser.displayName}
                            subtitle={summary.otherUser.isSystem ? "Official AnimalDex support" : (summary.otherUser.username ? `@${summary.otherUser.username}` : undefined)}
                            preview={summary.lastMessage.body}
                            meta={formatAppInboxWhen(summary.lastMessage.createdAt, params.locale)}
                            badge={summary.otherUser.isSystem
                                ? <AppBadge tone="success">{summary.unreadCount ? `Official · ${summary.unreadCount}` : "Official"}</AppBadge>
                                : summary.unreadCount ? <AppBadge tone="success">{summary.unreadCount}</AppBadge> : undefined}
                        />
                    ))}
                </div>
            ) : (
                <AppEmpty
                    icon="message"
                    title="No messages yet"
                    detail="Open another collector's profile and tap Message, or contact AnimalDex from Help."
                />
            )}
        </AppPage>
    );
}
