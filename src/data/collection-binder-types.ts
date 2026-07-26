export type BinderShelfGroup = "wildlife" | "specialists" | "companions_and_places";

export type BinderDefinition = {
    id: string;
    title: string;
    shortTitle: string;
    spineLabel: string;
    blurb: string;
    shelfGroup: BinderShelfGroup;
    sortOrder: number;
    accentHex: string;
    primaryHex: string;
    secondaryHex: string;
    coverArtworkKey: string;
};

export type BinderSlot = {
    speciesProfileId: string;
    identityKey: string;
    slug: string;
    displayName: string;
    scientificName: string | null;
    animalDexNumber: number | null;
    position: number;
    isCollected: boolean;
    captureId: string | null;
    imageSrc: string;
};

export type BinderProgress = {
    definition: BinderDefinition;
    slots: BinderSlot[];
    collectedCount: number;
    totalCount: number;
    completionPercent: number;
    isComplete: boolean;
    coverImageSrc: string;
    href: string;
};

export type BinderIndexSummary = {
    binderCount: number;
    collectedSlots: number;
    totalSlots: number;
    completeCount: number;
};

export const BINDER_SHELF_GROUPS: Array<{id: BinderShelfGroup; title: string}> = [
    {id: "wildlife", title: "Wildlife"},
    {id: "specialists", title: "Specialists"},
    {id: "companions_and_places", title: "Companions & Places"}
];
