// The environment for child processes (ffmpeg) spawned by the server.
//
// Next's standalone server.js puts the whole serialized next.config in
// process.env.__NEXT_PRIVATE_STANDALONE_CONFIG, including every resolved
// redirect (~290 KB with 2,000+ redirects, Oct 2026). Linux rejects any single
// environment string over 128 KB, so every spawn failed with "spawn E2BIG".
// Children never need Next's private variables, and anything else that large
// is dropped for the same reason.

const MAX_ENV_STRING = 32 * 1024;

export function childProcessEnv(env: Record<string, string | undefined> = process.env): NodeJS.ProcessEnv {
    return Object.fromEntries(
        Object.entries(env).filter(([key, value]) => !key.startsWith("__NEXT_PRIVATE") && (value?.length ?? 0) < MAX_ENV_STRING)
    ) as NodeJS.ProcessEnv;
}
