import Image from "next/image";
import {AppAvatar, AppBadge, AppEmpty, AppListRow, AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {getDirectMessageInbox} from "@/data/direct-messages";
import {getSystemSupportProfile} from "@/lib/in-app-support";
import {formatAppInboxWhen} from "@/lib/app-dates";

export default async function MessagesPage({params}: {params: {locale: string}}) {
    const [inbox, supportProfile] = await Promise.all([
        getDirectMessageInbox(),
        getSystemSupportProfile()
    ]);

    const supportPinned = supportProfile && !inbox.some((summary) => summary.otherUser.userId === supportProfile.id)
        ? [{
            otherUser: {
                userId: supportProfile.id,
                displayName: "AnimalDex Support",
                username: supportProfile.username,
                avatarUrl: supportProfile.avatarUrl ?? "/images/logo.webp",
                href: null,
                isSystem: true
            },
            lastMessage: {
                id: "support-placeholder",
                senderId: supportProfile.id,
                recipientId: "placeholder",
                body: "Official help for scans, captures, accounts and troubleshooting.",
                createdAt: new Date(0).toISOString(),
                readAt: null,
                sender: null,
                recipient: null
            },
            unreadCount: 0
        }]
        : [];

    const rows = [...supportPinned, ...inbox];

    return (
        <AppPage narrow>
            <AppPageHeader
                eyebrow="Community"
                title="Messages"
                description="Direct conversations with collectors and official AnimalDex support."
            />
            {rows.length ? (
                <div className="space-y-3">
                    {rows.map((summary) => (
                        <AppListRow
                            key={summary.otherUser.userId}
                            href={`/app/messages/${encodeURIComponent(summary.otherUser.userId)}`}
                            unread={summary.unreadCount > 0}
                            avatar={
                                summary.otherUser.isSystem ? (
                                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary-400/30 bg-[#071B0F]">
                                        <Image src="/images/logo.webp" alt="" width={32} height={32} className="h-8 w-8 object-contain" />
                                    </span>
                                ) : (
                                    <AppAvatar src={summary.otherUser.avatarUrl} name={summary.otherUser.displayName} />
                                )
                            }
                            title={summary.otherUser.isSystem ? "AnimalDex Support" : summary.otherUser.displayName}
                            subtitle={summary.otherUser.isSystem ? "Official Support" : (summary.otherUser.username ? `@${summary.otherUser.username}` : undefined)}
                            preview={summary.lastMessage.body}
                            meta={summary.lastMessage.createdAt === new Date(0).toISOString() ? undefined : formatAppInboxWhen(summary.lastMessage.createdAt, params.locale)}
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
