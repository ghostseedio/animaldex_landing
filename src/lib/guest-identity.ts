import {createHash, randomUUID} from "crypto";
import {cookies} from "next/headers";

export const GUEST_COOKIE_NAME = "animaldex_guest";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function hashGuestId(rawId: string) {
    return createHash("sha256").update(`animaldex:${rawId}`).digest("hex");
}

/** Stable per-browser key for guest votes. Never stores a raw IP. */
export function readGuestKey(): string | null {
    const rawId = cookies().get(GUEST_COOKIE_NAME)?.value?.trim();
    return rawId ? hashGuestId(rawId) : null;
}

export function createGuestIdentity() {
    const rawId = randomUUID();
    return {
        rawId,
        guestKey: hashGuestId(rawId),
        cookie: {
            name: GUEST_COOKIE_NAME,
            value: rawId,
            httpOnly: true,
            sameSite: "lax" as const,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: GUEST_COOKIE_MAX_AGE
        }
    };
}
