const {existsSync, readdirSync, readFileSync} = require("node:fs");
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

function countImages(slug) {
    const dir = path.join(process.cwd(), "public/images/blog", `${slug}-symbolism`);
    if (!existsSync(dir)) return 0;
    return readdirSync(dir).filter((f) => f.endsWith(".webp")).length;
}

function main() {
    const blog = loadTsModule(path.join(process.cwd(), "src/data/blog.ts"));
    const speciesMod = loadTsModule(path.join(process.cwd(), "src/data/species.ts"));
    const speciesSlugs = new Set(speciesMod.speciesEntries.map((e) => e.slug));

    const symbolismPosts = blog.blogPosts.filter((p) => p.slug.endsWith("-symbolism"));
    const errors = [];

    for (const post of symbolismPosts) {
        const label = post.slug;

        if ((post.sources?.length ?? 0) < 3) {
            errors.push(`${label}: sources.length ${post.sources?.length ?? 0} < 3`);
        }
        if ((post.faq?.length ?? 0) < 4) {
            errors.push(`${label}: faq.length ${post.faq?.length ?? 0} < 4`);
        }

        const speciesSlug = post.speciesSlugs[0];
        if (!speciesSlug) {
            errors.push(`${label}: missing speciesSlugs[0]`);
        } else if (speciesSlugs.size > 0 && !speciesSlugs.has(speciesSlug)) {
            errors.push(`${label}: speciesSlugs[0] "${speciesSlug}" not in species index`);
        }

        const imageCount = countImages(speciesSlug || post.slug.replace(/-symbolism$/, ""));
        if (imageCount < 8) {
            errors.push(`${label}: image count ${imageCount} < 8`);
        }

        const summarySection = post.sections.find((s) => s.title.includes("Quick Summary"));
        if (summarySection && !summarySection.table) {
            errors.push(`${label}: summary section uses cards instead of table`);
        }

        for (const section of post.sections) {
            for (const paragraph of section.paragraphs) {
                if (/for seo/i.test(paragraph)) {
                    errors.push(`${label}: SEO meta leak in section "${section.title}"`);
                }
            }
        }

        const hasExplore = post.sections.some((s) => s.title === "Explore on AnimalDex");
        if (!hasExplore) {
            errors.push(`${label}: missing "Explore on AnimalDex" section`);
        }
    }

    if (errors.length) {
        console.error("Symbolism post validation failed:\n");
        for (const err of errors) {
            console.error(`  - ${err}`);
        }
        process.exit(1);
    }

    console.log(`All ${symbolismPosts.length} symbolism posts passed validation.`);
}

main();
