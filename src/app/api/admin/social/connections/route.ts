import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getProviderEnvNames, getRedirectUri, isOAuthPlatform, isProviderConfigured} from "@/lib/social/oauth";
import {checkOAuthConnection} from "@/lib/social/connection-health";
import {deleteConnection, listConnectionRows} from "@/lib/social/store";
import {isSocialPlatform, SOCIAL_PLATFORMS, type ZernioPlatform} from "@/lib/social/types";
import {describeZernioError, getTikTokAccount, isZernioApiConfigured, isZernioConfigured, listZernioAccounts, pinterestBoard, ZERNIO_ENV, zernioAccountFor, ZernioError} from "@/lib/social/zernio";

const ZERNIO_DASHBOARD = "https://zernio.com/dashboard";

/** TikTok is connected in Zernio, not here: report whether that connection answers. */
async function tiktokConnection() {
    const configured = isZernioConfigured();
    let accountName: string | null = null;
    let error: string | null = null;
    let reachable = true;
    if (configured) {
        try {
            accountName = (await getTikTokAccount()).nickname;
        } catch (cause) {
            error = describeZernioError(cause);
            // A daily posting cap (429) or a Zernio outage is not a broken connection:
            // the dialog still opens and shows the warning.
            reachable = cause instanceof ZernioError && (cause.kind === "rate_limited" || cause.kind === "unavailable");
        }
    }
    return {
        platform: "tiktok" as const,
        provider: "zernio" as const,
        configured,
        connected: configured && (error === null || reachable),
        accountName,
        expiresAt: null,
        envNames: {id: ZERNIO_ENV.apiKey, secret: ZERNIO_ENV.accountId},
        redirectUri: null,
        manageUrl: ZERNIO_DASHBOARD,
        error
    };
}

/** Pinterest, Threads and Bluesky: connected in Zernio; we only need its API key and an account there. */
async function zernioConnection(platform: Exclude<ZernioPlatform, "tiktok">) {
    const configured = isZernioApiConfigured();
    let found = false;
    let accountName: string | null = null;
    let board: string | null = null;
    let error: string | null = null;
    if (configured) {
        try {
            const account = await zernioAccountFor(platform);
            found = true;
            accountName = account.username;
            if (platform === "pinterest") {
                const chosen = await pinterestBoard(account.id, true);
                board = chosen ? chosen.name ?? chosen.id : null;
                if (!chosen) error = "This Pinterest account has no board; make one with \"animal\" in its name and pins go there.";
            }
        } catch (cause) {
            // No account yet reads "Not connected", not "Needs attention".
            if (!(cause instanceof ZernioError && cause.kind === "not_found")) error = describeZernioError(cause);
        }
    }
    return {
        platform,
        provider: "zernio" as const,
        configured,
        connected: found && error === null,
        accountName,
        board,
        expiresAt: null,
        envNames: {id: ZERNIO_ENV.apiKey, secret: `ZERNIO_${platform.toUpperCase()}_ACCOUNT_ID (optional)`},
        redirectUri: null,
        manageUrl: ZERNIO_DASHBOARD,
        error
    };
}

/** Which official accounts are connected; never returns tokens. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const rows = await listConnectionRows();
        // Tokens from the rejected TikTok developer app: never read again, so drop them on sight.
        if (rows.some((row) => row.platform === "tiktok")) {
            await deleteConnection("tiktok");
            console.info("[social-share] removed the stored TikTok OAuth tokens; TikTok now posts through Zernio");
        }
        // A fresh list, so an account just connected in Zernio shows on this load, not
        // after the five-minute cache. A failure resurfaces in each platform's check.
        if (isZernioApiConfigured()) await listZernioAccounts(true).catch(() => undefined);
        const connections = await Promise.all(SOCIAL_PLATFORMS.map(async (platform) => {
            if (platform === "tiktok") return tiktokConnection();
            if (!isOAuthPlatform(platform)) return zernioConnection(platform);
            const row = rows.find((candidate) => candidate.platform === platform);
            if (!row) {
                return {
                    platform,
                    provider: "oauth" as const,
                    configured: isProviderConfigured(platform),
                    connected: false,
                    accountName: null,
                    expiresAt: null,
                    envNames: getProviderEnvNames(platform),
                    redirectUri: getRedirectUri(platform),
                    manageUrl: null,
                    error: null
                };
            }
            let error: string | null = null;
            let expiresAt = row.expires_at;
            try {
                expiresAt = (await checkOAuthConnection(platform)).expiresAt?.toISOString() ?? null;
            } catch (cause) {
                error = cause instanceof Error ? cause.message : "Unable to verify this connection.";
            }
            return {
                platform,
                provider: "oauth" as const,
                configured: isProviderConfigured(platform),
                connected: error === null,
                accountName: row?.account_name ?? null,
                expiresAt,
                envNames: getProviderEnvNames(platform),
                redirectUri: getRedirectUri(platform),
                manageUrl: null,
                error
            };
        }));
        return NextResponse.json({ok: true, connections});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load connections"}, {status: 500});
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const platform = request.nextUrl.searchParams.get("platform");
    if (!isSocialPlatform(platform)) return NextResponse.json({error: "Unknown platform"}, {status: 400});
    if (!isOAuthPlatform(platform)) return NextResponse.json({error: "This platform is managed in Zernio"}, {status: 400});
    try {
        await deleteConnection(platform);
        return NextResponse.json({ok: true});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to disconnect"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
