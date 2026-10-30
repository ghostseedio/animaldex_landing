/**
 * Where a newcomer can talk to an animal before installing anything or
 * signing in (newcomer UX vet, 2026-10-30): the Common Octopus's species
 * page, with its chat open (`?talk=1`, read by `SpeciesTalkOnArrival`).
 * The home page's chat still shows the same animal.
 */
export const TRY_TALKING_SPECIES = {slug: "common-octopus", image: "/images/welcome/common-octopus.webp"} as const;

export const TRY_TALKING_HREF = `/animals/${TRY_TALKING_SPECIES.slug}?talk=1`;
