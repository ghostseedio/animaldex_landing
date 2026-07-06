import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const packageName = process.env.ANDROID_APP_PACKAGE?.trim() || "app.animaldex";
    const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    const statements = fingerprints.length > 0 ? [{
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
            namespace: "android_app",
            package_name: packageName,
            sha256_cert_fingerprints: fingerprints
        }
    }] : [];

    return NextResponse.json(statements, {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300, s-maxage=3600"
        }
    });
}
