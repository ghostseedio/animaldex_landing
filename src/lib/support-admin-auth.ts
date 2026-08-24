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

export type AdminActorKind = "named_email" | "shared_password" | "none";

export type AdminActor = {
    authorized: boolean;
    kind: AdminActorKind;
    email: string | null;
    userId: string | null;
    /** Shared-password sessions are never finance-capable actors. */
    canActAsFinanceActor: boolean;
};

export async function resolveAdminActor(cookieStore: AdminCookieReader): Promise<AdminActor> {
    const url = getSupabaseUrl();
    const key = getSupabaseAuthKey();
    if (url && key) {
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
        const {
            data: {user}
        } = await supabase.auth.getUser();
        const email = user?.email?.trim().toLowerCase() ?? null;
        if (email && getAdminEmails().has(email)) {
            return {
                authorized: true,
                kind: "named_email",
                email,
                userId: user?.id ?? null,
                canActAsFinanceActor: true
            };
        }
    }

    if (verifySupportAdminSession(cookieStore.get(supportAdminCookieName)?.value)) {
        return {
            authorized: true,
            kind: "shared_password",
            email: null,
            userId: null,
            canActAsFinanceActor: false
        };
    }

    return {
        authorized: false,
        kind: "none",
        email: null,
        userId: null,
        canActAsFinanceActor: false
    };
}

export async function isSupportAdminCookieAuthorized(cookieStore: AdminCookieReader) {
    const actor = await resolveAdminActor(cookieStore);
    return actor.authorized;
}

/** Phase 7A: financial approvals require a named human actor, not shared password. */
export async function requireNamedFinanceAdminActor(cookieStore: AdminCookieReader): Promise<AdminActor> {
    const actor = await resolveAdminActor(cookieStore);
    if (!actor.authorized) {
        throw new Error("Unauthorized");
    }
    if (!actor.canActAsFinanceActor || actor.kind !== "named_email" || !actor.email) {
        throw new Error("named_operator_required_for_finance");
    }
    return actor;
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
