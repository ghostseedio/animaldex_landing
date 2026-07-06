import {createServerClient} from "@supabase/ssr";
import {type NextRequest, NextResponse} from "next/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";

export async function updateSupabaseSession(request: NextRequest, response: NextResponse) {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAuthKey = getSupabaseAuthKey();

    if (!supabaseUrl || !supabaseAuthKey) {
        return response;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAuthKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet, headers) {
                cookiesToSet.forEach(({name, value, options}) => {
                    request.cookies.set({name, value, ...options});
                    response.cookies.set({name, value, ...options});
                });

                for (const [key, value] of Object.entries(headers)) {
                    response.headers.set(key, value);
                }
            }
        }
    });

    await supabase.auth.getUser();

    return response;
}
