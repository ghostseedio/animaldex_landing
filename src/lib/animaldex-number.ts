import type {SpeciesEntry} from "@/data/species";

export function formatAnimalDexNumber(value: number) {
    return `#${String(value).padStart(3, "0")}`;
}

export function getAnimalDexNumberFromEntry(entry: Pick<SpeciesEntry, "databaseSource"> | null | undefined) {
    const number = entry?.databaseSource?.animalDexNumber;

    if (typeof number !== "number" || number < 1) {
        return null;
    }

    return number;
}

export function mergeCatalogMetadata(staticEntry: SpeciesEntry, catalogEntry: SpeciesEntry | null | undefined): SpeciesEntry {
    if (!catalogEntry?.databaseSource) {
        return staticEntry;
    }

    return {
        ...staticEntry,
        name: catalogEntry.name || staticEntry.name,
        speciesProfileId: catalogEntry.speciesProfileId ?? staticEntry.speciesProfileId,
        normalizedIdentityKey: catalogEntry.normalizedIdentityKey ?? staticEntry.normalizedIdentityKey,
        databaseSource: catalogEntry.databaseSource
    };
}
