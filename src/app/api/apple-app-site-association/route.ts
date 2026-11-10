import {NextResponse} from "next/server";
import {appleAppSiteAssociation, appleApplicationId} from "@/lib/apple-app-site-association";

export const dynamic = "force-dynamic";

export async function GET() {
    const applicationId = appleApplicationId({
        applicationId: process.env.APPLE_APPLICATION_IDENTIFIER,
        teamId: process.env.APPLE_TEAM_ID,
        bundleId: process.env.APPLE_BUNDLE_ID
    });
    return NextResponse.json(appleAppSiteAssociation(applicationId), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300, s-maxage=3600"
        }
    });
}
