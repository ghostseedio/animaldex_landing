"use client";

import {createBrowserClient} from "@supabase/ssr";

export function createSupabaseBrowserClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
        ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
        return null;
    }

    return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
