export const HUMAN_SPECIES_IDS: readonly string[] = ["2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2", "0fd32bd2-669f-489d-8a1b-8e917aa5117d"];

/** Whether it is a human (a Homo sapiens of a human capture): outside the food web, and with no old age unless the read gives it a lifespan. */
export function arkIsHuman(animal: {species_profile_id: string; kind_species_profile_id?: string | null; model_slug?: string | null; scientific_name?: string | null}): boolean {
    return (
        HUMAN_SPECIES_IDS.includes(animal.species_profile_id.toLowerCase()) ||
        (animal.kind_species_profile_id != null && HUMAN_SPECIES_IDS.includes(animal.kind_species_profile_id.toLowerCase())) ||
        animal.model_slug === "human" ||
        /^homo\s+sapiens/i.test(animal.scientific_name ?? "")
    );
}
