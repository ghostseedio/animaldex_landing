import {notFound, redirect} from "next/navigation";
import GuideEditorClient from "@/app/[locale]/(authenticated)/app/guides/[id]/guide-editor-client";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getMyWildlifeGuide} from "@/data/virtual-wildlife-guides";
import {isUuid} from "@/lib/virtual-wildlife-guides";

export const dynamic = "force-dynamic";

export default async function GuideEditorPage({params}: {params: {locale: string; id: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(`/${params.locale}/account?next=${encodeURIComponent(`/${params.locale}/app/guides/${params.id}`)}`);
    if (!isUuid(params.id)) notFound();
    const guide = await getMyWildlifeGuide(params.id);
    if (!guide) notFound();
    return <GuideEditorClient initial={guide} />;
}
