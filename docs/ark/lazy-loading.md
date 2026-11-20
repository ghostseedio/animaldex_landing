# Keeping /ark's first JavaScript small

The /ark page's static JavaScript (everything `ark-view.tsx` reaches through plain `import` statements) must stay
under **204,800 bytes minified**. `src/lib/ark-page-weight.test.ts` measures it and prints the total, the bytes left and
the top 15 contributors, each with the file that pulls it in:

    npx tsx --test src/lib/ark-page-weight.test.ts

Lane ark-js-budget (2026-11-20) took it from 204,577 to 153,441 bytes by moving the tapped animal's card (~28 KB with
its rhythm, thrive and status words) and the live log's words (~23 KB, reached only for `arkNewArrivals`) out of it.

## Rules for new Ark features

1. **Nothing that only shows after a tap, a toggle or a delay goes in a static import from `ark-view.tsx`.** Load it
   with `React.lazy(() => import(...))` inside `<Suspense fallback={null}>`, as `ArkAnimalCard`, the card's photo block
   (`ArkCardPhoto`), `ArkTimeLeft` and `ArkItsDay` do.
2. **Preload what the reader will want soon** in a `requestIdleCallback` after the first paint (with a
   `setTimeout(…, 150)` fallback), from the same loader function the `lazy()` uses, as `loadArkAnimalCard` does. Then
   the first tap shows the panel at once and nothing looks different.
3. **A helper the page needs from a big module goes in its own small module**, re-exported from the big one so its
   other importers and tests are unchanged (`ark-card-focus.tsx` for `useCardFocus` / `ArkFilled`, `ark-new-arrivals.ts`
   for `arkNewArrivals`). One named import from a big file pulls in the whole file and everything it imports.
4. **Data tables (JSON) never go in the page's static imports.** The scene's tables come with the scene's own dynamic
   import (`@/ark-scene/islands/archipelago`); the test fails if a scene table or three.js is reached. Words and
   tables used only by the scene's live log stay under `src/ark-scene/live/`.
5. **Words:** add strings to the locale files (`ArkWords`), which the server hands the page as props; never import a
   table of all locales into a client component.
6. **Debug and development hooks** go behind `process.env.NODE_ENV !== "production"` (removed from the build) or a
   dynamic import.
7. Before opening the PR, run the page-weight test and read its top 15: if your change made a file climb, make it lazy.
