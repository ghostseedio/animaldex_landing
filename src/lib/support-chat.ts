import "server-only";

import {getCurrentUserId} from "@/data/direct-messages";
import {getSystemSupportProfile} from "@/lib/in-app-support";

export async function getSupportChatHref(draft?: string) {
    const [currentUserId, supportProfile] = await Promise.all([
        getCurrentUserId(),
        getSystemSupportProfile()
    ]);

    const supportUserId = supportProfile?.id ?? null;
    const signedIn = Boolean(currentUserId);

    if (!supportUserId) {
        const next = draft
            ? `/app/messages?draft=${encodeURIComponent(draft)}`
            : "/app/messages";
        return `/account?next=${encodeURIComponent(next)}`;
    }

    const thread = draft
        ? `/app/messages/${encodeURIComponent(supportUserId)}?draft=${encodeURIComponent(draft)}`
        : `/app/messages/${encodeURIComponent(supportUserId)}`;

    return signedIn ? thread : `/account?next=${encodeURIComponent(thread)}`;
}

export function buildSupportChatHrefFromIds(options: {
    supportUserId: string | null;
    signedIn: boolean;
    draft?: string;
}) {
    const {supportUserId, signedIn, draft} = options;

    if (!supportUserId) {
        const next = draft
            ? `/app/messages?draft=${encodeURIComponent(draft)}`
            : "/app/messages";
        return `/account?next=${encodeURIComponent(next)}`;
    }

    const thread = draft
        ? `/app/messages/${encodeURIComponent(supportUserId)}?draft=${encodeURIComponent(draft)}`
        : `/app/messages/${encodeURIComponent(supportUserId)}`;

    return signedIn ? thread : `/account?next=${encodeURIComponent(thread)}`;
}
