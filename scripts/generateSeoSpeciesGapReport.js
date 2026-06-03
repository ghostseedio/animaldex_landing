const {mkdirSync, readFileSync, writeFileSync} = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const moduleCache = new Map();

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
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true
        },
        fileName: normalizedPath
    });

    const module = {exports: {}};
    moduleCache.set(normalizedPath, module.exports);

    const localRequire = (specifier) => {
        const localPath = resolveLocalModulePath(normalizedPath, specifier);
        if (localPath) {
            return loadTsModule(localPath);
        }
        return require(specifier);
    };

    const runner = new Function("require", "module", "exports", "__filename", "__dirname", transpiled.outputText);
    runner(localRequire, module, module.exports, normalizedPath, path.dirname(normalizedPath));

    moduleCache.set(normalizedPath, module.exports);
    return module.exports;
}

const SOURCE_PACK_CONFIG = [
    {label: "pack-1", file: "species-expansion-pack.ts", exportName: "additionalSpeciesEntriesInput"},
    {label: "pack-2", file: "species-expansion-pack-2.ts", exportName: "additionalSpeciesEntriesInputTwo"},
    {label: "pack-3", file: "species-expansion-pack-3.ts", exportName: "additionalSpeciesEntriesInputThree"},
    {label: "pack-4", file: "species-expansion-pack-4.ts", exportName: "additionalSpeciesEntriesInputFour"},
    {label: "pack-5", file: "species-expansion-pack-5.ts", exportName: "additionalSpeciesEntriesInputFive"},
    {label: "pack-6", file: "species-expansion-pack-6.ts", exportName: "additionalSpeciesEntriesInputSix"},
    {label: "pack-7", file: "species-expansion-pack-7.ts", exportName: "additionalSpeciesEntriesInputSeven"},
    {label: "pack-8", file: "species-expansion-pack-8.ts", exportName: "additionalSpeciesEntriesInputEight"},
    {label: "pack-9", file: "species-expansion-pack-9.ts", exportName: "additionalSpeciesEntriesInputNine"},
    {label: "pack-10", file: "species-expansion-pack-10.ts", exportName: "additionalSpeciesEntriesInputTen"},
    {label: "pack-11", file: "species-expansion-pack-11.ts", exportName: "additionalSpeciesEntriesInputEleven"},
    {label: "pack-12", file: "species-expansion-pack-12.ts", exportName: "additionalSpeciesEntriesInputTwelve"},
    {label: "pack-13", file: "species-expansion-pack-13.ts", exportName: "additionalSpeciesEntriesInputThirteen"},
    {label: "pack-14", file: "species-expansion-pack-14.ts", exportName: "additionalSpeciesEntriesInputFourteen"},
    {label: "pack-15", file: "species-expansion-pack-15.ts", exportName: "additionalSpeciesEntriesInputFifteen"}
];

const FLAGSHIP_CANDIDATES = [
    "Harpy Eagle",
    "Cockroach",
    "Anglerfish",
    "Alligator Snapping Turtle",
    "Barn Owl",
    "Bald Eagle",
    "Snowy Owl",
    "Great Horned Owl",
    "Komodo Dragon",
    "Polar Bear",
    "Orangutan",
    "Cheetah",
    "White Rhinoceros",
    "Black Rhinoceros",
    "Octopus",
    "Wandering Albatross",
    "Pigeon",
    "Goose",
    "Dolphin",
    "Gorilla",
    "Shark",
    "Elephant",
    "Axolotl",
    "Kookaburra"
];

const FALLBACK_ARCHETYPE_TERMS = ["Bird", "Fish", "Cat", "Dog", "Turtle", "Eagle", "Owl"];

function parseArgs(argv) {
    const args = {
        out: "docs/seo/animaldex-seo-gap-report.md"
    };

    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (value === "--out" && argv[index + 1]) {
            args.out = argv[index + 1];
            index += 1;
        }
    }

    return args;
}

function toSlug(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function buildSourceMap() {
    const sourceMap = new Map();

    for (const config of SOURCE_PACK_CONFIG) {
        const modulePath = path.resolve(process.cwd(), "src/data", config.file);
        const exported = loadTsModule(modulePath)[config.exportName] ?? [];

        for (const item of exported) {
            if (!item || !item.slug) {
                continue;
            }
            sourceMap.set(item.slug, config.label);
        }
    }

    return sourceMap;
}

function toMarkdownTable(headers, rows) {
    const headerLine = `| ${headers.join(" | ")} |`;
    const divider = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
    return [headerLine, divider, body].filter(Boolean).join("\n");
}

function buildReport() {
    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));
    const {getBehavioralPrincipleProfile} = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));

    const sourceMap = buildSourceMap();
    const totalSpecies = speciesEntries.length;
    const speciesBySlug = new Map(speciesEntries.map((entry) => [entry.slug, entry]));

    const principleProfiles = speciesEntries.map((entry) => ({
        entry,
        profile: getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence)
    }));
    const withPrinciple = principleProfiles.filter((item) => Boolean(item.profile));
    const withoutPrinciple = principleProfiles.filter((item) => !item.profile);

    const principleCounts = new Map();
    const principleSourceCounts = new Map();
    for (const item of withPrinciple) {
        const key = item.profile.principle;
        principleCounts.set(key, (principleCounts.get(key) ?? 0) + 1);
        const sourceKey = item.profile.source;
        principleSourceCounts.set(sourceKey, (principleSourceCounts.get(sourceKey) ?? 0) + 1);
    }

    const categoryCounts = new Map();
    for (const entry of speciesEntries) {
        const category = entry.analysis.category;
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }

    const sourceCounts = new Map();
    for (const entry of speciesEntries) {
        const source = sourceMap.get(entry.slug) ?? "core-species-ts";
        sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }

    const flagshipRows = FLAGSHIP_CANDIDATES.map((name) => {
        const slug = toSlug(name);
        const entry = speciesBySlug.get(slug);
        const profile = entry
            ? getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence)
            : null;
        return {
            name,
            slug,
            status: entry ? "Present" : "Missing",
            principle: profile ? profile.principle : "None",
            priority: entry ? (profile ? "Maintain" : "Backfill principle") : "Create species page"
        };
    });

    const missingFlagships = flagshipRows.filter((row) => row.status === "Missing");
    const presentMissingPrinciple = flagshipRows.filter((row) => row.status === "Present" && row.principle === "None");
    const presentWithPrinciple = flagshipRows.filter((row) => row.status === "Present" && row.principle !== "None");

    const underCoveredPrinciples = Array.from(principleCounts.entries())
        .filter(([, count]) => count < 5)
        .sort((a, b) => a[1] - b[1]);

    const highPriorityOpportunities = [
        ...missingFlagships.slice(0, 8).map((item) => `Create ${item.name} species page for flagship SEO coverage.`),
        ...presentMissingPrinciple.slice(0, 8).map((item) => `Backfill Behavioral Principle for ${item.name}.`),
        ...underCoveredPrinciples.slice(0, 6).map(([principle, count]) => `Expand "${principle}" coverage (currently ${count} species).`)
    ];

    const likelyGenericSpeciesEntries = speciesEntries
        .filter((entry) => FALLBACK_ARCHETYPE_TERMS.includes(entry.name))
        .map((entry) => entry.name);

    const lines = [];
    lines.push("# AnimalDex SEO Gap Report");
    lines.push("");
    lines.push(`_Generated: ${new Date().toISOString()}_`);
    lines.push("");
    lines.push("## Scope");
    lines.push("");
    lines.push("- Source dataset: `speciesEntries`");
    lines.push("- Focus: species coverage, behavioral principle coverage, SEO expansion priorities");
    lines.push("- Note: Website-only audit. No app, Supabase, or edge-function changes.");
    lines.push("");
    lines.push("## Snapshot");
    lines.push("");
    lines.push(`- Total species page count: **${totalSpecies}**`);
    lines.push(`- Animals with Behavioral Principle data: **${withPrinciple.length}**`);
    lines.push(`- Animals missing Behavioral Principle data: **${withoutPrinciple.length}**`);
    lines.push(`- Distinct principles represented: **${principleCounts.size}**`);
    lines.push("");
    lines.push("## Count by Category");
    lines.push("");
    lines.push(toMarkdownTable(
        ["Category", "Count"],
        Array.from(categoryCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([category, count]) => [category, String(count)])
    ));
    lines.push("");
    lines.push("## Count by Source Pack");
    lines.push("");
    lines.push(toMarkdownTable(
        ["Source", "Count"],
        Array.from(sourceCounts.entries())
            .sort((a, b) => {
                if (a[0] === "core-species-ts") return -1;
                if (b[0] === "core-species-ts") return 1;
                return a[0].localeCompare(b[0], undefined, {numeric: true});
            })
            .map(([source, count]) => [source, String(count)])
    ));
    lines.push("");
    lines.push("## Principle Coverage");
    lines.push("");
    lines.push(toMarkdownTable(
        ["Principle", "Species Count"],
        Array.from(principleCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([principle, count]) => [principle, String(count)])
    ));
    lines.push("");
    lines.push("## Principle Source Distribution");
    lines.push("");
    lines.push(toMarkdownTable(
        ["Source", "Count"],
        ["systems_intelligence", "inferred", "fallback", "manual"]
            .map((source) => [source, String(principleSourceCounts.get(source) ?? 0)])
    ));
    lines.push("");
    lines.push("## Animals With Principle Data");
    lines.push("");
    lines.push(withPrinciple.map((item) => `- ${item.entry.name} (${item.profile.principle})`).join("\n"));
    lines.push("");
    lines.push("## Animals Missing Principle Data");
    lines.push("");
    lines.push(withoutPrinciple.map((item) => `- ${item.entry.name} (\`${item.entry.slug}\`)`).join("\n"));
    lines.push("");
    lines.push("## Flagship Candidate Status");
    lines.push("");
    lines.push(toMarkdownTable(
        ["Animal", "Slug", "Status", "Principle", "Priority"],
        flagshipRows.map((row) => [row.name, `\`${row.slug}\``, row.status, row.principle, row.priority])
    ));
    lines.push("");
    lines.push("## Top Missing Flagship Animals");
    lines.push("");
    if (missingFlagships.length === 0) {
        lines.push("- None from current seeded flagship list.");
    } else {
        lines.push(missingFlagships.map((item) => `- ${item.name}`).join("\n"));
    }
    lines.push("");
    lines.push("## High-Priority SEO Opportunities");
    lines.push("");
    if (highPriorityOpportunities.length === 0) {
        lines.push("- No immediate opportunities detected.");
    } else {
        lines.push(highPriorityOpportunities.map((item) => `- ${item}`).join("\n"));
    }
    lines.push("");
    lines.push("## Generic/Archetype Concept Guidance");
    lines.push("");
    lines.push("Generic terms like **Bird, Fish, Cat, Dog, Turtle, Eagle, Owl** should be treated as fallback/archetype concepts, not preferred numbered collectible identities.");
    lines.push("");
    lines.push(`- Existing species entries that exactly match archetype terms: ${likelyGenericSpeciesEntries.length > 0 ? likelyGenericSpeciesEntries.join(", ") : "None detected"}`);
    lines.push(`- Fallback archetype concept terms: ${FALLBACK_ARCHETYPE_TERMS.join(", ")}`);
    lines.push("");
    lines.push("## Recommended Phase 2 Additions");
    lines.push("");
    lines.push("- Add missing flagship animal pages from this audit before long-tail expansion.");
    lines.push("- Backfill Behavioral Principle coverage for all present flagship species.");
    lines.push("- Increase coverage in under-represented principles to balance internal semantic clusters.");
    lines.push("- Add principle-aware internal links to every species page with backfilled principle data.");
    lines.push("- Keep archetype terms as concept-level fallbacks and map users into specific species pages.");
    lines.push("");
    lines.push("## Principle Under-Coverage Detail");
    lines.push("");
    if (underCoveredPrinciples.length === 0) {
        lines.push("- No principles below the current threshold (<5 species).");
    } else {
        lines.push(underCoveredPrinciples.map(([principle, count]) => `- ${principle}: ${count} species`).join("\n"));
    }
    lines.push("");
    lines.push("## Data Notes");
    lines.push("");
    lines.push("- Source-pack classification is inferred from expansion pack exports; all other species are grouped under `core-species-ts`.");
    lines.push("- Behavioral Principle presence is based on `getBehavioralPrincipleProfile(...)` resolution for each species.");

    return lines.join("\n");
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const report = buildReport();
    const outPath = path.resolve(process.cwd(), args.out);
    mkdirSync(path.dirname(outPath), {recursive: true});
    writeFileSync(outPath, report, "utf8");
    console.log(`Generated ${outPath}`);
}

main();
