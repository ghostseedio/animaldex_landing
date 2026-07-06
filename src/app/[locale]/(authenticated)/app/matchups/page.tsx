import {Suspense} from "react";
import MatchupsHub from "@/app/[locale]/(authenticated)/app/matchups/_components/matchups-hub";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getMatchupArenaTarget, getMatchupHubBundle} from "@/data/matchups";
import {redirect} from "next/navigation";

type MatchupsPageProps = {
    params: {locale: string};
    searchParams?: {target?: string};
};

export default async function MatchupsPage({params, searchParams}: MatchupsPageProps) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(`/${params.locale}/account`);

    const targetId = searchParams?.target?.trim() ?? null;
    const bundle = await getMatchupHubBundle(context.profile.id);

    let arena = bundle.arena;
    if (targetId && !arena.some((item) => item.captureId === targetId)) {
        const target = await getMatchupArenaTarget(context.profile.id, targetId);
        if (target) {
            arena = [target, ...arena.filter((item) => item.captureId !== targetId)];
        }
    }

    return (
        <Suspense fallback={<div className="py-10 text-sm text-white/45">Loading matchup arena…</div>}>
            <MatchupsHub
                locale={params.locale}
                viewerUserId={context.profile.id}
                initialArena={arena}
                initialRoster={bundle.roster}
                initialHistory={bundle.history}
                initialTargetId={targetId}
            />
        </Suspense>
    );
}
