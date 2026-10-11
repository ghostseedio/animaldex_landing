import {Suspense} from "react";
import {redirect} from "next/navigation";
import MatchupsHub, {type PlayHubSegment} from "@/app/[locale]/(authenticated)/app/matchups/_components/matchups-hub";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getMatchupArenaTarget, getMatchupHubBundle} from "@/data/matchups";
import {fetchSpeciesComparisonSummaries} from "@/data/species-comparisons";
import {getLocalePath} from "@/lib/site";

type ArenaPageProps = {
    params: {locale: string};
    searchParams?: {target?: string; segment?: string};
};

const SEGMENTS: PlayHubSegment[] = ["powers", "comparisons", "history"];

/**
 * The Play tab. On iOS the tab root (`IdentityHomeView`) IS the matchups hub,
 * embedded: Powers, Comparisons and History. The old Featured Matchups hero
 * and Training Modules carousel are gone from the phone, so they are gone here.
 */
export default async function ArenaPage({params, searchParams}: ArenaPageProps) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(getLocalePath(params.locale, "/account"));

    const targetId = searchParams?.target?.trim() || null;
    const requestedSegment = searchParams?.segment?.trim() as PlayHubSegment | undefined;
    const [bundle, popularBreakdowns] = await Promise.all([
        getMatchupHubBundle(context.profile.id),
        fetchSpeciesComparisonSummaries(12).catch(() => [])
    ]);

    let arena = bundle.arena;
    if (targetId && !arena.some((item) => item.captureId === targetId)) {
        const target = await getMatchupArenaTarget(context.profile.id, targetId);
        if (target) {
            arena = [target, ...arena.filter((item) => item.captureId !== targetId)];
        }
    }

    return (
        <Suspense fallback={<div className="py-10 text-sm text-white/45">Loading Play…</div>}>
            <MatchupsHub
                locale={params.locale}
                viewerUserId={context.profile.id}
                initialArena={arena}
                initialRoster={bundle.roster}
                initialHistory={bundle.history}
                initialPopularBreakdowns={popularBreakdowns}
                initialTargetId={targetId}
                initialSegment={requestedSegment && SEGMENTS.includes(requestedSegment) ? requestedSegment : "powers"}
            />
        </Suspense>
    );
}
