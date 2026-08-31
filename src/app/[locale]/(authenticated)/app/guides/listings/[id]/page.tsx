import {redirect} from "next/navigation";
import ListingEditorClient from "@/app/[locale]/(authenticated)/app/guides/listings/[id]/listing-editor-client";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {mapOwnedGuideListing} from "@/lib/guide-marketplace-seller";
import {isUuid} from "@/lib/guide-marketplace-admin";

export const dynamic = "force-dynamic";

export default async function GuideListingEditorPage({params}: {params: {locale: string; id: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(`/${params.locale}/account?next=${encodeURIComponent(`/${params.locale}/app/guides/listings/${params.id}`)}`);

    if (params.id === "new") {
        return <ListingEditorClient listing={null} />;
    }

    if (!isUuid(params.id)) redirect(`/${params.locale}/app/guides`);

    const supabase = createSupabaseServerClient();
    if (!supabase) redirect(`/${params.locale}/app/guides`);

    const {data} = await supabase
        .from("guide_listings")
        .select("*")
        .eq("id", params.id)
        .eq("seller_user_id", context.profile.id)
        .maybeSingle();

    if (!data) redirect(`/${params.locale}/app/guides`);

    return <ListingEditorClient listing={mapOwnedGuideListing(data as Record<string, unknown>)} />;
}
