# Symbolism Post Template

Standard structure for AnimalDex `/blog/{species-slug}-symbolism` guides.

## Section outline

1. **Quick Answer** — direct-answer snippet (featured-snippet target)
2. **What Is a {Animal}?** — biology, range, conservation status
3. **Biological Basis of the Symbol** — trait → archetype (anchor from lesson/principle data)
4. **3–5 thematic sections** — culture, shadow, dreams, etc. (species-specific)
5. **What the {Animal} Teaches** — human lesson bridge
6. **Final Meaning of {Animal} Symbolism** — closing synthesis
7. **{Animal} Symbolism Quick Summary** — markdown **table** (not cards)
8. **Related Animal Symbolism** — 3–6 sibling posts + hub link
9. **Explore on AnimalDex** (inline links) — species, lesson, principle cluster, symbolism hub

## Required metadata

| Field | Requirement |
| --- | --- |
| `slug` | `{species-slug}-symbolism` |
| `speciesSlugs` | `[speciesSlug]` |
| `searchIntents` | `{animal} symbolism`, `{animal} meaning`, `{animal} spiritual meaning` |
| `sources` | Minimum 3 credible links (IUCN, peer-reviewed, museum/ethnography) |
| `faq` | 4–6 Q&A items |
| `tableOfContents` | Matches section titles |
| Images | 8–12 under `public/images/blog/{slug}-symbolism/` |

## Image naming

| File | Purpose |
| --- | --- |
| `{slug}-symbolism-hero.webp` | Featured image |
| `what-is-a-{short-name}.webp` | Biology section |
| `{trait}-symbolism.webp` | Thematic sections |
| `{slug}-symbolism-lesson.webp` | What it teaches |
| `{slug}-symbolism-final.webp` | Final meaning |

## Cross-link requirements

Every post must link to:

- `/animals/{slug}`
- `/animal-lessons/{slug}` (when lesson page exists)
- `/principles/{cluster}`
- `/animal-symbolism`
- 3–6 related `-symbolism` posts (same principle or family cluster)

## QA checklist

- [ ] No `"For SEO"` or meta-description leaks in body copy
- [ ] Summary section uses `table`, not `cards`
- [ ] `sources.length >= 3`
- [ ] `faq.length >= 4`
- [ ] Hero + ≥7 body images exist on disk
- [ ] `speciesSlugs[0]` resolves in species index
- [ ] Biology anchor differs from lesson page copy (cross-link, don't duplicate)
- [ ] Passes `node scripts/validateSymbolismPosts.js`

## Biology anchor priority

1. Supabase catalog lesson (`hasCatalogLesson`)
2. Curated profile in `species-behavioral-principles.ts`
3. Systems-intelligence draft from behavior-lessons backfill CSV
