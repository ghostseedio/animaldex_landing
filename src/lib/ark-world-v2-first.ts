/**
 * Imported first by a test that measures the bigger wild island (v2, what islands mode shows): asks `world.ts` for v2
 * before any module samples the world (`askedWorld`), the way `ARK_WORLD=v2` does for a script.
 */
(globalThis as {__ARK_WORLD__?: string}).__ARK_WORLD__ = "v2";
export {};
