import {NextResponse} from "next/server";
import {assetLinksStatements} from "@/lib/assetlinks";

export const dynamic = "force-dynamic";

export async function GET() {
    const statements = assetLinksStatements({
        packageName: process.env.ANDROID_APP_PACKAGE,
        fingerprints: process.env.ANDROID_SHA256_CERT_FINGERPRINTS
    });

    return NextResponse.json(statements, {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300, s-maxage=3600"
        }
    });
}
