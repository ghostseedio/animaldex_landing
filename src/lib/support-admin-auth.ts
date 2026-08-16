import {createHmac, randomBytes, timingSafeEqual} from "crypto";
import {createServerClient} from "@supabase/ssr";
import {NextRequest} from "next/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";

export const supportAdminCookieName = "animaldex_support_admin";

const sessionMaxAgeSeconds = 12 * 60 * 60;

function getSupportAdminPassword() {
    return process.env.SUPPORT_ADMIN_PASSWORD?.trim()
        || process.env.ADMIN_SUPPORT_PASSWORD?.trim()
        || "";
}

function getSupportAdminSessionSecret() {
    return process.env.SUPPORT_ADMIN_SESSION_SECRET?.trim()
        || process.env.NEXTAUTH_SECRET?.trim()
        || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        || "";
}

function signSessionPayload(payload: string) {
    const secret = getSupportAdminSessionSecret();

    if (!secret) {
        throw new Error("SUPPORT_ADMIN_SESSION_SECRET is not configured");
    }

    return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isSupportAdminAuthConfigured() {
    return Boolean(getSupportAdminPassword() && getSupportAdminSessionSecret());
}

export function verifySupportAdminPassword(password: string) {
    const configuredPassword = getSupportAdminPassword();

    if (!configuredPassword) {
        return false;
    }

    return safeEqual(password, configuredPassword);
}

export function createSupportAdminSession() {
    const expiresAt = Date.now() + sessionMaxAgeSeconds * 1000;
    const nonce = randomBytes(16).toString("base64url");
    const payload = `${expiresAt}.${nonce}`;
    const signature = signSessionPayload(payload);

    return `${payload}.${signature}`;
}

export function verifySupportAdminSession(session: string | undefined) {
    if (!session) {
        return false;
    }

    const parts = session.split(".");

    if (parts.length !== 3) {
        return false;
    }

    const [expiresAtValue, nonce, signature] = parts;
    const expiresAt = Number(expiresAtValue);

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !nonce || !signature) {
        return false;
    }

    try {
        return safeEqual(signature, signSessionPayload(`${expiresAtValue}.${nonce}`));
    } catch {
        return false;
    }
}

function getAdminEmails() {
    return new Set([
        "lennybeadle@gmail.com",
        ...(process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
            .split(",")
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean)
    ]);
}

/**
 * The cookies an authorization check needs, in the shape both a route handler's
 * NextRequest and a server component's `cookies()` already provide.
 */
type AdminCookieReader = {
    get(name: string): {value: string} | undefined;
    getAll(): Array<{name: string; value: string}>;
};

export async function isSupportAdminRequestAuthorized(request: NextRequest) {
    return isSupportAdminCookieAuthorized(request.cookies);
}

export async function isSupportAdminCookieAuthorized(cookieStore: AdminCookieReader) {
    if (verifySupportAdminSession(cookieStore.get(supportAdminCookieName)?.value)) {
        return true;
    }

    const url = getSupabaseUrl();
    const key = getSupabaseAuthKey();
    if (!url || !key) return false;

    const supabase = createServerClient(url, key, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll() {
                // Authorization checks never mutate the browser session.
            }
        }
    });
    const {data: {user}} = await supabase.auth.getUser();
    const email = user?.email?.trim().toLowerCase();
    return Boolean(email && getAdminEmails().has(email));
}

export function getSupportAdminCookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: sessionMaxAgeSeconds
    };
}
