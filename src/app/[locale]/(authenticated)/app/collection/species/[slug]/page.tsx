import {notFound} from "next/navigation";
import SpeciesViewClient from "@/app/[locale]/(authenticated)/app/collection/species/[slug]/species-view-client";
import {getAppCaptures} from "@/data/authenticated-app";
import {getSpeciesBinderLinks} from "@/data/collection-binders";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {getEnhancedAnimalPowerProfile} from "@/data/species-animal-power";
import {getSpeciesSubtitle} from "@/data/species-subtitles";
import {resolveLocalSpeciesStats} from "@/data/species-stats";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {buildCollectionDiscoveryIndex, latestCaptureForCatalogEntry} from "@/lib/collection-discovery";
import {isHomoSapiens} from "@/lib/people-never-public";
import {getCaptureWords} from "@/loaders/capture-words";
import {getScopedTranslator} from "@/loaders/translation";

/**
 * A species from the Collection, in the app (iOS `AnimalDexSpeciesDetailView`):
 * caught, it leads to your card and to talking with your animal; not caught,
 * "Talk to it now" (its public chat, when it has a Power and is not a person)
 * and the camera. The public /animals page stays the reader's page, with its
 * Get the app.
 */
export default async function CollectionSpeciesPage({params}: {params: {locale: string; slug: string}}) {
    const entry = await getResolvedSpeciesBySlug(params.slug);
    // People are never public (DECISIONS section 11).
    if (!entry || isHomoSapiens({slug: entry.slug, scientificName: entry.analysis.scientificName})) notFound();

    const [captures, powerProfile, subtitle, binders, captureWords, t] = await Promise.all([
        getAppCaptures(),
        getEnhancedAnimalPowerProfile(entry.speciesProfileId),
        getSpeciesSubtitle(entry.slug, params.locale),
        getSpeciesBinderLinks(entry).catch(() => []),
        getCaptureWords(params.locale),
        getScopedTranslator(params.locale, "appCollection")
    ]);
    const latest = latestCaptureForCatalogEntry({
        speciesProfileId: entry.speciesProfileId,
        normalizedIdentityKey: entry.normalizedIdentityKey
    }, buildCollectionDiscoveryIndex(captures));

    return (
        <SpeciesViewClient
            slug={entry.slug}
            name={entry.name}
            scientificName={entry.analysis.scientificName ?? null}
            speciesProfileId={entry.speciesProfileId ?? null}
            animalDexNumber={getAnimalDexNumberFromEntry(entry)}
            identityKind={entry.databaseSource?.identityKind ?? null}
            story={subtitle.subtitleStory ?? entry.analysis.summary ?? null}
            powerProfile={powerProfile}
            stats={resolveLocalSpeciesStats(entry).stats}
            binders={binders}
            latest={latest ? {captureId: latest.captureId, animalName: latest.animalName, capturedAt: latest.capturedAt} : null}
            captureWords={captureWords}
            words={{
                collection: t("title"),
                breedProfile: t("breedProfile"),
                domesticParent: t("domesticParent"),
                joiningCatalog: t("joiningCatalog"),
                talkToItNow: t("talkToItNow"),
                findToCaptureA: t("findToCaptureA"),
                findToCaptureAn: t("findToCaptureAn"),
                findToMeetA: t("findToMeetA"),
                findToMeetAn: t("findToMeetAn"),
                capture: t("capture"),
                talkToIt: t("talkToIt"),
                latestCapture: t("latestCapture"),
                openCaptureCard: t("openCaptureCard"),
                about: t("about"),
                stats: t("stats")
            }}
        />
    );
}
