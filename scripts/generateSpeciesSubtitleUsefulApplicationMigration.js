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

function escapeSql(value) {
    return value.replaceAll("'", "''");
}

const {speciesDescriptors} = loadTsModule(path.resolve(process.cwd(), "src/data/species-descriptors.ts"));
const {speciesSubtitleStories} = loadTsModule(path.resolve(process.cwd(), "src/data/species-subtitle-stories.ts"));

const targetPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20260411_upsert_species_subtitles_useful_application.sql"
);

const slugs = Object.keys(speciesSubtitleStories).sort();
const missingDescriptors = slugs.filter((slug) => !speciesDescriptors[slug]);

if (missingDescriptors.length > 0) {
    throw new Error(`Missing descriptors for ${missingDescriptors.length} species: ${missingDescriptors.join(", ")}`);
}

const values = slugs.map((slug) => {
    const descriptor = speciesDescriptors[slug];
    const story = speciesSubtitleStories[slug];

    return `    ('en', '${escapeSql(slug)}', '${escapeSql(descriptor)}', '${escapeSql(story)}')`;
});

const sql = `insert into public.species_subtitles (locale, slug, descriptor, subtitle_story)
values
${values.join(",\n")}
on conflict (locale, slug) do update
set descriptor = excluded.descriptor,
    subtitle_story = excluded.subtitle_story,
    updated_at = timezone('utc', now());
`;

mkdirSync(path.dirname(targetPath), {recursive: true});
writeFileSync(targetPath, sql, "utf8");

console.log(`Generated ${targetPath} with ${slugs.length} species subtitle rows.`);
