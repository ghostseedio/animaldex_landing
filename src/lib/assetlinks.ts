/**
 * Android App Links: the statement `/.well-known/assetlinks.json` serves so
 * Android verifies `app.animaldex` for animaldex.app links (/p, /u/).
 *
 * The fingerprints are public (anyone can read them off the installed app),
 * so they live here as the fallback: without them the file was `[]` and
 * every link opened the browser. `ANDROID_SHA256_CERT_FINGERPRINTS` still
 * overrides them when set.
 */
export const defaultAndroidPackageName = "app.animaldex";

export const defaultAndroidSha256CertFingerprints = [
    // Play Console › App integrity › App signing key (what Play installs).
    "0E:89:02:D7:B0:04:E1:8F:56:EA:DF:14:6B:E7:D2:74:65:6E:40:E4:E3:43:FF:5E:40:8A:4B:85:5D:9B:DC:DB",
    // Upload key (builds installed outside Play, e.g. internal sharing).
    "7A:2A:42:E9:CB:78:5E:8B:19:D6:21:3C:D2:1D:16:C5:75:8E:60:03:26:A1:77:4C:F2:47:C4:03:51:5E:85:D1",
];

export function assetLinksStatements(env: {packageName?: string; fingerprints?: string}) {
    const packageName = env.packageName?.trim() || defaultAndroidPackageName;
    const fromEnv = (env.fingerprints || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    const fingerprints = fromEnv.length > 0 ? fromEnv : defaultAndroidSha256CertFingerprints;
    return [{
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
            namespace: "android_app",
            package_name: packageName,
            sha256_cert_fingerprints: fingerprints
        }
    }];
}
