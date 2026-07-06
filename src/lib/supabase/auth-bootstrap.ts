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

export async function ensureAuthenticatedProfileRows(supabase: SupabaseClient) {
    const {data: {user}, error: userError} = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("Authentication required.");

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_BOOTSTRAP_ATTEMPTS; attempt += 1) {
        const profileResult = await supabase
            .from("profiles")
            .upsert({id: user.id}, {onConflict: "id"});

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
