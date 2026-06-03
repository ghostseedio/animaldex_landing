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

function table(headers, rows) {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.join(" | ")} |`)
    ].join("\n");
}

function toSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function main() {
    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));
    const {getBehavioralPrincipleProfile, getBehavioralPrinciplesIndex} = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));
    const speciesBySlug = new Map(speciesEntries.map((entry) => [entry.slug, entry]));

    const profiles = speciesEntries.map((entry) => ({
        entry,
        profile: getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence)
    }));

    const hubIndex = getBehavioralPrinciplesIndex(speciesSystemsIntelligence).map((hub) => ({
        ...hub,
        species: hub.speciesSlugs
            .map((slug) => profiles.find((item) => item.entry.slug === slug))
            .filter((item) => Boolean(item))
    }));

    const inboundBySlug = new Map();
    for (const item of profiles) {
        for (const relatedSlug of item.profile.relatedSpeciesSlugs) {
            inboundBySlug.set(relatedSlug, (inboundBySlug.get(relatedSlug) ?? 0) + 1);
        }
    }

    const hubOverview = [
        "# Principle Hub Overview",
        "",
        `_Generated: ${new Date().toISOString()}_`,
        "",
        table(
            ["Principle Hub", "Slug", "Species Count", "Top Linked Animals"],
            hubIndex.map((hub) => {
                const topLinkedAnimals = [...hub.species]
                    .map((item) => ({
                        name: item.entry.name,
                        slug: item.entry.slug,
                        inbound: inboundBySlug.get(item.entry.slug) ?? 0
                    }))
                    .sort((a, b) => b.inbound - a.inbound)
                    .slice(0, 5)
                    .map((item) => `${item.name} (${item.inbound})`)
                    .join(", ");
                return [hub.principle, `\`${hub.principleSlug}\``, String(hub.speciesCount), topLinkedAnimals || "No inbound links yet"];
            })
        )
    ].join("\n");

    const hubStrength = hubIndex.map((hub) => {
        const internalLinkCount = hub.species.reduce((sum, item) => sum + ((inboundBySlug.get(item.entry.slug) ?? 0)), 0);
        const estimatedAuthority = Number(((hub.speciesCount * 0.6) + (internalLinkCount * 0.25) + Math.min(10, hub.speciesCount / 10) * 0.15).toFixed(2));
        return {
            ...hub,
            internalLinkCount,
            estimatedAuthority
        };
    });

    const weakestFive = [...hubStrength]
        .sort((a, b) => {
            if (a.speciesCount !== b.speciesCount) return a.speciesCount - b.speciesCount;
            if (a.internalLinkCount !== b.internalLinkCount) return a.internalLinkCount - b.internalLinkCount;
            return a.estimatedAuthority - b.estimatedAuthority;
        })
        .slice(0, 5);

    const recommendedAnimalsByHub = {
        communication: ["Orca", "African Grey Parrot", "Humpback Whale", "Bonobo", "Meerkat"],
        resilience: ["Tardigrade", "Camel", "Arctic Fox", "Emperor Penguin", "Sahara Silver Ant"],
        endurance: ["Pronghorn", "Albatross", "Arctic Tern", "Salmon", "Wildebeest"],
        teamwork: ["Ant", "Termite", "Dhole", "Killer Whale", "African Buffalo"],
        adaptability: ["Raccoon", "Coyote", "Octopus", "House Sparrow", "Feral Pig"]
    };

    const weakHubPlan = [
        "# Weak Principle Hubs Strengthening Plan",
        "",
        `_Generated: ${new Date().toISOString()}_`,
        "",
        "## 5 Weakest Hubs",
        "",
        table(
            ["Hub", "Species Count", "Internal Link Count", "Estimated Authority"],
            weakestFive.map((hub) => [hub.principle, String(hub.speciesCount), String(hub.internalLinkCount), String(hub.estimatedAuthority)])
        ),
        "",
        "## Execution Focus (Animal Additions, not generic pages)",
        "",
        ...weakestFive.map((hub) => {
            const slug = toSlug(hub.principle);
            const recommendations = recommendedAnimalsByHub[slug] ?? ["Add 3-5 flagship species strongly representing this principle"];
            const seoValue = hub.speciesCount < 10 ? "High (cluster under-covered)" : "Medium";
            const linkValue = hub.internalLinkCount < 20 ? "High (needs graph reinforcement)" : "Medium";
            return [
                `### ${hub.principle}`,
                `- Recommended animals to add: ${recommendations.join(", ")}`,
                `- Expected SEO value: ${seoValue}`,
                `- Expected internal-link value: ${linkValue}`,
                `- Why: ${hub.principle} currently has ${hub.speciesCount} species and ${hub.internalLinkCount} inbound links.`
            ].join("\n");
        })
    ].join("\n\n");

    function scoreSearchDemand(entry) {
        const base = Math.min(10, 4 + Math.round(entry.searchIntents.length / 2));
        const bonus = /(eagle|owl|shark|tiger|lion|bear|dolphin|elephant|gorilla|octopus|rhino|cheetah)/i.test(entry.name) ? 2 : 0;
        return Math.min(10, base + bonus);
    }

    function scoreSymbolismIntent(entry, profile) {
        const keywordBonus = entry.searchIntents.some((i) => /(meaning|symbolism|spiritual|lesson)/i.test(i)) ? 2 : 0;
        const principleBonus = ["Memory", "Observation", "Adaptability", "Teamwork", "Communication", "Resilience"].includes(profile.principle) ? 2 : 1;
        return Math.min(10, 5 + keywordBonus + principleBonus);
    }

    function scoreEducationalIntent(entry) {
        const richness = entry.analysis.identification.length + entry.premiumDetails.behaviorTraits.length;
        const categoryBonus = /(Bird|Mammal|Primate|Reptile|Fish)/.test(entry.analysis.category) ? 2 : 1;
        return Math.min(10, 4 + Math.min(4, Math.floor(richness / 3)) + categoryBonus);
    }

    function scoreBrandFit(entry) {
        const charisma = /(eagle|owl|shark|dolphin|tiger|lion|bear|gorilla|elephant|octopus|rhino|cheetah|wolf)/i.test(entry.name) ? 2 : 0;
        const flagship = /(komodo|orangutan|polar|rhinoceros|axolotl|barn owl|bald eagle|snowy owl)/i.test(entry.name) ? 2 : 0;
        return Math.min(10, 5 + charisma + flagship);
    }

    const ranked = profiles
        .map(({entry, profile}) => {
            const searchDemand = scoreSearchDemand(entry);
            const symbolismIntent = scoreSymbolismIntent(entry, profile);
            const educationalIntent = scoreEducationalIntent(entry);
            const brandFit = scoreBrandFit(entry);
            const score = Number(((searchDemand * 0.35) + (symbolismIntent * 0.25) + (educationalIntent * 0.2) + (brandFit * 0.2)).toFixed(2));
            return {entry, profile, score, searchDemand, symbolismIntent, educationalIntent, brandFit};
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

    const queue = [
        "# Top 20 Implementation Queue",
        "",
        `_Generated: ${new Date().toISOString()}_`,
        "",
        ...ranked.map((item, index) => {
            const symbolismOp = `${item.entry.name} can target: "what does ${item.entry.name.toLowerCase()} symbolize", "${item.entry.name.toLowerCase()} meaning", "${item.entry.name.toLowerCase()} lesson".`;
            const principleOp = `Strengthen ${item.profile.principle} cluster with cross-links from /principles/${item.profile.principleSlug} and same-principle animals.`;
            const improvements = [
                "Tighten hero summary for direct-answer snippets",
                "Expand biological-basis paragraph with clearer field-observable behavior",
                "Add 2-3 FAQ items targeting high-intent phrasing",
                "Improve 'More animals with this principle' links to high-authority peers"
            ].join("; ");
            const why = `High combined score across demand (${item.searchDemand}), symbolism intent (${item.symbolismIntent}), educational intent (${item.educationalIntent}), and brand fit (${item.brandFit}).`;
            return [
                `## ${index + 1}. ${item.entry.name} (\`${item.entry.slug}\`)`,
                `- Current score: **${item.score}**`,
                `- Why it ranks highly: ${why}`,
                `- Suggested page improvements: ${improvements}.`,
                `- Symbolism/meaning opportunities: ${symbolismOp}`,
                `- Principle opportunities: ${principleOp}`
            ].join("\n");
        })
    ].join("\n\n");

    const outDir = path.resolve(process.cwd(), "docs/seo");
    mkdirSync(outDir, {recursive: true});
    writeFileSync(path.join(outDir, "principle-hub-overview.md"), hubOverview, "utf8");
    writeFileSync(path.join(outDir, "weak-principle-hubs-plan.md"), weakHubPlan, "utf8");
    writeFileSync(path.join(outDir, "top-20-implementation-queue.md"), queue, "utf8");
    console.log("Generated execution queue reports.");
}

main();
