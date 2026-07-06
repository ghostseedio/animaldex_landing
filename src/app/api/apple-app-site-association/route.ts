import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

function getAppleApplicationId() {
    const directId = process.env.APPLE_APPLICATION_IDENTIFIER?.trim();
    if (directId) return directId;

    const teamId = process.env.APPLE_TEAM_ID?.trim();
    const bundleId = process.env.APPLE_BUNDLE_ID?.trim();
    return teamId && bundleId ? `${teamId}.${bundleId}` : null;
}

export async function GET() {
    const applicationId = getAppleApplicationId() ?? "U87CQY25JC.com.lennybeadle.animaldexios";
    const details = applicationId ? [{
        appIDs: [applicationId],
        components: [
            {
                "/": "/u/*",
                comment: "Open public AnimalDex collector cards in the app."
            }
        ]
    }] : [];

    return NextResponse.json({
        applinks: {
            apps: [],
            details
        }
    }, {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300, s-maxage=3600"
        }
    });
}
