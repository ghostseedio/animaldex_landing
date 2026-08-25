import {createServerClient} from "@supabase/ssr";
import {createClient} from "@supabase/supabase-js";
import {cookies} from "next/headers";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";

export function createSupabaseServerClient() {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAuthKey = getSupabaseAuthKey();

    if (!supabaseUrl || !supabaseAuthKey) {
        return null;
    }

    const cookieStore = cookies();

    return createServerClient(supabaseUrl, supabaseAuthKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({name, value, options}) => {
                        cookieStore.set({name, value, ...options});
                    });
                } catch {
                    // Server Components cannot mutate cookies. Session refresh runs in middleware.
                }
            }
        }
    });
}

/**
 * Cookie-free server client for public catalog reads. Using `cookies()` here
 * would dynamize ISR/SEO pages even for anonymous crawlers.
 */
export function createSupabasePublicClient() {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAuthKey = getSupabaseAuthKey();

    if (!supabaseUrl || !supabaseAuthKey) {
        return null;
    }

    return createClient(supabaseUrl, supabaseAuthKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
}
