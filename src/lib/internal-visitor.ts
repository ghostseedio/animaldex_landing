/**
 * Marks the operator's own browsers so the website's own measurements
 * (/api/ark-events today) can leave them out. Any browser that opens a signed-in
 * /admin page gets the cookie for a year (InternalVisitorMark, in the admin
 * layout); the events route reads it. It identifies nobody: it only says
 * "this browser belongs to the team".
 */
export const INTERNAL_VISITOR_COOKIE = "animaldex_internal";
export const INTERNAL_VISITOR_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function internalVisitorCookie(secure: boolean): string {
    return `${INTERNAL_VISITOR_COOKIE}=1; Max-Age=${INTERNAL_VISITOR_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}
