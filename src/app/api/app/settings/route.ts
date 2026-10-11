import {NextResponse} from "next/server";
import {LOCATION_VISIBILITY_OPTIONS, PUSH_PREFERENCE_COLUMNS, type PushPreferences} from "@/lib/account-settings";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * The Settings tab's in-place controls, written to the same `profiles`
 * columns iOS writes:
 * - `{action: "locationVisibility", value}` → `location_visibility`
 *   (iOS `SettingsLocationPrivacyView`, `SupabaseProfileService.updateLocationVisibility`)
 * - `{action: "push", key, enabled}` → `push_*_enabled`
 *   (iOS `SettingsNotificationsView` alert types)
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({})) as {action?: string; value?: string; key?: string; enabled?: boolean};

    let update: Record<string, unknown> | null = null;
    if (body.action === "locationVisibility") {
        const value = LOCATION_VISIBILITY_OPTIONS.find((option) => option.id === body.value)?.id;
        if (value) update = {location_visibility: value};
    } else if (body.action === "push" && typeof body.enabled === "boolean" && body.key && body.key in PUSH_PREFERENCE_COLUMNS) {
        update = {[PUSH_PREFERENCE_COLUMNS[body.key as keyof PushPreferences]]: body.enabled};
    }

    if (!update) return NextResponse.json({error: "Unsupported setting."}, {status: 400});

    const {error} = await supabase.from("profiles").update(update).eq("id", user.id);
    if (error) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json({ok: true});
}
