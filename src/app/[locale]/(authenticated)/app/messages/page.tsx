import {notFound} from "next/navigation";
import MessagesInbox from "@/app/[locale]/(authenticated)/app/messages/messages-inbox";
import {getCurrentUserId, getDirectMessageInbox} from "@/data/direct-messages";
import {directMessageWords} from "@/lib/direct-message-words";
import {loadLocaleMessages} from "@/loaders/locale";

/**
 * Messages with people (iOS `MessagesCenterView`): the inbox in one call
 * (`direct_message_inbox`) with unread counts, pins and mutes. Animal
 * messages live in Companions, as on iOS.
 */
export default async function MessagesPage({params}: {params: {locale: string}}) {
    const [currentUserId, inbox, messages] = await Promise.all([
        getCurrentUserId(),
        getDirectMessageInbox(40),
        loadLocaleMessages(params.locale).catch(() => null)
    ]);
    if (!currentUserId) notFound();

    return (
        <MessagesInbox
            initialInbox={inbox.ok ? inbox.value : null}
            currentUserId={currentUserId}
            locale={params.locale}
            words={directMessageWords(messages?.appMessages)}
        />
    );
}
