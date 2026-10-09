import {createHash, randomBytes} from "crypto";
import {getSiteUrl} from "@/lib/site";
import {pickFacebookPage} from "@/lib/social/facebook-page";
import {needsRefresh} from "@/lib/social/refresh-policy";
import {getConnection, saveConnection} from "@/lib/social/store";
import type {SocialConnection, SocialPlatform} from "@/lib/social/types";

// One OAuth app per platform, connected once by an admin to the official
// AnimalDex account. Each app must list this redirect URI:
//   <site>/api/admin/social/callback/<platform>

type ProviderEnv = {id: string; secret: string};

const ENV_NAMES: Record<SocialPlatform, {id: string; secret: string}> = {
    youtube: {id: "YOUTUBE_OAUTH_CLIENT_ID", secret: "YOUTUBE_OAUTH_CLIENT_SECRET"},
    tiktok: {id: "TIKTOK_CLIENT_KEY", secret: "TIKTOK_CLIENT_SECRET"},
    instagram: {id: "INSTAGRAM_APP_ID", secret: "INSTAGRAM_APP_SECRET"},
    // The Meta app's own ID/secret (App settings → Basic), not the Instagram ones.
    facebook: {id: "FACEBOOK_APP_ID", secret: "FACEBOOK_APP_SECRET"},
    x: {id: "X_OAUTH_CLIENT_ID", secret: "X_OAUTH_CLIENT_SECRET"}
};

const GRAPH_VERSION = "v23.0";

export function getProviderEnvNames(platform: SocialPlatform) {
    return ENV_NAMES[platform];
}

function providerEnv(platform: SocialPlatform): ProviderEnv | null {
    const names = ENV_NAMES[platform];
    const id = process.env[names.id]?.trim();
    const secret = process.env[names.secret]?.trim();
    return id && secret ? {id, secret} : null;
}

export function isProviderConfigured(platform: SocialPlatform) {
    return providerEnv(platform) !== null;
}

function requireEnv(platform: SocialPlatform) {
    const env = providerEnv(platform);
    if (!env) {
        const names = ENV_NAMES[platform];
        throw new Error(`${names.id} and ${names.secret} are not configured`);
    }
    return env;
}

export function getRedirectUri(platform: SocialPlatform) {
    return `${getSiteUrl()}/api/admin/social/callback/${platform}`;
}

export type OAuthStart = {url: string; state: string; verifier: string};

/** The provider's consent URL, plus the state/PKCE verifier the callback must see again. */
export function buildAuthorizeUrl(platform: SocialPlatform): OAuthStart {
    const env = requireEnv(platform);
    const state = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const redirectUri = getRedirectUri(platform);
    let url: URL;
    if (platform === "youtube") {
        url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.search = new URLSearchParams({
            client_id: env.id,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true",
            state
        }).toString();
    } else if (platform === "tiktok") {
        url = new URL("https://www.tiktok.com/v2/auth/authorize/");
        url.search = new URLSearchParams({
            client_key: env.id,
            redirect_uri: redirectUri,
            response_type: "code",
            // Direct posting only: video.upload (send to drafts) was dropped so the
            // TikTok review covers exactly what the app requests.
            scope: "user.info.basic,video.publish",
            state,
            // TikTok requires PKCE and, unlike RFC 7636, hex-encodes the SHA-256.
            code_challenge: createHash("sha256").update(verifier).digest("hex"),
            code_challenge_method: "S256"
        }).toString();
    } else if (platform === "instagram") {
        url = new URL("https://www.instagram.com/oauth/authorize");
        url.search = new URLSearchParams({
            client_id: env.id,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "instagram_business_basic,instagram_business_content_publish",
            state
        }).toString();
    } else if (platform === "facebook") {
        url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
        url.search = new URLSearchParams({
            client_id: env.id,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "pages_show_list,pages_read_engagement,pages_manage_posts",
            state
        }).toString();
    } else {
        url = new URL("https://x.com/i/oauth2/authorize");
        url.search = new URLSearchParams({
            response_type: "code",
            client_id: env.id,
            redirect_uri: redirectUri,
            scope: "tweet.read tweet.write users.read media.write offline.access",
            state,
            code_challenge: challenge,
            code_challenge_method: "S256"
        }).toString();
    }
    return {url: url.toString(), state, verifier};
}

async function readJson(response: Response, what: string) {
    const text = await response.text();
    let body: unknown = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = null;
    }
    if (!response.ok) throw new Error(`${what} failed (${response.status}): ${text.slice(0, 300)}`);
    return body as Record<string, any>;
}

function form(values: Record<string, string>) {
    return {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams(values).toString()
    };
}

function expiresIn(seconds: unknown) {
    const value = Number(seconds);
    return Number.isFinite(value) && value > 0 ? new Date(Date.now() + value * 1000) : null;
}

function xBasicAuth(env: ProviderEnv) {
    return `Basic ${Buffer.from(`${encodeURIComponent(env.id)}:${encodeURIComponent(env.secret)}`).toString("base64")}`;
}

/** Exchanges the callback code for tokens and looks up which account was connected. */
export async function exchangeCode(platform: SocialPlatform, code: string, verifier: string): Promise<SocialConnection> {
    const env = requireEnv(platform);
    const redirectUri = getRedirectUri(platform);

    if (platform === "youtube") {
        const token = await readJson(await fetch("https://oauth2.googleapis.com/token", form({
            code, client_id: env.id, client_secret: env.secret, redirect_uri: redirectUri, grant_type: "authorization_code"
        })), "Google token exchange");
        const channel = await readJson(await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
            headers: {Authorization: `Bearer ${token.access_token}`}
        }), "YouTube channel lookup");
        const item = channel.items?.[0];
        if (!item) throw new Error("That Google account has no YouTube channel");
        return {
            platform, accountId: item.id ?? null, accountName: item.snippet?.title ?? null,
            accessToken: token.access_token, refreshToken: token.refresh_token ?? null,
            expiresAt: expiresIn(token.expires_in), scopes: token.scope ?? null
        };
    }

    if (platform === "tiktok") {
        const token = await readJson(await fetch("https://open.tiktokapis.com/v2/oauth/token/", form({
            client_key: env.id, client_secret: env.secret, code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: verifier
        })), "TikTok token exchange");
        if (token.error) throw new Error(`TikTok token exchange: ${token.error_description ?? token.error}`);
        const info = await readJson(await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
            headers: {Authorization: `Bearer ${token.access_token}`}
        }), "TikTok account lookup");
        return {
            platform, accountId: token.open_id ?? null, accountName: info.data?.user?.display_name ?? null,
            accessToken: token.access_token, refreshToken: token.refresh_token ?? null,
            expiresAt: expiresIn(token.expires_in), scopes: token.scope ?? null
        };
    }

    if (platform === "instagram") {
        const short = await readJson(await fetch("https://api.instagram.com/oauth/access_token", form({
            client_id: env.id, client_secret: env.secret, grant_type: "authorization_code", redirect_uri: redirectUri, code
        })), "Instagram token exchange");
        const shortToken = short.access_token ?? short.data?.[0]?.access_token;
        const long = await readJson(await fetch(`https://graph.instagram.com/access_token?${new URLSearchParams({
            grant_type: "ig_exchange_token", client_secret: env.secret, access_token: shortToken
        })}`), "Instagram long-lived token");
        const me = await readJson(await fetch(`https://graph.instagram.com/v23.0/me?${new URLSearchParams({
            fields: "user_id,username", access_token: long.access_token
        })}`), "Instagram account lookup");
        return {
            platform, accountId: String(me.user_id ?? me.id ?? ""), accountName: me.username ?? null,
            accessToken: long.access_token, refreshToken: null,
            expiresAt: expiresIn(long.expires_in), scopes: "instagram_business_basic,instagram_business_content_publish"
        };
    }

    if (platform === "facebook") {
        const graph = `https://graph.facebook.com/${GRAPH_VERSION}`;
        const short = await readJson(await fetch(`${graph}/oauth/access_token?${new URLSearchParams({
            client_id: env.id, client_secret: env.secret, redirect_uri: redirectUri, code
        })}`), "Facebook token exchange");
        const long = await readJson(await fetch(`${graph}/oauth/access_token?${new URLSearchParams({
            grant_type: "fb_exchange_token", client_id: env.id, client_secret: env.secret, fb_exchange_token: short.access_token
        })}`), "Facebook long-lived token");
        // A Page token derived from a long-lived user token does not expire.
        const pages = await readJson(await fetch(`${graph}/me/accounts?${new URLSearchParams({
            fields: "id,name,access_token,tasks", limit: "100", access_token: long.access_token
        })}`), "Facebook Page lookup");
        const page = pickFacebookPage(pages.data ?? [], process.env.FACEBOOK_PAGE_ID?.trim() || null);
        if (!page) throw new Error("No Facebook Page found for that login; pick the AnimalDex Page when Facebook asks which Pages to allow");
        return {
            platform, accountId: page.id, accountName: page.name ?? null,
            accessToken: page.access_token, refreshToken: null,
            expiresAt: null, scopes: "pages_show_list,pages_read_engagement,pages_manage_posts"
        };
    }

    const token = await readJson(await fetch("https://api.x.com/2/oauth2/token", {
        ...form({code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: verifier, client_id: env.id}),
        headers: {"Content-Type": "application/x-www-form-urlencoded", Authorization: xBasicAuth(env)}
    }), "X token exchange");
    const me = await readJson(await fetch("https://api.x.com/2/users/me", {
        headers: {Authorization: `Bearer ${token.access_token}`}
    }), "X account lookup");
    return {
        platform, accountId: me.data?.id ?? null, accountName: me.data?.username ? `@${me.data.username}` : null,
        accessToken: token.access_token, refreshToken: token.refresh_token ?? null,
        expiresAt: expiresIn(token.expires_in), scopes: token.scope ?? null
    };
}

async function refresh(connection: SocialConnection): Promise<SocialConnection> {
    const env = requireEnv(connection.platform);
    const {platform} = connection;

    if (platform === "instagram") {
        const token = await readJson(await fetch(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
            grant_type: "ig_refresh_token", access_token: connection.accessToken
        })}`), "Instagram token refresh");
        return {...connection, accessToken: token.access_token, expiresAt: expiresIn(token.expires_in)};
    }

    if (platform === "facebook" || !connection.refreshToken) throw new Error(`${platform} session expired; reconnect it in /admin/story-videos`);

    if (platform === "youtube") {
        const token = await readJson(await fetch("https://oauth2.googleapis.com/token", form({
            client_id: env.id, client_secret: env.secret, refresh_token: connection.refreshToken, grant_type: "refresh_token"
        })), "Google token refresh");
        return {...connection, accessToken: token.access_token, refreshToken: token.refresh_token ?? connection.refreshToken, expiresAt: expiresIn(token.expires_in)};
    }

    if (platform === "tiktok") {
        const token = await readJson(await fetch("https://open.tiktokapis.com/v2/oauth/token/", form({
            client_key: env.id, client_secret: env.secret, grant_type: "refresh_token", refresh_token: connection.refreshToken
        })), "TikTok token refresh");
        if (token.error) throw new Error(`TikTok token refresh: ${token.error_description ?? token.error}`);
        return {...connection, accessToken: token.access_token, refreshToken: token.refresh_token ?? connection.refreshToken, expiresAt: expiresIn(token.expires_in)};
    }

    const token = await readJson(await fetch("https://api.x.com/2/oauth2/token", {
        ...form({grant_type: "refresh_token", refresh_token: connection.refreshToken, client_id: env.id}),
        headers: {"Content-Type": "application/x-www-form-urlencoded", Authorization: xBasicAuth(env)}
    }), "X token refresh");
    // X rotates refresh tokens: the old one stops working once this succeeds.
    return {...connection, accessToken: token.access_token, refreshToken: token.refresh_token ?? connection.refreshToken, expiresAt: expiresIn(token.expires_in)};
}

/** The stored connection with a usable access token, refreshing (and saving) it if needed. */
export async function getFreshConnection(platform: SocialPlatform): Promise<SocialConnection> {
    const connection = await getConnection(platform);
    if (!connection) throw new Error(`${platform} is not connected`);
    if (!needsRefresh(connection)) return connection;
    const refreshed = await refresh(connection);
    await saveConnection(refreshed);
    return refreshed;
}
