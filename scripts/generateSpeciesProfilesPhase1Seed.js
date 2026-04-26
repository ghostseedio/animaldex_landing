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

function clampStatValue(value) {
    return Math.max(1, Math.min(100, Math.round(value)));
}

function buildDeterministicCanonicalStats(entry) {
    const category = entry.analysis.category.toLowerCase();
    const description = [
        entry.name,
        entry.analysis.summary,
        entry.analysis.habitat,
        entry.analysis.nativeRange,
        ...entry.analysis.identification
    ]
        .join(" ")
        .toLowerCase();
    const hash = Array.from(entry.slug).reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
    const jitter = (offset) => ((hash + offset * 17) % 11) - 5;
    const hasKeyword = (pattern) => pattern.test(description) || pattern.test(category);
    const rarity = clampStatValue(entry.analysis.rarityScore);

    let dominance = 42;
    let speed = 40;
    let size = 34;
    let intelligence = 32;

    if (hasKeyword(/primate/)) {
        dominance += 10;
        intelligence += 28;
        speed += 8;
        size += 8;
    } else if (hasKeyword(/bird of prey|raptor|eagle|falcon|owl/)) {
        dominance += 22;
        speed += 18;
        size += 10;
        intelligence += 10;
    } else if (hasKeyword(/bird|penguin|parrot|hummingbird/)) {
        dominance += 2;
        speed += 20;
        size -= 4;
        intelligence += 8;
    } else if (hasKeyword(/mammal|cat|dog|fox|wolf|bear|seal|whale|elephant|deer|antelope/)) {
        dominance += 14;
        speed += 8;
        size += 14;
        intelligence += 10;
    } else if (hasKeyword(/reptile|snake|lizard|crocodile|turtle|tortoise/)) {
        dominance += 16;
        speed -= 6;
        size += 10;
        intelligence -= 4;
    } else if (hasKeyword(/fish|shark|ray|eel|tuna/)) {
        dominance += 12;
        speed += 14;
        size += 4;
    } else if (hasKeyword(/amphibian|frog|toad|salamander|newt/)) {
        dominance -= 4;
        speed -= 6;
        size -= 10;
    } else if (hasKeyword(/insect|beetle|ant|wasp|moth|butterfly|spider|octopus|jellyfish|clam|crab/)) {
        dominance -= 10;
        speed -= 4;
        size -= 16;
        intelligence -= 4;
    }

    if (hasKeyword(/apex|predator|hunter|ambush|venom|fang|claw|talon|stalk|kills/)) {
        dominance += 18;
    }

    if (hasKeyword(/fast|swift|speed|quick|sprint|dart|dive|leap|glide|soar|arrow|torpedo/)) {
        speed += 18;
    }

    if (hasKeyword(/slow|patient|still|drift|bask|wait|gentle/)) {
        speed -= 12;
    }

    if (hasKeyword(/giant|huge|largest|massive|towering|enormous|biggest/)) {
        size += 28;
        dominance += 10;
        speed -= 4;
    }

    if (hasKeyword(/small|tiny|little|mini|compact|pocket-sized/)) {
        size -= 20;
        speed += 6;
        dominance -= 8;
    }

    if (hasKeyword(/smart|intelligent|problem|tool|memory|social|thinking|clever|learn/)) {
        intelligence += 22;
    }

    if (hasKeyword(/armor|armored|shield|shell|fortress/)) {
        dominance += 8;
        size += 4;
    }

    return {
        dominance: clampStatValue(dominance + jitter(1)),
        speed: clampStatValue(speed + jitter(2)),
        size: clampStatValue(size + jitter(3)),
        intelligence: clampStatValue(intelligence + jitter(4)),
        rarity
    };
}

function toNormalizedIdentityKey(entry) {
    return (entry.normalizedIdentityKey ?? entry.slug).replaceAll("-", "_");
}

function buildPhase1Row(entry) {
    return {
        normalized_identity_key: toNormalizedIdentityKey(entry),
        display_name: entry.name,
        animal_name: entry.name,
        refined_identity: entry.name,
        scientific_name: entry.analysis.scientificName,
        identity_source: "scientific_name",
        canonical_game_stats: buildDeterministicCanonicalStats(entry),
        landing_page_slug: entry.slug,
        catalog_source: "landing_repo",
        catalog_status: "seeded"
    };
}

function parseArgs(argv) {
    const args = {
        format: "json",
        out: null
    };

    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];

        if (value === "--format" && argv[index + 1]) {
            args.format = argv[index + 1];
            index += 1;
            continue;
        }

        if (value === "--out" && argv[index + 1]) {
            args.out = argv[index + 1];
            index += 1;
        }
    }

    if (!["json", "sql"].includes(args.format)) {
        throw new Error(`Unsupported format "${args.format}". Use "json" or "sql".`);
    }

    return args;
}

function escapeSql(value) {
    return value.replaceAll("'", "''");
}

function toSqlLiteral(value) {
    if (value === null || value === undefined) {
        return "null";
    }

    if (typeof value === "object") {
        return `'${escapeSql(JSON.stringify(value))}'::jsonb`;
    }

    return `'${escapeSql(String(value))}'`;
}

function buildSql(rows) {
    const values = rows.map((row) => `    (${[
        row.normalized_identity_key,
        row.display_name,
        row.animal_name,
        row.refined_identity,
        row.scientific_name,
        row.identity_source,
        row.canonical_game_stats,
        row.landing_page_slug,
        row.catalog_source,
        row.catalog_status
    ].map(toSqlLiteral).join(", ")})`);

    return `insert into public.species_profiles (
    normalized_identity_key,
    display_name,
    animal_name,
    refined_identity,
    scientific_name,
    identity_source,
    canonical_game_stats,
    landing_page_slug,
    catalog_source,
    catalog_status
)
values
${values.join(",\n")}
on conflict (normalized_identity_key) do update
set display_name = excluded.display_name,
    animal_name = excluded.animal_name,
    refined_identity = excluded.refined_identity,
    scientific_name = excluded.scientific_name,
    identity_source = excluded.identity_source,
    canonical_game_stats = excluded.canonical_game_stats,
    landing_page_slug = excluded.landing_page_slug,
    catalog_source = excluded.catalog_source,
    catalog_status = excluded.catalog_status,
    updated_at = timezone('utc', now());
`;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const rows = speciesEntries.map(buildPhase1Row);
    const output = args.format === "sql"
        ? buildSql(rows)
        : JSON.stringify({
            generatedAt: new Date().toISOString(),
            source: "landing_repo",
            totalSpecies: rows.length,
            rows
        }, null, 2);

    if (!args.out) {
        process.stdout.write(output);
        return;
    }

    const targetPath = path.resolve(process.cwd(), args.out);
    mkdirSync(path.dirname(targetPath), {recursive: true});
    writeFileSync(targetPath, output, "utf8");
    console.log(`Generated ${targetPath} with ${rows.length} species profile rows in ${args.format} format.`);
}

main();
