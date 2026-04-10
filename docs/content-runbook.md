# AnimalDex Content Runbook

## Purpose

This document is the default specification for adding or updating:

- species intelligence blocks
- animal species pages
- blog posts
- featured images
- inline images and galleries
- metadata

If a future request says "add 20 more animals" or "create 5 more blog posts", use this runbook unless explicitly told otherwise.

## Content System

### Canonical Sources

- Species page data lives in `src/data/species.ts`
- Species systems-intelligence data lives in `src/data/species-systems-intelligence.ts`
- Blog post data lives in `src/data/blog.ts`
- Shared content types live in `src/data/content-schema.ts`

### Rendering Sources

- Species page renderer: `src/app/[locale]/(composited)/animals/[slug]/page.tsx`
- Blog page renderer: `src/app/[locale]/(composited)/blog/[slug]/page.tsx`
- Systems section renderer: `src/app/[locale]/(composited)/_components/systems-intelligence-section.tsx`
- Content image renderer: `src/app/[locale]/(composited)/_components/content-image-figure.tsx`

## Voice And Tone

Write with this mix:

- insightful
- pragmatic
- slightly witty
- premium
- modern
- grounded in biology and systems thinking
- scannable

The writing should feel intelligent and useful, not mystical or preachy.

## Required Tone Boundaries

### Prefer

- Systems Biology
- Biomimicry
- Evolutionary Strategy
- Functional Niche
- Environmental Hardware
- Specialized Hardware
- Signal Processing
- Adaptive Design
- Ecological Role
- Operating Principle
- Strategic Insight

### Avoid

- spirit animal
- mystical lesson
- sacred animal energy
- magical power
- occult meaning
- destiny language
- supernatural framing

Do not frame animal behavior as spiritual guidance. Keep the lens biological, strategic, and ecological.

## Systems Intelligence Structure

Section title:

- `Systems Intelligence & Hidden Purpose`

Required labels:

- `System Role`
- `Specialized Hardware`
- `Systems Script`
- `Strategic Insight`

Required fields:

- `roleTitle`
- `specializedHardware`
- `systemsScript`
- `strategicInsight`

### Writing Rules

- Keep each field concise but meaningful
- Prefer 1 to 3 sentences per field
- Make the animal feel like engineered open-source hardware
- Explain real biological advantages, not vague symbolism
- The strategic insight should be concrete and useful, not self-help fluff

### Example

Animal: Komodo Dragon

- System Role: `The Island Apex Regulator`
- Specialized Hardware: heavy skeletal build, bite mechanics, chemical sensing, heat-efficient metabolism
- Systems Script: regulates prey pressure and removes weak links in a constrained island ecosystem
- Strategic Insight: conserve premium energy and move hard only when timing and leverage are real

## Species Page Rules

Each species entry should include:

- `slug`
- `name`
- `heroTitle`
- `publishedAt`
- `updatedAt`
- `featuredImage`
- `searchIntents`
- analysis block
- premium details block
- related species

Each species with a dedicated page should also have a matching systems-intelligence entry where practical.

## Blog Post Rules

Each blog post should include:

- `slug`
- `title`
- `description`
- `publishedAt`
- `updatedAt`
- `featuredImage`
- `readingMinutes`
- `tags`
- `searchIntents`
- `speciesSlugs`
- `sections`

Optional blog fields:

- `author`
- `faq`
- `systemsSpeciesSlugs`
- section-level `media`

### Blog Structure

Use a strong answer-first opening.

Then structure the article into short sections with:

- one clear angle per section
- short paragraphs
- optional species links
- optional image or gallery blocks when they add clarity

### Blog Media Rules

Every blog post should have a `featuredImage`.

Optional inline media can be:

- a single image block
- a gallery block

Use media when it improves understanding, comparison, or scannability. Do not add decorative filler just to break text.

## Image Rules

### Featured Images

Every blog post must have:

- `src`
- `alt`
- `width`
- `height`
- optional `caption`

Species pages should also have a `featuredImage` for metadata and future reuse even if the page does not yet render it visibly.

### Alt Text

Alt text should describe the subject or function of the image clearly.

Good:

- `Illustrated AnimalDex scan workflow for identifying animals in the wild`
- `Travel-focused AnimalDex illustration for spotting animals in Bali`

Avoid:

- `image`
- `blog image`
- keyword-stuffed alt text

### Placement

- Blog featured image sits near the top of the article
- Inline images belong inside the section they support
- Galleries should stay compact and visually tidy

## Formatting Rules

- No walls of text
- Prefer short paragraphs
- Use section titles with a clear point of view
- Use lists only when the content is naturally list-shaped
- Keep CTA copy direct and low-friction

## Scannability Rules

- Front-load the answer or insight
- Keep paragraphs tight
- Use sub-sections to break complex material
- Use species links when they genuinely deepen the topic
- Use images to add clarity, not noise

## Internal Linking Rules

Every content asset should help the user move deeper into the site.

### Species Pages

- Link to related species
- Link to relevant blog posts

### Blog Posts

- Link to referenced species where relevant
- Link to answer guides when the user intent shifts toward comparison or recommendation
- Reuse systems-intelligence cards for related species when it strengthens the article

## Metadata Rules

All blog posts and species pages should follow a normalized metadata pattern:

- `title`
- `description`
- `featuredImage`
- `publishedAt`
- `updatedAt`
- Open Graph image
- Twitter image
- structured article metadata where relevant

Use `src/lib/content-metadata.ts` for page metadata normalization.

## SEO And AIO Rules

### Titles

- Lead with the exact topic
- Keep titles clear before clever
- Include the year only when the content is genuinely time-sensitive

### Descriptions

- Make the first sentence useful on its own
- Describe the practical value of the page
- Avoid keyword stuffing

### Freshness

- Use real `publishedAt`
- Update `updatedAt` when meaningfully revised
- Keep date signals visible on blog pages and species pages where appropriate

### Internal Search And AI Readiness

- Write answer-first where the query is high-intent
- Make important claims explicit and easy to quote
- Keep entities, roles, habitats, and distinctions concrete
- Avoid thin content with generic filler

## Content Examples

### Systems Intelligence Entry

```ts
{
  roleTitle: "The Silent Recycler",
  specializedHardware: "Exceptional eyesight, soaring efficiency, and scavenger-grade feeding hardware allow the white-headed vulture to find and clear carrion fast.",
  systemsScript: "It functions inside the ecosystem sanitation layer, accelerating nutrient cycling and reducing pathogen risk.",
  strategicInsight: "Some of the highest-value systems win by removing waste faster, not by adding more complexity."
}
```

### Blog Post Media Example

```ts
featuredImage: {
  src: "/images/placeholders/feature-scan-overview.svg",
  alt: "Illustrated AnimalDex scan workflow for identifying animals in the wild",
  width: 1200,
  height: 675,
  caption: "Use AI to shorten the list, then verify with field traits and habitat context."
}
```

### Inline Image Example

```ts
media: {
  type: "image",
  image: {
    src: "/images/placeholders/feature-scan-overview.svg",
    alt: "Diagram-style visual showing AI scan, verification, and species logging",
    width: 1200,
    height: 675
  }
}
```

### Gallery Example

```ts
media: {
  type: "gallery",
  title: "Trip-planning lenses",
  images: [
    {
      src: "/images/placeholders/more-discovery.svg",
      alt: "Illustrated habitat-first wildlife discovery approach for Bali trips",
      width: 1200,
      height: 675
    },
    {
      src: "/images/placeholders/more-guide.svg",
      alt: "Illustrated checklist for planning wildlife spotting routes and goals",
      width: 1200,
      height: 675
    }
  ]
}
```
