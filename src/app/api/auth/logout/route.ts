import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";

export async function POST() {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAuthKey = getSupabaseAuthKey();

    if (!supabaseUrl || !supabaseAuthKey) {
        return NextResponse.json({ok: true});
    }

    const cookieStore = cookies();
    const response = NextResponse.json({ok: true});

    const supabase = createServerClient(supabaseUrl, supabaseAuthKey, {
        cookies: {
            get(name) {
                return cookieStore.get(name)?.value;
            },
            set(name, value, options) {
                cookieStore.set({name, value, ...options});
                response.cookies.set({name, value, ...options});
            },
            remove(name, options) {
                cookieStore.set({name, value: "", ...options});
                response.cookies.set({name, value: "", ...options});
            }
        }
    });

    await supabase.auth.signOut();

    return response;
}
