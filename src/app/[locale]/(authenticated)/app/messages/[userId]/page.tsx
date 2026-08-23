import {notFound} from "next/navigation";
import ConversationClient from "@/app/[locale]/(authenticated)/app/messages/[userId]/conversation-client";
import {getCurrentUserId, getDirectMessageConversation, getDirectMessagePartner} from "@/data/direct-messages";

export default async function MessageThreadPage({
    params,
    searchParams
}: {
    params: {userId: string; locale: string};
    searchParams?: {draft?: string};
}) {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) notFound();

    const partnerId = params.userId.trim();
    if (!partnerId || partnerId === currentUserId) notFound();

    const [partner, messages] = await Promise.all([
        getDirectMessagePartner(partnerId),
        getDirectMessageConversation(partnerId)
    ]);

    if (!partner) notFound();

    return (
        <ConversationClient
            partner={partner}
            currentUserId={currentUserId}
            initialMessages={messages}
            initialDraft={typeof searchParams?.draft === "string" ? searchParams.draft.slice(0, 1000) : ""}
            locale={params.locale}
        />
    );
}
