import {Suspense} from "react";
import {redirect} from "next/navigation";
import ExploreSegments from "@/app/[locale]/(authenticated)/app/_components/explore-segments";
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
 * Explore's Battles (docs/companion-loop/SPEC.md, phase 4; it was the Play
 * tab): the matchups hub, embedded as on iOS: Powers, Comparisons and History.
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
        <Suspense fallback={<div className="py-10 text-sm text-white/45">Loading Battles…</div>}>
            <div className="mx-auto mb-4 max-w-3xl">
                <ExploreSegments active="battles" />
            </div>
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
