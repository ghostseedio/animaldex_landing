import type {Metadata} from "next";
import {notFound} from "next/navigation";
import type {ArkAnimal, ArkSnapshot, ArkThrive} from "@/ark-scene/types";
import type {ArkCaptureState} from "@/lib/ark-thrive";
import {getArkWords} from "@/loaders/ark-words";
import ArkCaptureBandGallery from "./gallery-client";

/**
 * DEV ONLY: the capture page's Ark band in each of its states, drawn by the
 * real component from fixture answers, since `/app/capture/<id>` needs a
 * session: every `voyage_capture_state_v1` state (captures + thrive, the
 * frozen read contract section 6), then the species' band from a fixture
 * snapshot (capture arrivals switched off, or someone else's capture).
 * 404s in production.
 *
 *   /dev/ark/capture-band
 */

export const metadata: Metadata = {title: "Ark capture band", robots: {index: false, follow: false}};

function animal(id: number, species: string, slug: string, name: string, mine = false, thrive: ArkThrive = "ordinary"): ArkAnimal {
    return {
        id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
        species_profile_id: species,
        name,
        scientific_name: null,
        model_slug: slug,
        zone: "grassland",
        arrived_at: `2026-11-0${Math.min(id, 9)}T10:00:00Z`,
        brought_by: {label: `Voyager ${id}`, named: false},
        mine,
        origin: "arrived",
        source: "capture",
        thrive,
        area: null
    };
}

function state(kind: ArkCaptureState["state"], extra: Partial<ArkCaptureState> = {}): ArkCaptureState {
    return {state: kind, reason: null, species: "Komodo Dragon", kindName: "Komodo Dragon", livingBrought: 1, aboard: 2, thrive: "ordinary", animalId: null, ...extra};
}

const KOMODO = "3aa1fb77-3f0b-4a0f-9c86-790111a40c08";
const HAWK = "7e2ffcc3-79dc-4677-87be-b2481eec26c2";
const FOX = "00000000-0000-4000-8000-00000000f0c5";

const SNAPSHOT: ArkSnapshot = {
    voyage: {slug: "first", name: "The first Ark", started_at: "2026-11-02T18:12:05Z"},
    counts: {animals: 8, species: 3, founders: 5},
    zones: [],
    animals: [
        animal(1, HAWK, "red-tailed-hawk", "Red-tailed Hawk"),
        animal(2, KOMODO, "komodo-dragon", "Komodo Dragon"),
        animal(3, KOMODO, "komodo-dragon", "Komodo Dragon", true, "good"),
        animal(4, FOX, "red-fox", "Red Fox", true, "prime"),
        animal(5, FOX, "red-fox", "Red Fox"),
        animal(6, FOX, "red-fox", "Red Fox", true, "prime"),
        animal(7, FOX, "red-fox", "Red Fox"),
        animal(8, FOX, "red-fox", "Red Fox")
    ],
    as_of: "2026-11-10T09:00:00Z"
};

export default async function ArkCaptureBandGalleryPage({params}: {params: {locale: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    const {words} = await getArkWords(params.locale);
    return (
        <ArkCaptureBandGallery
            words={words}
            snapshot={SNAPSHOT}
            cases={[
                {label: "This capture: aboard (yours alone), ordinary", speciesProfileId: KOMODO, slug: "komodo-dragon", name: "Komodo Dragon", captureState: state("aboard", {animalId: "00000000-0000-4000-8000-000000000003"})},
                {label: "This capture: aboard, your pair, in good condition", speciesProfileId: KOMODO, slug: "komodo-dragon", name: "Komodo Dragon", captureState: state("aboard", {livingBrought: 2, aboard: 3, thrive: "good", animalId: "00000000-0000-4000-8000-000000000003"})},
                {label: "This capture: coming aboard (queued)", speciesProfileId: KOMODO, slug: "komodo-dragon", name: "Komodo Dragon", captureState: state("coming_aboard", {livingBrought: 0})},
                {label: "This capture: coming aboard when its 3D model is ready", speciesProfileId: "00000000-0000-4000-8000-0000000011e1", slug: "bornean-orangutan", name: "Bornean Orangutan", captureState: state("waiting_model", {species: "Bornean Orangutan", kindName: "Bornean Orangutan", livingBrought: 0, aboard: 0})},
                {label: "This capture: your pair was already aboard, prime", speciesProfileId: FOX, slug: "red-fox", name: "Red Fox", captureState: state("pair_full", {species: "Red Fox", kindName: "Red Fox", livingBrought: 2, aboard: 5, thrive: "prime"})},
                {label: "This capture: it was aboard (it died)", speciesProfileId: KOMODO, slug: "komodo-dragon", name: "Komodo Dragon", captureState: state("was_aboard", {livingBrought: 0, aboard: 1})},
                {label: "A sighting saved to your card: yours is already aboard", speciesProfileId: KOMODO, slug: "komodo-dragon", name: "Komodo Dragon", captureState: state("not_on_ark", {reason: "merged", livingBrought: 1, thrive: "good"})},
                {label: "Not on the Ark (excluded)", speciesProfileId: "00000000-0000-4000-8000-0000000011e2", slug: "human", name: "Human", captureState: state("not_on_ark", {reason: "excluded", species: "Human", kindName: null, livingBrought: 0, aboard: 0})},
                {label: "Species band: aboard, a pair, one of them yours", speciesProfileId: KOMODO, slug: "komodo-dragon", name: "Komodo Dragon"},
                {label: "Species band: one, waiting for a mate", speciesProfileId: "a-folded-profile", slug: "red-tailed-hawk", name: "Red-tailed Hawk"},
                {label: "Species band: crowded, two yours (prime)", speciesProfileId: FOX, slug: "red-fox", name: "Red Fox"},
                {label: "Species band: not aboard", speciesProfileId: "00000000-0000-4000-8000-0000000011e0", slug: "lion", name: "Lion"}
            ]}
        />
    );
}
