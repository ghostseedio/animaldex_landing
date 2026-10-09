import type {SocialConnection} from "@/lib/social/types";

/** Instagram tokens live 60 days and are refreshed in their last week; the rest a few minutes early. */
export function needsRefresh(connection: SocialConnection, now = Date.now()) {
    if (!connection.expiresAt) return false;
    const margin = connection.platform === "instagram" ? 7 * 86_400_000 : 5 * 60_000;
    return connection.expiresAt.getTime() - now < margin;
}
