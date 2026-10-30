import {redirect} from "next/navigation";
import ExploreSegments from "@/app/[locale]/(authenticated)/app/_components/explore-segments";
import DebatesHome from "@/app/[locale]/(authenticated)/app/debates/debates-home";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getMyDebatesPage} from "@/data/debates";
import {getCompanionWords} from "@/loaders/companion-words";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Explore's Debates (docs/debates/SPEC.md, section 4), replacing Battles: My
 * debates, open and past, each with how it went. While the server has
 * Debates off there is no such page: Explore's feed instead.
 */
export default async function DebatesPage({params}: {params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(getLocalePath(params.locale, "/account"));
    const [page, words] = await Promise.all([getMyDebatesPage(), getCompanionWords(params.locale)]);
    if (!page.enabled) redirect(getLocalePath(params.locale, "/app/explore"));

    return (
        <div className="mx-auto max-w-3xl pb-10">
            <div className="mb-4">
                <ExploreSegments active="debates" debatesLabel={words.debates.tab} />
            </div>
            <DebatesHome initialDebates={page.debates} words={words} />
        </div>
    );
}
