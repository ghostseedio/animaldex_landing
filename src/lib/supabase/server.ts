import {createServerClient} from "@supabase/ssr";
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
