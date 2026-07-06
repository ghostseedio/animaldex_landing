import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppEmpty, AppMetric, AppPage, AppPageHeader, AppSectionTitle, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import PowerSetCard from "@/app/[locale]/(authenticated)/app/sets/power-set-card";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {getAppAlbums, getAppCaptures} from "@/data/authenticated-app";
import {syncPowerSetCompletions} from "@/data/power-set-completions";
import {buildPowerSetAlbums, getCatalogPowerSetCount, summarizePowerSets} from "@/data/power-sets";

const SETS_HERO = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/sets-thumbnail.webp";

function setCountLabel(count: number, total: number) {
    return total > 0 ? `${count}/${total}` : String(count);
}

function sortActiveSets(albums: ReturnType<typeof summarizePowerSets>["active"]) {
    return [...albums].sort((left, right) => {
        const leftRank = left.isNearComplete ? 0 : 1;
        const rightRank = right.isNearComplete ? 0 : 1;

        if (leftRank !== rightRank) {
            return leftRank - rightRank;
        }

        if (left.progressPercent !== right.progressPercent) {
            return right.progressPercent - left.progressPercent;
        }

        return left.title.localeCompare(right.title);
    });
}

export default async function SetsPage() {
    const [captures, albums, catalogSetCount] = await Promise.all([
        getAppCaptures(),
        getAppAlbums(),
        getCatalogPowerSetCount()
    ]);
    const powerSets = await buildPowerSetAlbums(captures);
    await syncPowerSetCompletions(powerSets);
    const summary = summarizePowerSets(powerSets);
    const activeSets = sortActiveSets(summary.active);
    const completedSets = [...summary.completed].sort((left, right) => right.found - left.found || left.title.localeCompare(right.title));

    return (
        <AppPage>
            <TrainBackLink />
            <AppPageHeader
                        eyebrow="Collector path"
                        title="Sets"
                        description="Sets scale with catalog size: Bronze 15%, Silver 50%, and Gold 100% of linked animals for each quality."
            />

            <section className="overflow-hidden rounded-[1.4rem] border border-white/10 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)]">
                <div
                    className="relative h-44 bg-cover bg-center"
                    style={{backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.72)), url(${SETS_HERO})`}}
                >
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                        <div>
                            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary-200">Power collections</p>
                            <h2 className="font-display text-2xl font-bold text-white">Quality sets</h2>
                        </div>
                        <AppIcon name="sets" className="h-8 w-8 text-primary-200" />
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-3 gap-3">
                <AppMetric label="In progress" value={setCountLabel(summary.inProgressCount, catalogSetCount)} accent="violet" />
                <AppMetric label="Silver" value={setCountLabel(summary.silverCount, catalogSetCount)} />
                <AppMetric label="Gold" value={setCountLabel(summary.goldCount, catalogSetCount)} accent="gold" />
            </section>

            {activeSets.length === 0 && completedSets.length === 0 ? (
                <AppEmpty
                    icon="sets"
                    title="No power sets yet"
                    detail="Capture animals, build your Wild Profile, or browse Collection → Powers to unlock quality-based sets like Protection or Focus."
                />
            ) : (
                <>
                    {activeSets.length > 0 ? (
                        <section className="space-y-4">
                            <AppSectionTitle icon="sets" title="In progress" detail="Sets surfaced from your Apex path, Best For chart, and starter powers." />
                            <div className="grid gap-4 lg:grid-cols-2">
                                {activeSets.map((album) => (
                                    <PowerSetCard key={album.key} album={album} />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {completedSets.length > 0 ? (
                        <section className="space-y-4">
                            <AppSectionTitle icon="check" title="Completed" detail="Silver sets stay here. Gold mastered sets show a crown badge on the card." />
                            <div className="grid gap-4 lg:grid-cols-2">
                                {completedSets.map((album) => (
                                    <PowerSetCard key={album.key} album={album} />
                                ))}
                            </div>
                        </section>
                    ) : null}
                </>
            )}

            {albums.length > 0 ? (
                <section className="space-y-4">
                    <AppSectionTitle icon="collection" title="Custom albums" />
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {albums.map((album) => (
                            <AppSurface key={album.id}>
                                <AppIcon name="collection" className="h-7 w-7 text-violet-300" />
                                <h3 className="mt-5 font-display text-xl font-bold">{album.name}</h3>
                                <p className="mt-1 text-sm text-white/40">{album.captureIds.length} captures</p>
                            </AppSurface>
                        ))}
                    </div>
                </section>
            ) : null}
        </AppPage>
    );
}
