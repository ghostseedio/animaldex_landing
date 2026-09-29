import type {SupabaseClient} from "@supabase/supabase-js";

const MAX_BOOTSTRAP_ATTEMPTS = 5;

function shouldRetryBootstrap(error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();

    return message.includes("foreign key")
        || message.includes("violates foreign key constraint")
        || message.includes("profiles_id_fkey")
        || message.includes("credit_balances_user_id_fkey")
        || message.includes("auth.users")
        || message.includes("network")
        || message.includes("timeout")
        || message.includes("temporarily unavailable");
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function metadataText(metadata: Record<string, unknown> | undefined, ...keys: string[]) {
    for (const key of keys) {
        const value = metadata?.[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

/**
 * Gives the account a usable display name and handle so no provider has to ask
 * the user to type one. Never overwrites a value the user chose: the function
 * no-ops once both fields are set.
 *
 * The sign-up trigger seeds most accounts, and deliberately leaves the rest —
 * no name in the provider metadata, or only a private relay address — for this
 * call. Without it a web-only account in that group stayed unnamed.
 *
 * Deliberately non-fatal: a profile row already exists at this point, so a
 * failure here means a cosmetic default is missing, which must not be allowed
 * to fail an otherwise successful sign-in.
 */
async function seedProfileIdentityIfNeeded(
    supabase: SupabaseClient,
    user: {id: string; email?: string | null; user_metadata?: Record<string, unknown>}
) {
    try {
        const {error} = await supabase.rpc("ensure_profile_identity", {
            p_user_id: user.id,
            p_full_name: metadataText(user.user_metadata, "full_name", "name"),
            p_email: user.email?.trim() || null
        });
        if (error) console.error("[auth-bootstrap] ensure_profile_identity failed; continuing sign-in", error.message);
    } catch (error) {
        console.error("[auth-bootstrap] ensure_profile_identity failed; continuing sign-in", error);
    }
}

export async function ensureAuthenticatedProfileRows(supabase: SupabaseClient) {
    const {data: {user}, error: userError} = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("Authentication required.");

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_BOOTSTRAP_ATTEMPTS; attempt += 1) {
        const profileResult = await supabase
            .from("profiles")
            .upsert({id: user.id}, {onConflict: "id"});

        if (!profileResult.error) await seedProfileIdentityIfNeeded(supabase, user);

        const creditResult = profileResult.error
            ? {error: null}
            : await supabase
                .from("credit_balances")
                .upsert({user_id: user.id}, {onConflict: "user_id"});

        const error = profileResult.error ?? creditResult.error;

        if (!error) return user.id;

        lastError = error;

        if (attempt === MAX_BOOTSTRAP_ATTEMPTS || !shouldRetryBootstrap(error)) {
            throw error;
        }

        await delay(Math.min(4000, attempt * attempt * 1000));
    }

    throw lastError instanceof Error ? lastError : new Error("Could not initialize account rows.");
}
