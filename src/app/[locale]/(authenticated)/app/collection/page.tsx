import {AppPage, AppPageHeader, AppPrimaryLink, AppProgress, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import CollectionCatalog, {CatalogSpecies} from "@/app/[locale]/(authenticated)/app/collection/collection-catalog";
import {getAppCaptures} from "@/data/authenticated-app";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {getBehavioralPrincipleProfile} from "@/data/species-behavioral-principles";
import {getSpeciesImageRoute} from "@/data/species-images";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";

export default async function CollectionPage() {
    const captures = await getAppCaptures();
    const catalogEntries = await getUnifiedSpeciesEntries();
    const captureBySlug = new Map(captures.filter((capture) => capture.speciesSlug).map((capture) => [capture.speciesSlug!, capture]));
    const species: CatalogSpecies[] = catalogEntries.map((entry) => {
        const capture = captureBySlug.get(entry.slug) ?? captureBySlug.get(entry.normalizedIdentityKey ?? "");
        const principle = getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence);
        const animalDexNumber = getAnimalDexNumberFromEntry(entry);
        return {
            slug: entry.slug,
            name: entry.name,
            scientificName: entry.analysis.scientificName,
            category: entry.analysis.category,
            number: animalDexNumber ?? Number.MAX_SAFE_INTEGER,
            rarity: entry.analysis.rarityScore,
            gameStats: entry.databaseSource?.canonicalGameStats ?? null,
            principle: principle?.principle ?? "Animal Intelligence",
            lesson: principle?.coreLesson ?? entry.analysis.summary,
            powers: principle?.bestFor ?? ["Observation"],
            captured: Boolean(capture),
            captureId: capture?.captureId ?? null,
            capturedAt: capture?.capturedAt ?? null,
            score: capture?.score ?? null,
            context: capture?.contextLabel ?? null,
            imageSrc: getSpeciesImageRoute(entry.slug, capture?.captureId),
            hasIndexNumber: animalDexNumber != null,
            identityKind: entry.databaseSource?.identityKind ?? null,
            isBreed: entry.databaseSource?.identityKind?.toLowerCase() === "breed"
        };
    });
    const discovered = species.filter((item) => item.captured).length;
    const progress = species.length ? Math.round(discovered / species.length * 100) : 0;

    return (
        <AppPage>
            <AppPageHeader
                eyebrow="AnimalDex"
                title="Collection"
                description="Browse the indexed field guide, track discoveries, and explore the powers and lessons connected to every animal."
                action={<AppPrimaryLink href="/app/capture" icon="camera">Add capture</AppPrimaryLink>}
            />

            <AppSurface>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Catalog progress</p>
                        <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">{discovered}<span className="text-white/35"> / {species.length}</span></p>
                        <p className="mt-1 text-sm text-white/45">{species.length - discovered} species left to discover</p>
                    </div>
                    <div className="w-full sm:max-w-xs">
                        <div className="mb-2 flex justify-between text-xs font-bold text-white/40">
                            <span>Completion</span>
                            <span>{progress}%</span>
                        </div>
                        <AppProgress value={progress} />
                    </div>
                </div>
            </AppSurface>

            <CollectionCatalog species={species} />
        </AppPage>
    );
}
