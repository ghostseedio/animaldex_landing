import "server-only";
import {createHmac, timingSafeEqual} from "crypto";
import {getSupabaseServiceKey} from "@/lib/supabase-http";

type CaptureSessionPayload = {sub: string; nonce: string; iat: number; exp: number};

/**
 * How long after the shutter a live capture can still be sent. The token is
 * issued at the shutter press on the server's clock, so this is what proves
 * freshness. It used to be 90 s, with a separate 30 s check against the
 * phone's own clock that rejected anyone who read the review for half a
 * minute, or whose clock was off.
 */
export const WEB_CAPTURE_SESSION_TTL_SECONDS = 180;

function secret() {
    const value = getSupabaseServiceKey();
    if (!value) throw new Error("Capture signing is not configured.");
    return value;
}

function signature(payload: string) {
    return createHmac("sha256", secret()).update(`animaldex-web-live-capture:${payload}`).digest("base64url");
}

export function createWebCaptureSession(userId: string) {
    const now = Math.floor(Date.now() / 1000);
    const payload: CaptureSessionPayload = {sub: userId, nonce: crypto.randomUUID(), iat: now, exp: now + WEB_CAPTURE_SESSION_TTL_SECONDS};
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encoded}.${signature(encoded)}`;
}

export function verifyWebCaptureSession(token: string, userId: string) {
    const [encoded, suppliedSignature] = token.split(".");
    if (!encoded || !suppliedSignature) return false;
    const expected = signature(encoded);
    const suppliedBuffer = Buffer.from(suppliedSignature);
    const expectedBuffer = Buffer.from(expected);
    if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return false;
    try {
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CaptureSessionPayload;
        const now = Math.floor(Date.now() / 1000);
        return payload.sub === userId && payload.iat <= now + 5 && payload.exp >= now && payload.exp - payload.iat <= WEB_CAPTURE_SESSION_TTL_SECONDS;
    } catch {
        return false;
    }
}
