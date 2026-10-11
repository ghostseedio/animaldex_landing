import {redirect} from "next/navigation";
import {getLocalePath} from "@/lib/site";

/**
 * The matchup hub is the Play tab itself now (iOS `IdentityHomeView` embeds
 * `MatchupsHubView`). Old links — "Compare" on a card, a shared target — land
 * on its Comparisons page, the way iOS's `requestOpenPlayComparisons` does.
 */
export default function MatchupsPage({params, searchParams}: {params: {locale: string}; searchParams?: {target?: string}}) {
    const query = new URLSearchParams({segment: "comparisons"});
    const target = searchParams?.target?.trim();
    if (target) query.set("target", target);
    redirect(getLocalePath(params.locale, `/app/arena?${query.toString()}`));
}
