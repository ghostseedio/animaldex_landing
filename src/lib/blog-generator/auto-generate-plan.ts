// What the blog auto-generator writes about (src/lib/blog-generator/auto-generate.ts).
// Each run is a "Latest news" generation with one of these as its Focus, picked
// at random, so over a week the timer sweeps the whole beat instead of only
// the stories that win a generic "wildest news" search.

export const AUTO_FOCUSES = [
    "conservation crises happening now: wildfires, floods, droughts and heatwaves hitting wildlife",
    "habitat loss and deforestation pushing animals out of their homes",
    "poaching and wildlife trafficking busts",
    "endangered species: rescues, comebacks and new population counts with a twist",
    "mass die-offs, disease outbreaks and strandings, and what is behind them",
    "primates: orangutans, gorillas, chimpanzees, monkeys and lemurs",
    "big cats and apex predators",
    "ocean animals: sharks, whales, dolphins and the deep sea",
    "coral reefs and marine heatwaves",
    "birds: migration, intelligence and record-breakers",
    "reptiles and amphibians",
    "insects, spiders and other invertebrates",
    "newly discovered species",
    "animal behaviour and intelligence studies with surprising results",
    "animal records: fastest, oldest, biggest, loudest",
    "biomimicry: technology copied from animals",
    "wildlife in Asia, especially Indonesia, India and Southeast Asia",
    "wildlife in Africa",
    "wildlife in the Americas, from the Amazon to the Arctic",
    "wildlife in Australia and the Pacific",
    "climate change and how animals are adapting or failing to",
    "animals and people: conflict, cities and coexistence"
] as const;

/** How many recent focuses a pick avoids, so consecutive runs cover different ground. */
export const RECENT_FOCUS_WINDOW = 6;

/** A random focus, skipping the most recent ones (falls back to any focus if all are recent). */
export function pickAutoFocus(recent: readonly string[], random: () => number = Math.random) {
    const avoid = new Set(recent.slice(0, RECENT_FOCUS_WINDOW));
    const fresh = AUTO_FOCUSES.filter((focus) => !avoid.has(focus));
    const pool = fresh.length ? fresh : AUTO_FOCUSES;
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
