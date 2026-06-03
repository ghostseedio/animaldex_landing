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
        return localPath ? loadTsModule(localPath) : require(specifier);
    };

    const runner = new Function("require", "module", "exports", "__filename", "__dirname", transpiled.outputText);
    runner(localRequire, module, module.exports, normalizedPath, path.dirname(normalizedPath));
    moduleCache.set(normalizedPath, module.exports);
    return module.exports;
}

function parseArgs(argv) {
    const args = {out: "docs/seo/animaldex-missing-principles-review.md"};
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--out" && argv[index + 1]) {
            args.out = argv[index + 1];
            index += 1;
        }
    }
    return args;
}

function toTable(headers, rows) {
    const header = `| ${headers.join(" | ")} |`;
    const divider = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
    return [header, divider, body].join("\n");
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));
    const {getBehavioralPrincipleProfile} = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));

    const currentlyMissing = speciesEntries
        .filter((entry) => !speciesSystemsIntelligence[entry.slug])
        .map((entry) => ({
            entry,
            suggested: getBehavioralPrincipleProfile(entry.slug, null, speciesSystemsIntelligence)
        }))
        .filter((item) => Boolean(item.suggested));

    const principleCounts = new Map();
    for (const item of currentlyMissing) {
        const key = item.suggested.principle;
        principleCounts.set(key, (principleCounts.get(key) ?? 0) + 1);
    }

    const lines = [];
    lines.push("# AnimalDex Missing Principles Review");
    lines.push("");
    lines.push(`_Generated: ${new Date().toISOString()}_`);
    lines.push("");
    lines.push("## Purpose");
    lines.push("");
    lines.push("- Review recommendations for species that previously lacked Behavioral Principle coverage.");
    lines.push("- Suggested fields are generated for editorial review before hard-curating each species.");
    lines.push("");
    lines.push("## Snapshot");
    lines.push("");
    lines.push(`- Species currently missing systems-intelligence-backed principle records: **${currentlyMissing.length}**`);
    lines.push("- Each row includes recommended principle, motto, core lesson, and biological basis.");
    lines.push("");
    lines.push("## Principle Distribution (Missing Set)");
    lines.push("");
    lines.push(toTable(
        ["Principle", "Count"],
        Array.from(principleCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([principle, count]) => [principle, String(count)])
    ));
    lines.push("");
    lines.push("## Recommended Backfill Records");
    lines.push("");
    lines.push(toTable(
        ["Animal", "Slug", "Suggested Principle", "Motto", "Core Lesson", "Biological Basis"],
        currentlyMissing.map((item) => [
            item.entry.name,
            `\`${item.entry.slug}\``,
            item.suggested.principle,
            item.suggested.motto.replace(/\|/g, "/"),
            item.suggested.coreLesson.replace(/\|/g, "/"),
            item.suggested.biologicalBasis.replace(/\|/g, "/")
        ])
    ));
    lines.push("");
    lines.push("## Editorial Notes");
    lines.push("");
    lines.push("- These recommendations are biology-first placeholders; prioritize curated wording for flagship species.");
    lines.push("- Avoid mystical framing; keep explanations in behavior, adaptation, and survival mechanics.");
    lines.push("- After approval, promote reviewed entries into curated principle profiles.");

    const outPath = path.resolve(process.cwd(), args.out);
    mkdirSync(path.dirname(outPath), {recursive: true});
    writeFileSync(outPath, lines.join("\n"), "utf8");
    console.log(`Generated ${outPath}`);
}

main();
