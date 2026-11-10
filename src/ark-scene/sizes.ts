/**
 * How big each animal stands in the world. The models are all about one
 * unit long (model space, head toward +z); the scene scales each by its
 * species' size, compressed so a sparrow is still seen beside an elephant
 * and a whale doesn't swallow the bay.
 *
 * Neither the snapshot nor the ark model set carries a size yet (contract
 * sections 2 and 3), so v1 keeps typical adult lengths for the species it
 * knows and falls back on the body plan in `ark.json`.
 */

/** Typical adult body length in metres. */
const LENGTH_M: Record<string, number> = {
    "acorn-barnacle": 0.03,
    "african-bush-elephant": 6.5,
    "african-clawed-frog": 0.1,
    "african-fish-eagle": 0.7,
    "african-forest-buffalo": 2.3,
    "african-lion": 2.6,
    "alpine-ibex": 1.5,
    "american-alligator": 3.8,
    "american-lobster": 0.45,
    "arctic-fox": 0.75,
    "atlantic-puffin": 0.3,
    "atlantic-trumpetfish": 0.6,
    "barn-owl": 0.35,
    "capybara": 1.2,
    "cheetah": 2,
    "domestic-cat": 0.7,
    "domestic-dog": 0.9,
    "domestic-goat": 1.3,
    "dromedary-camel": 3,
    "emperor-penguin": 0.6,
    "eurasian-wolf": 1.6,
    "fennec-fox": 0.55,
    "golden-eagle": 0.9,
    "great-white-shark": 5,
    "green-sea-turtle": 1.2,
    "grey-heron": 0.95,
    "harbor-seal": 1.7,
    "house-sparrow": 0.16,
    "humpback-whale": 15,
    "jaguar": 2.2,
    "komodo-dragon": 2.8,
    "mallard": 0.6,
    "meerkat": 0.5,
    "plains-zebra": 2.5,
    "polar-bear": 2.4,
    "red-fox": 1.1,
    "red-tailed-hawk": 0.55,
    "reef-manta-ray": 3.5,
    "roe-deer": 1.2,
    "scarlet-macaw": 0.85,
    "snow-leopard": 2.1
};

/** By body plan (`behaviour.plan`), when the species isn't listed. */
const PLAN_LENGTH_M: Record<string, number> = {
    mammal: 1.2,
    bird: 0.45,
    reptile: 1,
    turtle: 0.8,
    frog: 0.1,
    fish: 0.6,
    ray: 1.5,
    cetacean: 6,
    arthropod: 0.2,
    insect: 0.05,
    sessile: 0.2,
    jellyfish: 0.4,
    cephalopod: 0.8,
    worm: 0.2
};

/** Plans that live in water and float at the surface when their zone is water. */
export const SWIMMING_PLANS = new Set(["fish", "ray", "cetacean", "turtle", "jellyfish", "cephalopod"]);

/** The length an animal is drawn at, in metres: length^0.5, kept between 0.55 and 5. */
export function displayLength(slug: string, plan: string | null | undefined): number {
    const length = LENGTH_M[slug] ?? PLAN_LENGTH_M[plan ?? ""] ?? 1;
    return Math.min(Math.max(1.25 * Math.sqrt(length), 0.55), 5);
}
