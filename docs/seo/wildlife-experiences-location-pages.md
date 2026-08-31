# Future `/wildlife-experiences/[location]` rules

Do not build these routes yet. `/wildlife-experiences` stays the canonical discovery page until inventory has a trusted, normalized geographic identity.

## Canonical geographic truth

For Guide marketplace listings:

- **public area / selected place** = canonical geographic truth
- **title** = marketing/display copy only

`schema.org` `areaServed`, future location filters, future location URLs, location metadata, and structured location facets must derive only from the structured public-area selection (`public_locality`, `public_place_name`, `public_admin_area`, then fallback `public_area_label`).

Never derive geography from title text. Never infer a place with AI. Never rewrite the seller title to match the area.

On `/guides/[listing]`:

- H1 = seller title
- Location display = structured public area
- `areaServed` = structured public area
- Future location filter / URL = normalized structured locality

Do not change the H1 to match the location.

## Why this is deferred

The only published Guide listing currently has a contradictory title and public area:

- id: `1df4dd8e-05a1-4f08-bba8-909ade817e36`
- title: Night herping around Bogor
- stored `public_area_label`: West Jakarta, Jakarta
- stored `region_code`: Jakarta
- no persisted place snapshot

Until a seller or reviewer corrects that row through the normal editor/review flow, do not generate Bogor pages, West Jakarta experience pages, or city-specific metadata. Do not put Bogor into metadata simply because it appears in the title.

Listing metadata uses the seller title and the structured area independently. It must not concatenate contradictory strings such as “Night herping around Bogor in West Jakarta”.

Existing location SEO that must not be reused or collided with:

- field-guide / species location pages
- `/wildlife-guides/[location]` marketplace slices, which already require `MIN_LOCATION_GUIDE_INVENTORY` (2 published listings)

## Required before a location URL exists

Create `/wildlife-experiences/[location]` only when all of the following are true:

1. **Normalized geographic identity.** `hasStructuredPublicLocality` is true. Eligibility uses `guideLocationSlug` from structured locality, never title tokens.
2. **Real published inventory.** Listings are `published`, authorized, and individually indexable.
3. **Enough unique local information.** The page is not a filtered reprint of `/wildlife-experiences`.
4. **No collision** with field-guide location URLs or `/wildlife-guides/[location]`.
5. **No thin doorway.** One listing plus a city name in a title is not enough.

## Inventory threshold

Prefer:

- **3+** active, indexable listings in that normalized structured place, **or**
- **1+** indexable listing **plus** genuinely substantial unique location content (not a template paragraph with the city name swapped in)

`isExperiencesLocationRouteEligible` implements the 3+ structured-locality rule. Do not treat the current `/wildlife-guides/[location]` threshold of 2 as the experiences-hub rule.

## Suggested page shape (later)

Once the identity is trusted:

- Wildlife Experiences in {normalized locality}
- live experiences
- category slices that actually have inventory (Herping, Birding, Night wildlife)
- practical local context that is unique to the place
- links through to `/guides/[slug]-[id]`

Example after a Bogor correction (not created now): `/wildlife-experiences/bogor` only if the stored structured locality is actually Bogor and the page would not be a doorway.

Example after a West Jakarta correction: `/wildlife-experiences/west-jakarta` only from the stored public area, never from the current title.
