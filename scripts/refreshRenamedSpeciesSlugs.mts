/**
 * Record species pages whose URL changed in this snapshot refresh into
 * src/data/renamed-species-slugs.json, which next.config.js turns into
 * permanent redirects.
 *
 * A DB-only species' URL is its catalog landing_page_slug, else its identity
 * key. When the catalog gives a species a common-name slug (lutra-lutra →
 * european-otter), the refreshed snapshot drops the old slug, and because
 * /animals is a closed SSG namespace the old, already indexed URL would 404.
 * This compares the committed snapshot (HEAD) with the refreshed one and maps
 * each dropped slug to the same species' new slug. A dropped slug with no
 * successor (a species hidden and merged into another) is printed; add it to
 * the JSON by hand.
 *
 *   npx tsx scripts/refreshRenamedSpeciesSlugs.mts
 *
 * Run it after the snapshots are rewritten and before they are committed.
 */
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

type AnimalPage = {slug: string; speciesProfileId?: string | null; normalizedIdentityKey?: string | null};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const PAGES = "src/data/published-seo-animal-pages.json";
const SLUGS = "src/data/published-seo-slugs.json";
const OUTPUT = join(root, "src/data/renamed-species-slugs.json");

function committed<T>(path: string): T {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${path}`], {cwd: root, encoding: "utf8", maxBuffer: 512 * 1024 * 1024}));
}

function current<T>(path: string): T {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
}

const before = committed<{entries: AnimalPage[]}>(PAGES).entries;
const after = current<{entries: AnimalPage[]}>(PAGES).entries;
const publishedBefore = new Set(committed<{animals: string[]}>(SLUGS).animals);
const published = new Set(current<{animals: string[]}>(SLUGS).animals);

const afterByProfile = new Map<string, string>();
const afterByIdentity = new Map<string, string>();
for (const entry of after) {
    if (entry.speciesProfileId && !afterByProfile.has(entry.speciesProfileId)) afterByProfile.set(entry.speciesProfileId, entry.slug);
    if (entry.normalizedIdentityKey && !afterByIdentity.has(entry.normalizedIdentityKey)) afterByIdentity.set(entry.normalizedIdentityKey, entry.slug);
}
const beforeBySlug = new Map(before.map((entry) => [entry.slug, entry]));

const existing: Record<string, string> = existsSync(OUTPUT)
    ? (JSON.parse(readFileSync(OUTPUT, "utf8")) as {redirects?: Record<string, string>}).redirects ?? {}
    : {};
const redirects: Record<string, string> = {...existing};
const added: string[] = [];
const orphaned: string[] = [];

for (const slug of publishedBefore) {
    if (published.has(slug)) continue;
    const entry = beforeBySlug.get(slug);
    const successor = entry
        ? (entry.speciesProfileId && afterByProfile.get(entry.speciesProfileId)) || (entry.normalizedIdentityKey && afterByIdentity.get(entry.normalizedIdentityKey))
        : undefined;
    if (successor && successor !== slug && published.has(successor)) {
        if (redirects[slug] !== successor) added.push(`${slug} -> ${successor}`);
        redirects[slug] = successor;
    } else if (!redirects[slug]) {
        orphaned.push(slug);
    }
}

// Follow chains (a → b, then b renamed to c) and drop entries that no longer
// lead to a published page or whose source is published again.
const resolved: Record<string, string> = {};
const dropped: string[] = [];
for (const [from, to] of Object.entries(redirects)) {
    let target = to;
    const seen = new Set([from]);
    while (redirects[target] && !seen.has(target)) {
        seen.add(target);
        target = redirects[target];
    }
    if (published.has(from) || !published.has(target) || target === from) {
        dropped.push(`${from} -> ${target}`);
        continue;
    }
    resolved[from] = target;
}

const sorted = Object.fromEntries(Object.entries(resolved).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUTPUT, `${JSON.stringify({
    note: "Species slugs that were published and then renamed or merged. next.config.js 308s each one to its current page. Maintained by scripts/refreshRenamedSpeciesSlugs.mts; merges it cannot detect are added by hand.",
    redirects: sorted
}, null, 2)}\n`);

console.log(`renamed species slugs: ${Object.keys(sorted).length} (${added.length} new)`);
for (const line of added) console.log(`  + ${line}`);
for (const line of dropped) console.log(`  - dropped ${line}`);
if (orphaned.length) {
    console.warn(`unpublished with no successor (they will 404; add a redirect by hand if the species merged): ${orphaned.join(" ")}`);
}
