import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";

/**
 * Brute-force protection for the operator sign-in endpoints.
 *
 * Two sliding windows run together:
 *   - per client: a handful of attempts per quarter hour, which an operator
 *     with a typo never reaches;
 *   - everyone: a hard ceiling across all clients, so an attacker who rotates
 *     the forwarded address (the per-client key is only as trustworthy as the
 *     proxy that sets it) still cannot run a dictionary against the password.
 *
 * The limiter is per process, so it throttles rather than caps on a multi-node
 * deploy. The production site runs one container, where it is exact.
 */
const WINDOW_MS = 15 * 60 * 1000;
const PER_CLIENT_LIMIT = 8;
const GLOBAL_LIMIT = 60;

export type AdminLoginThrottle = {
    allowed: boolean;
    retryAfterSeconds: number;
};

export function throttleAdminLogin(request: Request, scope: string): AdminLoginThrottle {
    const client = getRequestIdentifier(request);
    const perClient = checkRateLimit(`admin-login:${scope}:${client}`, PER_CLIENT_LIMIT, WINDOW_MS);
    if (!perClient.allowed) {
        return {allowed: false, retryAfterSeconds: perClient.retryAfterSeconds};
    }

    const global = checkRateLimit(`admin-login:${scope}:*`, GLOBAL_LIMIT, WINDOW_MS);
    if (!global.allowed) {
        return {allowed: false, retryAfterSeconds: global.retryAfterSeconds};
    }

    return {allowed: true, retryAfterSeconds: 0};
}

export function adminLoginThrottledResponse(throttle: AdminLoginThrottle) {
    return new Response(JSON.stringify({ok: false, error: "Too many sign-in attempts. Try again later."}), {
        status: 429,
        headers: {
            "Content-Type": "application/json",
            "Retry-After": String(throttle.retryAfterSeconds),
            "Cache-Control": "private, no-store"
        }
    });
}
