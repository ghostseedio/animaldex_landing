/**
 * Self-hosts two sizes of artwork for every Pokémon on /pokemon-animals:
 * a 96px table icon (icons/<slug>.webp) and a 256px hero image for the
 * detail page (art/<slug>.webp), both under public/images/pokemon-animals/.
 *
 * Source: PokeAPI's mirror of the official artwork (475×475 PNG), trimmed.
 * Existing files are skipped, so re-running only fills gaps (new Pokémon).
 *
 *   npx tsx scripts/fetch-pokemon-icons.mts [--cache <dir of <id>.png>] [--force]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {pokemonAnimalEntries} from "../src/data/pokemon-animal-counterparts";

const OUTPUTS = [
    {dir: path.resolve("public/images/pokemon-animals/icons"), size: 96, quality: 82},
    {dir: path.resolve("public/images/pokemon-animals/art"), size: 256, quality: 76}
];
const CONCURRENCY = 12;
const sourceUrl = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

const args = process.argv.slice(2);
const cacheDir = args.includes("--cache") ? args[args.indexOf("--cache") + 1] : null;
const force = args.includes("--force");

async function loadSource(id: number): Promise<Buffer> {
    const cached = cacheDir ? path.join(cacheDir, `${id}.png`) : null;
    if (cached && fs.existsSync(cached)) {
        return fs.readFileSync(cached);
    }

    for (let attempt = 1; ; attempt += 1) {
        const response = await fetch(sourceUrl(id));
        if (response.ok) {
            return Buffer.from(await response.arrayBuffer());
        }
        if (attempt === 3) {
            throw new Error(`HTTP ${response.status}`);
        }
    }
}

async function main() {
    OUTPUTS.forEach((output) => fs.mkdirSync(output.dir, {recursive: true}));
    const missing = (slug: string) => OUTPUTS.filter((output) => force || !fs.existsSync(path.join(output.dir, `${slug}.webp`)));
    const queue = pokemonAnimalEntries.filter((entry) => missing(entry.slug).length > 0);
    const failures: string[] = [];
    let next = 0;

    async function worker() {
        while (next < queue.length) {
            const entry = queue[next++];
            try {
                const source = await loadSource(entry.id);
                for (const output of missing(entry.slug)) {
                    await sharp(source)
                        .trim()
                        .resize(output.size, output.size, {fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}})
                        .webp({quality: output.quality, alphaQuality: 90, effort: 6})
                        .toFile(path.join(output.dir, `${entry.slug}.webp`));
                }
            } catch (error) {
                failures.push(`${entry.slug} (#${entry.id}): ${(error as Error).message}`);
            }
        }
    }

    await Promise.all(Array.from({length: CONCURRENCY}, worker));
    console.log(`Wrote artwork for ${queue.length - failures.length} of ${queue.length} Pokémon to public/images/pokemon-animals/{icons,art}`);
    if (failures.length > 0) {
        console.error(failures.join("\n"));
        process.exitCode = 1;
    }
}

void main();
