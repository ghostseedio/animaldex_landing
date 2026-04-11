function readTrimmedEnv(name: string) {
    const value = process.env[name]?.trim();

    return value ? value : null;
}

export function normalizeSupabaseUrl(rawValue: string | undefined) {
    const value = rawValue?.trim();

    if (!value) {
        return null;
    }

    if (value.startsWith("http://") || value.startsWith("https://")) {
        return value;
    }

    if (value.includes(".supabase.co")) {
        return `https://${value}`;
    }

    return null;
}

export function getSupabaseUrl() {
    return normalizeSupabaseUrl(readTrimmedEnv("SUPABASE_URL") ?? readTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL") ?? undefined);
}

export function getSupabasePublicKey() {
    return readTrimmedEnv("SUPABASE_ANON_KEY")
        ?? readTrimmedEnv("SUPABASE_PUBLISHABLE_KEY")
        ?? readTrimmedEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        ?? readTrimmedEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function getSupabaseServiceKey() {
    return readTrimmedEnv("SUPABASE_SERVICE_ROLE_KEY")
        ?? readTrimmedEnv("SUPABASE_SECRET_KEY")
        ?? readTrimmedEnv("SUPABASE_SERVICE_KEY");
}

export function getSupabaseServerReadKey() {
    return getSupabaseServiceKey() ?? getSupabasePublicKey();
}

function shouldSendBearerToken(key: string) {
    return key.startsWith("eyJ");
}

export function getSupabaseHeaders(key: string, extraHeaders?: Record<string, string>) {
    const headers: Record<string, string> = {
        apikey: key,
        ...extraHeaders
    };

    if (shouldSendBearerToken(key)) {
        headers.Authorization = `Bearer ${key}`;
    }

    return headers;
}
