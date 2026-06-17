const {existsSync, mkdirSync, readFileSync, writeFileSync} = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const moduleCache = new Map();

const QUEUE_SPECIES = [
    {rank: 1, slug: "indus-river-dolphin", name: "Indus River Dolphin", principle: "Observation", wave: 1},
    {rank: 2, slug: "snowy-owl", name: "Snowy Owl", principle: "Observation"},
    {rank: 3, slug: "blue-ringed-octopus", name: "Blue-ringed Octopus", principle: "Observation"},
    {rank: 4, slug: "beluga-whale", name: "Beluga Whale", principle: "Observation"},
    {rank: 5, slug: "tiger-salamander", name: "Tiger Salamander", principle: "Resilience"},
    {rank: 6, slug: "gorilla", name: "Gorilla", principle: "Memory"},
    {rank: 7, slug: "black-rhinoceros", name: "Black Rhinoceros", principle: "Precision"},
    {rank: 8, slug: "sumatran-orangutan", name: "Sumatran Orangutan", principle: "Adaptability"},
    {rank: 9, slug: "lionfish", name: "Lionfish", principle: "Resilience"},
    {rank: 10, slug: "antlion", name: "Spotted-winged Antlion", principle: "Precision"},
    {rank: 11, slug: "adelie-penguin", name: "Adelie Penguin", principle: "Teamwork"},
    {rank: 12, slug: "fox", name: "Fox", principle: "Adaptability"},
    {rank: 13, slug: "remora", name: "Remora", principle: "Memory"},
    {rank: 14, slug: "blue-whale", name: "Blue Whale", principle: "Memory"},
    {rank: 15, slug: "elephant", name: "Elephant", principle: "Memory"},
    {rank: 16, slug: "philippine-eagle", name: "Philippine Eagle", principle: "Memory"},
    {rank: 17, slug: "giant-pacific-octopus", name: "Giant Pacific Octopus", principle: "Adaptability"},
    {rank: 18, slug: "polar-bear", name: "Polar Bear", principle: "Adaptability"},
    {rank: 19, slug: "great-white-shark", name: "Great White Shark", principle: "Memory"},
    {rank: 20, slug: "african-grey-parrot", name: "African Grey Parrot", principle: "Memory"},
    {rank: 21, slug: "alpine-newt", name: "Alpine Newt", principle: "Memory"},
    {rank: 22, slug: "african-bush-elephant", name: "African Bush Elephant", principle: "Precision"},
    {rank: 23, slug: "andean-goose", name: "Andean Goose", principle: "Memory"},
    {rank: 24, slug: "aardwolf", name: "Aardwolf", principle: "Precision"},
    {rank: 25, slug: "blue-tongued-skink", name: "Blue-tongued Skink", principle: "Observation", wave: 1}
];

const WAVE2_SPECIES = [
    {rank: 26, slug: "lion", name: "Lion", principle: "Teamwork", wave: 2},
    {rank: 27, slug: "wolf", name: "Wolf", principle: "Teamwork", wave: 2},
    {rank: 28, slug: "dolphin", name: "Dolphin", principle: "Communication", wave: 2},
    {rank: 29, slug: "eagle", name: "Eagle", principle: "Efficiency", wave: 2},
    {rank: 30, slug: "raven", name: "Raven", principle: "Memory", wave: 2},
    {rank: 31, slug: "cat", name: "Cat", principle: "Stealth", wave: 2},
    {rank: 32, slug: "tiger", name: "Tiger", principle: "Stealth", wave: 2}
];

const WAVE3_SPECIES = [
    {rank: 33, slug: "chameleon", name: "Chameleon", principle: "Observation", wave: 3},
    {rank: 34, slug: "crocodile", name: "Crocodile", principle: "Efficiency", wave: 3},
    {rank: 35, slug: "leopard", name: "Leopard", principle: "Stealth", wave: 3},
    {rank: 36, slug: "jellyfish", name: "Jellyfish", principle: "Efficiency", wave: 3},
    {rank: 37, slug: "orangutan", name: "Orangutan", principle: "Memory", wave: 3},
    {rank: 38, slug: "owl", name: "Owl", principle: "Observation", wave: 3},
    {rank: 39, slug: "dragonfly", name: "Dragonfly", principle: "Precision", wave: 3}
];

const ALL_QUEUE_SPECIES = [...QUEUE_SPECIES.map((e) => ({...e, wave: e.wave ?? 1})), ...WAVE2_SPECIES, ...WAVE3_SPECIES];

const LEGACY_SYMBOLISM = ["axolotl", "snake", "octopus"];

function resolveLocalModulePath(fromFile, specifier) {
    if (specifier.startsWith("@/")) {
        return path.resolve(process.cwd(), "src", `${specifier.slice(2)}.ts`);
    }
    if (specifier.startsWith(".")) {
        return path.resolve(path.dirname(fromFile), `${specifier}.ts`);
    }
    return null;
}

function loadTsModule(filePath) {
    const normalizedPath = path.normalize(filePath);
    if (moduleCache.has(normalizedPath)) {
        return moduleCache.get(normalizedPath);
    }
    const source = readFileSync(normalizedPath, "utf8");
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true},
        fileName: normalizedPath
    });
    const module = {exports: {}};
    const localRequire = (specifier) => {
        const localPath = resolveLocalModulePath(normalizedPath, specifier);
        return localPath ? loadTsModule(localPath) : require(specifier);
    };
    const runner = new Function("require", "module", "exports", "__filename", "__dirname", transpiled.outputText);
    runner(localRequire, module, module.exports, normalizedPath, path.dirname(normalizedPath));
    moduleCache.set(normalizedPath, module.exports);
    return module.exports;
}

function csvEscape(value) {
    const text = String(value ?? "");
    return text.includes(",") || text.includes("\"") || text.includes("\n")
        ? `"${text.replace(/"/g, "\"\"")}"`
        : text;
}

function countImages(slug) {
    const dir = path.join(process.cwd(), "public/images/blog", `${slug}-symbolism`);
    if (!existsSync(dir)) return 0;
    return require("node:fs").readdirSync(dir).filter((f) => f.endsWith(".webp")).length;
}

function main() {
    const blog = loadTsModule(path.join(process.cwd(), "src/data/blog.ts"));
    const principlesSource = readFileSync(path.join(process.cwd(), "src/data/species-behavioral-principles.ts"), "utf8");
    const curatedSlugs = new Set([...principlesSource.matchAll(/^\s{4}(\w[\w-]*):\s*\{/gm)].map((m) => m[1]));

    const liveSlugs = new Set(
        blog.blogPosts.filter((p) => p.slug.endsWith("-symbolism")).map((p) => p.slug.replace(/-symbolism$/, ""))
    );

    const rows = ALL_QUEUE_SPECIES.map((entry) => {
        const blogSlug = `${entry.slug}-symbolism`;
        const post = blog.blogPosts.find((p) => p.slug === blogSlug);
        const status = post ? "live" : "pending";
        const related = ALL_QUEUE_SPECIES
            .filter((e) => e.principle === entry.principle && e.slug !== entry.slug)
            .slice(0, 3)
            .map((e) => `${e.slug}-symbolism`)
            .join("|");

        return {
            wave: entry.wave,
            priority_rank: entry.rank,
            species_slug: entry.slug,
            display_name: entry.name,
            principle: entry.principle,
            target_keyword: `${entry.name.toLowerCase()} meaning`,
            status,
            blog_slug: blogSlug,
            image_count: countImages(entry.slug),
            sources_count: post?.sources?.length ?? 0,
            curated_profile: curatedSlugs.has(entry.slug) ? "yes" : "no",
            related_symbolism_slugs: related
        };
    });

    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");

    const mdDir = path.join(process.cwd(), "docs/seo");
    mkdirSync(mdDir, {recursive: true});
    writeFileSync(path.join(mdDir, "symbolism-blog-queue.csv"), csv);

    const md = [
        "# Symbolism Blog Queue",
        "",
        `_Generated: ${new Date().toISOString()}_`,
        "",
        "## Summary",
        "",
        `- Wave 1 queue: ${QUEUE_SPECIES.length} species`,
        `- Wave 2 flagship: ${WAVE2_SPECIES.length} species`,
        `- Wave 3 P0 systems-intelligence: ${WAVE3_SPECIES.length} species`,
        `- Total queued: ${ALL_QUEUE_SPECIES.length}`,
        `- Live queue posts: ${rows.filter((r) => r.status === "live").length}`,
        `- Legacy symbolism (pre-queue): ${LEGACY_SYMBOLISM.join(", ")}`,
        `- Total live symbolism posts: ${liveSlugs.size}`,
        "",
        "## Wave 3 — P0 Systems-Intelligence Sprint Board",
        "",
        "| Rank | Animal | Slug | Principle | Status | Images | Sources | Curated |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ...rows.filter((r) => r.wave === 3).map((r) =>
            `| ${r.priority_rank} | ${r.display_name} | \`${r.species_slug}\` | ${r.principle} | ${r.status} | ${r.image_count} | ${r.sources_count} | ${r.curated_profile} |`
        ),
        "",
        "## Wave 2 — Flagship Sprint Board",
        "",
        "| Rank | Animal | Slug | Principle | Status | Images | Sources | Curated |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ...rows.filter((r) => r.wave === 2).map((r) =>
            `| ${r.priority_rank} | ${r.display_name} | \`${r.species_slug}\` | ${r.principle} | ${r.status} | ${r.image_count} | ${r.sources_count} | ${r.curated_profile} |`
        ),
        "",
        "## Wave 1 — Sprint Board",
        "",
        "| Rank | Animal | Slug | Principle | Status | Images | Sources | Curated |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ...rows.filter((r) => r.wave === 1).map((r) =>
            `| ${r.priority_rank} | ${r.display_name} | \`${r.species_slug}\` | ${r.principle} | ${r.status} | ${r.image_count} | ${r.sources_count} | ${r.curated_profile} |`
        )
    ].join("\n");

    writeFileSync(path.join(mdDir, "symbolism-blog-queue.md"), md);
    console.log(`Wrote docs/seo/symbolism-blog-queue.csv and .md (${rows.filter((r) => r.status === "live").length}/${rows.length} live).`);
}

main();
