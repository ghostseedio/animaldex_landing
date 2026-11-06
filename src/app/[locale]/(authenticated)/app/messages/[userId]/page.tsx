import {notFound} from "next/navigation";
import ConversationClient from "@/app/[locale]/(authenticated)/app/messages/[userId]/conversation-client";
import {
    getCurrentUserId,
    getDirectMessagePartner,
    getDirectMessageThreadPage,
    isDirectMessagePartnerBlocked,
    isDirectMessageUserId
} from "@/data/direct-messages";
import {directMessageWords} from "@/lib/direct-message-words";
import {loadLocaleMessages} from "@/loaders/locale";

/**
 * One conversation (iOS `DirectMessageThreadView`): the newest page first
 * (`direct_message_thread_page`), older pages as you scroll up, and changes
 * since (`direct_message_thread_sync`) while it is open. The server render
 * does not mark anything read; the open page does, as iOS's does.
 */
export default async function MessageThreadPage({
    params,
    searchParams
}: {
    params: {userId: string; locale: string};
    searchParams?: {draft?: string};
}) {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) notFound();

    const partnerId = decodeURIComponent(params.userId).trim().toLowerCase();
    if (!isDirectMessageUserId(partnerId) || partnerId === currentUserId) notFound();

    const [partner, page, blocked, messages] = await Promise.all([
        getDirectMessagePartner(partnerId),
        getDirectMessageThreadPage(partnerId, {limit: 50, markRead: false}),
        isDirectMessagePartnerBlocked(partnerId),
        loadLocaleMessages(params.locale).catch(() => null)
    ]);

    if (!partner) notFound();

    return (
        <ConversationClient
            partner={partner}
            currentUserId={currentUserId}
            initialPage={page.ok ? page.value : null}
            initialDraft={typeof searchParams?.draft === "string" ? searchParams.draft.slice(0, 1000) : ""}
            initiallyBlocked={blocked}
            locale={params.locale}
            words={directMessageWords(messages?.appMessages)}
        />
    );
}
