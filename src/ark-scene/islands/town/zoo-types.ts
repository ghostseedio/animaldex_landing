/**
 * The zoo's 13 enclosure types (islands plan §3.5, AnimalDex docs/ark/islands-plan.md; decisions 22–23): residents per
 * enclosure, footprint, how many slots the plan reserves, how many open at launch, and how each is built (a glass-
 * fronted house the camera sees into, an outdoor paddock, a netted aviary, a pool). Pure data.
 *
 * The ids are the value of `voyage_animals.enclosure` (migration I1) and of the species' `zoo_enclosure`: the server
 * lane uses these strings.
 */

export const ZOO_ENCLOSURE_TYPES = [
    "aviary",
    "aquarium",
    "reptile_house",
    "savanna",
    "childrens_farm",
    "small_mammals",
    "primate_house",
    "hoofstock",
    "nocturnal_house",
    "bears_wolves",
    "insect_house",
    "penguin_pool",
    "big_cats"
] as const;
export type ZooEnclosureType = (typeof ZOO_ENCLOSURE_TYPES)[number];

/** How an enclosure is built. */
export type ZooForm = "house" | "aviary" | "paddock" | "pool";

export type ZooTypeSpec = {
    label: string;
    /** Residents one enclosure holds (the plan's capacity; births stop when full, decision 23). */
    capacity: number;
    /** Footprint (m) of one enclosure: `w` along the path, `d` back from it. */
    w: number;
    d: number;
    /** Slots the plan reserves (the most enclosures of this type the zoo will open). */
    slots: number;
    /** Enclosures open with today's 499 zoo animals (the plan's table). */
    launch: number;
    /** Residents today, 3× and at a year (the plan's table; for the validator's capacity check). */
    residents: {today: number; triple: number; year: number};
    form: ZooForm;
    /** Feeding times on the island clock (hours), scene only (plan §5); `weekly` once an Ark week. */
    feeding: number[];
    weekly?: boolean;
    /** Enrichment props drawn in it (plan §5). */
    enrichment: string[];
};

export const ZOO_TYPES: Record<ZooEnclosureType, ZooTypeSpec> = {
    aviary: {label: "Aviaries and bird cages", capacity: 40, w: 18, d: 16, slots: 6, launch: 5, residents: {today: 168, triple: 504, year: 359}, form: "aviary", feeding: [8.5], enrichment: ["perches", "bathing_pool", "fruit_skewer"]},
    aquarium: {label: "Aquarium", capacity: 60, w: 24, d: 16, slots: 2, launch: 2, residents: {today: 73, triple: 219, year: 112}, form: "house", feeding: [13], enrichment: ["bubbles", "food_drift"]},
    reptile_house: {label: "Reptile house", capacity: 40, w: 20, d: 14, slots: 3, launch: 2, residents: {today: 48, triple: 144, year: 99}, form: "house", feeding: [12], weekly: true, enrichment: ["heat_lamp", "logs", "pool"]},
    savanna: {label: "Savanna paddocks", capacity: 24, w: 40, d: 28, slots: 3, launch: 2, residents: {today: 38, triple: 114, year: 100}, form: "paddock", feeding: [9, 15], enrichment: ["hay_net", "scratching_post", "termite_mound"]},
    childrens_farm: {label: "Children's farm", capacity: 30, w: 24, d: 18, slots: 2, launch: 2, residents: {today: 38, triple: 114, year: 81}, form: "paddock", feeding: [10, 16], enrichment: ["hay", "ball", "brush"]},
    small_mammals: {label: "Small mammals and Australian walk-through", capacity: 16, w: 14, d: 10, slots: 3, launch: 3, residents: {today: 33, triple: 99, year: 80}, form: "paddock", feeding: [10.5, 15.5], enrichment: ["burrow_box", "logs", "puzzle_feeder"]},
    primate_house: {label: "Primate house", capacity: 16, w: 24, d: 16, slots: 4, launch: 2, residents: {today: 27, triple: 81, year: 62}, form: "house", feeding: [10, 14], enrichment: ["climbing_frame", "hammock", "puzzle_feeder", "scatter_feed"]},
    hoofstock: {label: "Hoofstock paddocks", capacity: 18, w: 30, d: 22, slots: 3, launch: 2, residents: {today: 20, triple: 60, year: 47}, form: "paddock", feeding: [9.5, 15], enrichment: ["hay_net", "salt_lick", "logs"]},
    nocturnal_house: {label: "Nocturnal house", capacity: 24, w: 14, d: 10, slots: 2, launch: 1, residents: {today: 15, triple: 45, year: 38}, form: "house", feeding: [11], enrichment: ["hollow_logs", "insect_feeder"]},
    bears_wolves: {label: "Bears and wolves", capacity: 8, w: 24, d: 18, slots: 3, launch: 2, residents: {today: 13, triple: 39, year: 44}, form: "paddock", feeding: [16], enrichment: ["ice_block", "scent_trail", "logs", "pool"]},
    insect_house: {label: "Insect house", capacity: 60, w: 12, d: 10, slots: 1, launch: 1, residents: {today: 11, triple: 33, year: 38}, form: "house", feeding: [12], enrichment: ["butterfly_feeder", "leaf_litter"]},
    penguin_pool: {label: "Penguin and seal pools", capacity: 30, w: 24, d: 16, slots: 1, launch: 1, residents: {today: 9, triple: 27, year: 17}, form: "pool", feeding: [11, 15], enrichment: ["fish_scatter", "rocks", "ice_block"]},
    big_cats: {label: "Big cats", capacity: 6, w: 24, d: 18, slots: 2, launch: 1, residents: {today: 6, triple: 18, year: 10}, form: "paddock", feeding: [16], weekly: false, enrichment: ["scent_trail", "logs", "high_platform", "ball"]}
};

/** Slots in all (the plan's "room for about 40"). */
export const ZOO_SLOT_TOTAL = ZOO_ENCLOSURE_TYPES.reduce((sum, type) => sum + ZOO_TYPES[type].slots, 0);
/** Enclosures open at launch (the plan's 26). */
export const ZOO_LAUNCH_TOTAL = ZOO_ENCLOSURE_TYPES.reduce((sum, type) => sum + ZOO_TYPES[type].launch, 0);

/**
 * How many enclosures of a type are open for this many arrived (not born) residents: one per `capacity`, at least
 * one once anyone lives there, never more than the type's slots (decision 23: arrivals open the next slot up to the
 * plan's room; births never open one; past it, enclosures take more residents and births stop in full ones).
 */
export function enclosuresOpen(type: ZooEnclosureType, arrivedResidents: number): number {
    const spec = ZOO_TYPES[type];
    if (arrivedResidents <= 0) return 0;
    return Math.min(spec.slots, Math.max(1, Math.ceil(arrivedResidents / spec.capacity)));
}

/** The launch residents per type (the plan's "today" column), the default when the snapshot carries no enclosure yet. */
export function launchResidents(): Record<ZooEnclosureType, number> {
    return Object.fromEntries(ZOO_ENCLOSURE_TYPES.map((type) => [type, ZOO_TYPES[type].residents.today])) as Record<ZooEnclosureType, number>;
}

/** Whether a breeding fits: residents plus the expected litter within the open enclosures' capacity (plan §5). */
export function breedingFits(type: ZooEnclosureType, residents: number, open: number, litter: number): boolean {
    return residents + Math.max(litter, 0) <= ZOO_TYPES[type].capacity * Math.max(open, 0);
}
