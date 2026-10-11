import {redirect} from "next/navigation";
import ProfileEditor from "@/app/[locale]/(authenticated)/app/profile/edit/profile-editor";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = {title: "Edit Profile"};

/** iOS `ProfileEditorView`, opened by the profile header's pencil. */
export default async function EditProfilePage({params}: {params: {locale: string}}) {
    const supabase = createSupabaseServerClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (!supabase || !user) redirect(getLocalePath(params.locale, "/account"));

    const {data} = await supabase
        .from("profiles")
        .select("display_name,username,avatar_url,bio,instagram_url,chrome_preset,capture_grid_sort")
        .eq("id", user.id)
        .maybeSingle();
    const row = (data ?? {}) as Record<string, string | null>;
    const preset = row.chrome_preset;

    return (
        <ProfileEditor
            initial={{
                displayName: row.display_name ?? "",
                username: row.username ?? "",
                avatarUrl: row.avatar_url ?? "",
                bio: row.bio ?? "",
                instagramUrl: row.instagram_url ?? "",
                chromePreset: preset === "spirit" || preset === "friend" || preset === "business" ? preset : "professional",
                captureGridSort: row.capture_grid_sort === "index" ? "index" : "recent"
            }}
            isRequired={!row.username}
        />
    );
}
