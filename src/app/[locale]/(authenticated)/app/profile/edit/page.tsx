import {redirect} from "next/navigation";
import ProfileEditor, {type ProfileEditorWords} from "@/app/[locale]/(authenticated)/app/profile/edit/profile-editor";
import {parseCaptureGridSort} from "@/lib/profile-editor";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getLocalePath} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

export const dynamic = "force-dynamic";
export const metadata = {title: "Edit Profile"};

const WORD_KEYS: Array<keyof ProfileEditorWords> = [
    "title", "requiredTitle", "back", "save", "saving", "intro",
    "changePhoto", "addPhoto", "profilePhoto", "chooseFromLibrary", "takePhoto", "removePhoto", "cancel",
    "basicInfo", "name", "namePlaceholder", "username", "usernamePlaceholder", "bio", "bioPlaceholder",
    "instagram", "instagramPlaceholder", "checking", "available", "taken",
    "captureGrid", "gridRecent", "gridRecentDetail", "gridIndex", "gridIndexDetail", "gridStars", "gridStarsDetail",
    "gridCustom", "gridCustomDetail", "customNone", "customOne", "customMany",
    "discardTitle", "discard", "keepEditing"
];

/** iOS `ProfileEditorView`, opened by the profile header's pencil. */
export default async function EditProfilePage({params}: {params: {locale: string}}) {
    const supabase = createSupabaseServerClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (!supabase || !user) redirect(getLocalePath(params.locale, "/account"));

    const [{data}, t] = await Promise.all([
        supabase
            .from("profiles")
            .select("display_name,username,avatar_url,bio,instagram_url,capture_grid_sort,capture_grid_capture_ids")
            .eq("id", user.id)
            .maybeSingle(),
        getScopedTranslator(params.locale, "profile")
    ]);
    const row = (data ?? {}) as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    const words = Object.fromEntries(WORD_KEYS.map((key) => [key, t(`editor.${key}`)])) as ProfileEditorWords;

    return (
        <ProfileEditor
            initial={{
                displayName: text(row.display_name),
                username: text(row.username),
                avatarUrl: text(row.avatar_url),
                bio: text(row.bio),
                instagramUrl: text(row.instagram_url),
                // Every grid the apps save (recent, index, stars, custom) comes back as it is.
                captureGridSort: parseCaptureGridSort(row.capture_grid_sort)
            }}
            isRequired={!text(row.username)}
            customCaptureCount={Array.isArray(row.capture_grid_capture_ids) ? row.capture_grid_capture_ids.length : 0}
            words={words}
        />
    );
}
