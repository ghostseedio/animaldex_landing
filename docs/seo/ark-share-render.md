# Ark share renders

The share images of the Ark pages and the site's default card are real renders of the live Ark. They are not mock-ups, and they don't use the development fixture.

| File | View | Used by |
|---|---|---|
| `public/images/og/ark-world-2026-11-12.jpg` | both islands across the strait (`islands`, at 0.5) | the default card (`app/[locale]/layout.tsx`), the home page, /ark/how-it-works, /ark/food-chain, /about, and the JSON-LD `image` |
| `public/images/og/ark-island-2026-11-12.jpg` | the wild island from the sea (`flyover`, at 0.75) | the background of `/api/og/ark.png`, with the live count over it (`src/lib/og/og-card.tsx`, `ArkWorldCard`) |

## How they were made (2026-11-12)

1. Start a development server with the public Supabase read: `PORT=3331 npx next dev -p 3331`.
2. Run `node scripts/ark-share-render.mjs --base http://localhost:3331 --out <file> --kind islands --at 0.5 --hour 10`.
   - The script opens `/ark?record=1&models=live`. That is the recorder: the live public snapshot (3,152 animals of 952 species on the day), with every model loaded from the bucket.
   - The director moves only the camera and the light. Nothing in the world is staged.
3. Copy the output under a new dated file name, so that networks fetch it fresh, and update `ARK_RENDER_IMAGE` / `ARK_ISLAND_RENDER_IMAGE` in `src/lib/seo/ark-pages.ts`.

Re-render after a visible change to the world, such as the bigger wild island or new scenery.
