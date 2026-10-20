import {getFreshConnection, type OAuthPlatform} from "@/lib/social/oauth";
import type {SocialConnection} from "@/lib/social/types";

async function assertOk(response: Response, platform: OAuthPlatform) {
    if (response.ok) return;
    const status = response.status;
    const description = status === 401 || status === 403
        ? "The platform rejected this connection. Reconnect it in Story Videos."
        : `The platform could not verify this connection (HTTP ${status}).`;
    throw new Error(`${platform}: ${description}`);
}

/** Refreshes expiring credentials and checks that the provider still accepts them. */
export async function checkOAuthConnection(platform: OAuthPlatform): Promise<SocialConnection> {
    const connection = await getFreshConnection(platform);
    if (!connection.accountId) throw new Error(`${platform}: account id is missing; reconnect it in Story Videos.`);
    const signal = AbortSignal.timeout(20_000);
    let response: Response;

    if (platform === "youtube") {
        response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
            headers: {Authorization: `Bearer ${connection.accessToken}`}, signal, cache: "no-store"
        });
    } else if (platform === "x") {
        response = await fetch("https://api.x.com/2/users/me", {
            headers: {Authorization: `Bearer ${connection.accessToken}`}, signal, cache: "no-store"
        });
    } else if (platform === "instagram") {
        response = await fetch(`https://graph.instagram.com/v23.0/me?${new URLSearchParams({fields: "user_id,username", access_token: connection.accessToken})}`, {
            signal, cache: "no-store"
        });
    } else {
        response = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(connection.accountId)}?${new URLSearchParams({fields: "id,name", access_token: connection.accessToken})}`, {
            signal, cache: "no-store"
        });
    }
    await assertOk(response, platform);
    return connection;
}
