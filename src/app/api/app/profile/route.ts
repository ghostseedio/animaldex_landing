import {NextResponse} from "next/server";
import {
    BIO_CHARACTER_LIMIT,
    isDuplicateUsernameError,
    moderationRejection,
    normalizeInstagramUrl,
    normalizeOptionalText,
    normalizeUsername,
    usernameFormatProblem
} from "@/lib/profile-editor";
import {createSupabaseServerClient} from "@/lib/supabase/server";

const PROFILE_PRESETS = new Set(["spirit", "friend", "professional", "business"]);
const GRID_SORTS = new Set(["recent", "index"]);

/**
 * Profile writes for the signed-in user.
 *
 * - `{chromePreset}` alone: the profile style (kept for older clients).
 * - `{action: "update", …}`: iOS `ProfileEditorView` → `updateCurrentProfile`:
 *   moderation filter, username availability, then one `profiles` update of
 *   display name, username, avatar, bio, Instagram, style and grid sort.
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    if (body.action !== "update") {
        const chromePreset = String(body.chromePreset ?? "").trim().toLowerCase();
        if (!PROFILE_PRESETS.has(chromePreset)) {
            return NextResponse.json({error: "A valid profile style is required."}, {status: 400});
        }
        const {error} = await supabase.from("profiles").update({chrome_preset: chromePreset}).eq("id", user.id);
        if (error) return NextResponse.json({error: error.message}, {status: 400});
        return NextResponse.json({ok: true, chromePreset});
    }

    const displayName = String(body.displayName ?? "").trim();
    if (!displayName) return NextResponse.json({error: "Display name cannot be empty."}, {status: 400});

    const username = normalizeUsername(String(body.username ?? ""));
    if (!username) return NextResponse.json({error: "Username cannot be empty."}, {status: 400});
    const formatProblem = usernameFormatProblem(username);
    if (formatProblem?.kind === "invalid") return NextResponse.json({error: "Enter a valid username."}, {status: 400});
    if (formatProblem?.kind === "taken") return NextResponse.json({error: "That username is already taken."}, {status: 409});

    const bio = String(body.bio ?? "");
    if (Array.from(bio.trim()).length > BIO_CHARACTER_LIMIT) {
        return NextResponse.json({error: `Keep your bio to ${BIO_CHARACTER_LIMIT} characters.`}, {status: 400});
    }
    const instagram = String(body.instagramUrl ?? "");
    const chromePreset = String(body.chromePreset ?? "professional");
    const captureGridSort = String(body.captureGridSort ?? "recent");
    if (!PROFILE_PRESETS.has(chromePreset) || !GRID_SORTS.has(captureGridSort)) {
        return NextResponse.json({error: "A valid profile style is required."}, {status: 400});
    }

    const rejection = moderationRejection([displayName, username, bio, instagram].join(" "));
    if (rejection) return NextResponse.json({error: rejection}, {status: 400});

    const {data: rows} = await supabase.from("profiles").select("id").ilike("username", username).limit(2);
    if ((rows ?? []).some((row) => row.id !== user.id)) {
        return NextResponse.json({error: "That username is already taken."}, {status: 409});
    }

    // The avatar is only ever one this user uploaded (or none).
    const avatarUrl = normalizeOptionalText(typeof body.avatarUrl === "string" ? body.avatarUrl : null);
    if (avatarUrl && !avatarUrl.includes(`/avatars/${user.id.toLowerCase()}/`)) {
        return NextResponse.json({error: "Could not prepare the avatar image."}, {status: 400});
    }

    const {error} = await supabase.from("profiles").update({
        display_name: displayName,
        username,
        avatar_url: avatarUrl,
        bio: normalizeOptionalText(bio),
        instagram_url: normalizeInstagramUrl(instagram),
        chrome_preset: chromePreset,
        capture_grid_sort: captureGridSort
    }).eq("id", user.id);

    if (error) {
        if (isDuplicateUsernameError(error.message)) return NextResponse.json({error: "That username is already taken."}, {status: 409});
        return NextResponse.json({error: error.message}, {status: 400});
    }
    return NextResponse.json({ok: true, username});
}
