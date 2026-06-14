const {existsSync, mkdirSync, readFileSync, writeFileSync} = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const moduleCache = new Map();

function readEnvFile(filePath) {
    if (!existsSync(filePath)) {
        return;
    }

    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }
        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}

function parseArgs(argv) {
    const args = {out: "docs/seo/behavior-lessons-gap-report.md"};
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--out" && argv[index + 1]) {
            args.out = argv[index + 1];
            index += 1;
        }
    }
    return args;
}

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
    const localRequire = (specifier) => {
        const localPath = resolveLocalModulePath(normalizedPath, specifier);
        return localPath ? loadTsModule(localPath) : require(specifier);
    };

    const runner = new Function("require", "module", "exports", "__filename", "__dirname", transpiled.outputText);
    runner(localRequire, module, module.exports, normalizedPath, path.dirname(normalizedPath));
    moduleCache.set(normalizedPath, module.exports);
    return module.exports;
}

function getSupabaseConfig() {
    const {getSupabaseUrl, getSupabaseServerReadKey, getSupabaseHeaders} = loadTsModule(
        path.resolve(process.cwd(), "src/lib/supabase-http.ts")
    );
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();

    if (!supabaseUrl || !key) {
        return null;
    }

    return {supabaseUrl, headers: getSupabaseHeaders(key)};
}

async function fetchAll(config, endpoint) {
    const rows = [];
    let offset = 0;

    while (true) {
        const separator = endpoint.includes("?") ? "&" : "?";
        const response = await fetch(
            `${config.supabaseUrl}${endpoint}${separator}limit=1000&offset=${offset}`,
            {headers: config.headers}
        );

        if (!response.ok) {
            throw new Error(`Fetch failed (${response.status}): ${endpoint}`);
        }

        const batch = await response.json();
        if (!Array.isArray(batch) || batch.length === 0) {
            break;
        }

        rows.push(...batch);
        if (batch.length < 1000) {
            break;
        }
        offset += 1000;
    }

    return rows;
}

function escapeCell(value) {
    return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function table(headers, rows) {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`)
    ].join("\n");
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    readEnvFile(path.resolve(process.cwd(), ".env.local"));
    readEnvFile(path.resolve(process.cwd(), ".env"));

    const config = getSupabaseConfig();
    if (!config) {
        throw new Error("Missing Supabase config");
    }

    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));
    const {getBehavioralPrincipleProfile} = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));

    const [principles, catalog] = await Promise.all([
        fetchAll(config, "/rest/v1/species_behavior_principles?select=principle_name,source,core_lesson,species_profile_id"),
        fetchAll(config, "/rest/v1/species_catalog_v1?select=landing_page_slug,normalized_identity_key,display_name,principle_name,core_lesson,short_motto,biological_basis,animaldex_number,catalog_status")
    ]);

    const bySlug = new Map();
    for (const row of catalog) {
        if (row.landing_page_slug) {
            bySlug.set(row.landing_page_slug, row);
        }
    }

    const websiteSlugs = new Set(speciesEntries.map((entry) => entry.slug));
    const websiteMissingDb = speciesEntries
        .filter((entry) => !bySlug.get(entry.slug)?.core_lesson)
        .map((entry) => {
            const localProfile = getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence);
            return {
                slug: entry.slug,
                name: entry.name,
                localPrinciple: localProfile?.principle ?? "—",
                localCoreLesson: localProfile?.coreLesson ?? "—"
            };
        });

    const catalogOnlyLessons = catalog
        .filter((row) => row.core_lesson && row.landing_page_slug && !websiteSlugs.has(row.landing_page_slug))
        .map((row) => ({
            slug: row.landing_page_slug,
            name: row.display_name,
            principle: row.principle_name,
            coreLesson: row.core_lesson,
            animaldexNumber: row.animaldex_number ?? "—",
            catalogStatus: row.catalog_status ?? "—"
        }))
        .sort((left, right) => String(left.animaldexNumber).localeCompare(String(right.animaldexNumber), undefined, {numeric: true}));

    const principleMismatch = speciesEntries
        .filter((entry) => bySlug.get(entry.slug)?.core_lesson)
        .map((entry) => {
            const dbRow = bySlug.get(entry.slug);
            const localProfile = getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence);
            return {
                slug: entry.slug,
                name: entry.name,
                dbPrinciple: dbRow.principle_name,
                localPrinciple: localProfile?.principle ?? "—"
            };
        })
        .filter((row) => row.dbPrinciple !== row.localPrinciple);

    const bySource = {};
    for (const row of principles) {
        bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    }

    const lines = [];
    lines.push("# Behavior Lessons Gap Report");
    lines.push("");
    lines.push(`_Generated: ${new Date().toISOString()}_`);
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- \`species_behavior_principles\` rows: **${principles.length}**`);
    lines.push(`- Catalog rows with \`core_lesson\`: **${catalog.filter((row) => row.core_lesson).length}**`);
    lines.push(`- Website species pages: **${speciesEntries.length}**`);
    lines.push(`- Website species with DB lesson coverage: **${speciesEntries.length - websiteMissingDb.length} / ${speciesEntries.length}**`);
    lines.push(`- Website species missing DB lesson: **${websiteMissingDb.length}**`);
    lines.push(`- DB lessons without website page: **${catalogOnlyLessons.length}**`);
    lines.push(`- DB vs local inferred principle mismatches (now resolved on site via catalog priority): **${principleMismatch.length}**`);
    lines.push("");
    lines.push("## Source Breakdown (`species_behavior_principles`)");
    lines.push("");
    lines.push(table(
        ["Source", "Count"],
        Object.entries(bySource)
            .sort((left, right) => right[1] - left[1])
            .map(([source, count]) => [source, String(count)])
    ));
    lines.push("");
    lines.push("## Website Species Missing DB Lesson");
    lines.push("");
    lines.push("These pages still fall back to locally inferred principles until catalog backfill exists.");
    lines.push("");
    lines.push(table(
        ["Animal", "Slug", "Local inferred principle", "Local inferred core lesson"],
        websiteMissingDb.map((row) => [row.name, `\`${row.slug}\``, row.localPrinciple, row.localCoreLesson])
    ));
    lines.push("");
    lines.push("## DB Lessons Missing Website Page");
    lines.push("");
    lines.push("Catalog rows with `core_lesson` and `landing_page_slug`, but no matching website species page.");
    lines.push("");
    lines.push(table(
        ["Animal", "Slug", "Principle", "Core lesson", "animaldex_number", "catalog_status"],
        catalogOnlyLessons.map((row) => [row.name, `\`${row.slug}\``, row.principle, row.coreLesson, String(row.animaldexNumber), row.catalogStatus])
    ));
    lines.push("");
    lines.push("## Priority Guidance");
    lines.push("");
    lines.push("1. Backfill the website-missing set first so `/animal-lessons/[slug]` and animal pages can use catalog data everywhere.");
    lines.push("2. Add website species pages for high-intent catalog-only animals, starting with numbered active catalog entries.");
    lines.push("3. Keep `/principles/*` as the 10-cluster browse layer; species-specific DB principles should surface through `/animal-lessons/[slug]`.");
    lines.push("4. Re-run `node scripts/generateBehaviorLessonsGapReport.js` after each behavior backfill batch.");

    const outPath = path.resolve(process.cwd(), args.out);
    mkdirSync(path.dirname(outPath), {recursive: true});
    writeFileSync(outPath, lines.join("\n"), "utf8");
    console.log(`Generated ${outPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
