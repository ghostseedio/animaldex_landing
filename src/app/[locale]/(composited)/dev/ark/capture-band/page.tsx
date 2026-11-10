import type {Metadata} from "next";
import {notFound} from "next/navigation";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {getArkWords} from "@/loaders/ark-words";
import ArkCaptureBandGallery from "./gallery-client";

/**
 * DEV ONLY: the capture page's Ark band in each of its states, drawn by the
 * real component from fixture snapshots, since `/app/capture/<id>` needs a
 * session. 404s in production.
 *
 *   /dev/ark/capture-band
 */

export const metadata: Metadata = {title: "Ark capture band", robots: {index: false, follow: false}};

function animal(id: number, species: string, slug: string, name: string, mine = false): ArkAnimal {
    return {
        id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
        species_profile_id: species,
        name,
        scientific_name: null,
        model_slug: slug,
        zone: "grassland",
        arrived_at: `2026-11-0${Math.min(id, 9)}T10:00:00Z`,
        brought_by: {label: `Voyager ${id}`, named: false},
        mine
    };
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
        animal(3, KOMODO, "komodo-dragon", "Komodo Dragon", true),
        animal(4, FOX, "red-fox", "Red Fox", true),
        animal(5, FOX, "red-fox", "Red Fox"),
        animal(6, FOX, "red-fox", "Red Fox", true),
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
                {label: "Aboard: a pair, one of them yours", speciesProfileId: KOMODO, slug: "komodo-dragon", name: "Komodo Dragon"},
                {label: "Aboard: one, waiting for a mate", speciesProfileId: "a-folded-profile", slug: "red-tailed-hawk", name: "Red-tailed Hawk"},
                {label: "Aboard: crowded, two yours", speciesProfileId: FOX, slug: "red-fox", name: "Red Fox"},
                {label: "Not aboard", speciesProfileId: "00000000-0000-4000-8000-0000000011e0", slug: "lion", name: "Lion"}
            ]}
        />
    );
}
