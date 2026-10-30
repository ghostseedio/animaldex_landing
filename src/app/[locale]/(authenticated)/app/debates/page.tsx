import {redirect} from "next/navigation";
import DebatesHome from "@/app/[locale]/(authenticated)/app/debates/debates-home";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getMyDebatesPage} from "@/data/debates";
import {getCompanionWords} from "@/loaders/companion-words";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * My debates, open and past, each with how it went (docs/debates/SPEC.md,
 * section 4). Explore has no Debates segment any more: debates start in a
 * chat, public ones pin to the top of the feed, and links to a debate land
 * here. While the server has Debates off there is no such page: Explore's
 * feed instead.
 */
export default async function DebatesPage({params}: {params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(getLocalePath(params.locale, "/account"));
    const [page, words] = await Promise.all([getMyDebatesPage(), getCompanionWords(params.locale)]);
    if (!page.enabled) redirect(getLocalePath(params.locale, "/app/explore"));

    return (
        <div className="mx-auto max-w-3xl pb-10">
            <DebatesHome initialDebates={page.debates} words={words} />
        </div>
    );
}
