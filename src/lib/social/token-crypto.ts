import {createCipheriv, createDecipheriv, createHash, randomBytes} from "crypto";

// OAuth tokens for the official social accounts are encrypted before they are
// written to Supabase, so a leaked row (or a mis-granted table) is not a live
// credential. AES-256-GCM, key derived from a server secret.

function keyFor(secret: string) {
    return createHash("sha256").update(`animaldex-social-tokens:${secret}`).digest();
}

function encryptionKey() {
    const secret = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim()
        || process.env.SUPPORT_ADMIN_SESSION_SECRET?.trim()
        || "";
    if (!secret) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured");
    return keyFor(secret);
}

export function encryptToken(plain: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

function decryptWithKey(sealed: string, key: Buffer) {
    const [version, iv, tag, body] = sealed.split(".");
    if (version !== "v1" || !iv || !tag || !body) throw new Error("Unrecognised token format");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

export function decryptTokenWithKeyInfo(sealed: string) {
    const socialSecret = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim();
    const supportSecret = process.env.SUPPORT_ADMIN_SESSION_SECRET?.trim();
    const keys = [
        ...(socialSecret ? [{key: keyFor(socialSecret), source: "social" as const}] : []),
        ...(supportSecret && supportSecret !== socialSecret ? [{key: keyFor(supportSecret), source: "support" as const}] : [])
    ];
    if (keys.length === 0) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured");
    for (const candidate of keys) {
        try {
            return {
                token: decryptWithKey(sealed, candidate.key),
                needsReencryption: candidate.source === "support" && Boolean(socialSecret)
            };
        } catch {
            // Older rows may have been sealed with SUPPORT_ADMIN_SESSION_SECRET
            // before the dedicated social-token key was configured.
        }
    }
    throw new Error("Unable to decrypt saved social connection; reconnect the account");
}

export function decryptToken(sealed: string) {
    return decryptTokenWithKeyInfo(sealed).token;
}
