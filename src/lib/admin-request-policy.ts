/**
 * Cross-site request policy for `/api/admin`.
 *
 * The operator cookie is SameSite=Lax, which already keeps it off cross-site
 * POSTs in every current browser. This is the second lock: a state-changing
 * request that a browser marks as coming from another site is refused before
 * any handler runs, whatever the cookie did. Non-browser callers (the
 * schedulers with a bearer secret, the self-heal route calling itself) send
 * neither header and pass through to the handler's own authorisation.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type AdminRequestOrigin = {
    method: string;
    origin: string | null;
    secFetchSite: string | null;
    /** Every host this deployment answers as: Host, X-Forwarded-Host, the canonical site URL. */
    allowedHosts: ReadonlyArray<string | null | undefined>;
};

export type AdminRequestVerdict = {allowed: true} | {allowed: false; reason: string};

function hostOf(value: string | null | undefined) {
    if (!value) return null;
    try {
        return new URL(value.includes("://") ? value : `https://${value}`).host.toLowerCase();
    } catch {
        return null;
    }
}

export function evaluateAdminApiRequest(input: AdminRequestOrigin): AdminRequestVerdict {
    if (SAFE_METHODS.has(input.method.toUpperCase())) {
        return {allowed: true};
    }

    if (input.secFetchSite?.toLowerCase() === "cross-site") {
        return {allowed: false, reason: "cross-site"};
    }

    if (input.origin == null) {
        return {allowed: true};
    }

    const origin = hostOf(input.origin);
    if (!origin) {
        return {allowed: false, reason: "opaque-origin"};
    }

    for (const candidate of input.allowedHosts) {
        const host = hostOf(candidate);
        if (host && host === origin) {
            return {allowed: true};
        }
    }

    return {allowed: false, reason: "foreign-origin"};
}

export function isAdminApiPath(pathname: string) {
    return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}
