import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getProviderEnvNames, getRedirectUri, isProviderConfigured} from "@/lib/social/oauth";
import {deleteConnection, listConnectionRows} from "@/lib/social/store";
import {isSocialPlatform, SOCIAL_PLATFORMS} from "@/lib/social/types";

/** Which official accounts are connected; never returns tokens. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const rows = await listConnectionRows();
        const connections = SOCIAL_PLATFORMS.map((platform) => {
            const row = rows.find((candidate) => candidate.platform === platform);
            return {
                platform,
                configured: isProviderConfigured(platform),
                connected: Boolean(row),
                accountName: row?.account_name ?? null,
                expiresAt: row?.expires_at ?? null,
                envNames: getProviderEnvNames(platform),
                redirectUri: getRedirectUri(platform)
            };
        });
        return NextResponse.json({ok: true, connections});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load connections"}, {status: 500});
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const platform = request.nextUrl.searchParams.get("platform");
    if (!isSocialPlatform(platform)) return NextResponse.json({error: "Unknown platform"}, {status: 400});
    try {
        await deleteConnection(platform);
        return NextResponse.json({ok: true});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to disconnect"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
