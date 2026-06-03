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

function clamp(min, max, value) {
    return Math.max(min, Math.min(max, value));
}

function getFamilyCluster(entry) {
    const slug = entry.slug;
    const name = entry.name.toLowerCase();
    const clusterTokens = [
        "rhinoceros",
        "owl",
        "eagle",
        "tiger",
        "bear",
        "shark",
        "dolphin",
        "octopus",
        "gorilla",
        "orangutan",
        "elephant",
        "wolf",
        "fox",
        "penguin",
        "whale",
        "albatross",
        "pigeon",
        "goose",
        "vulture",
        "crocodile",
        "alligator",
        "snake",
        "frog",
        "cat",
        "dog",
        "ant",
        "beetle",
        "monkey"
    ];

    for (const token of clusterTokens) {
        if (slug.includes(token) || name.includes(token)) {
            return token;
        }
    }

    return entry.analysis.category.toLowerCase();
}

function scoreSymbolismIntent(entry, profile) {
    const intentSignals = entry.searchIntents.filter((value) => /(meaning|symbolism|spiritual|lesson|archetype)/i.test(value)).length;
    const base = 5 + Math.min(3, intentSignals);
    const principleBoost = ["Memory", "Observation", "Adaptability", "Communication", "Resilience", "Teamwork"].includes(profile.principle) ? 2 : 1;
    return clamp(1, 10, base + principleBoost);
}

function scoreEducationalIntent(entry) {
    const detailDensity = entry.analysis.identification.length + entry.premiumDetails.behaviorTraits.length + entry.premiumDetails.whyInteresting.length;
    const detailScore = Math.min(4, Math.floor(detailDensity / 3));
    const categoryScore = /(mammal|bird|primate|reptile|fish|amphibian)/i.test(entry.analysis.category) ? 2 : 1;
    const habitatScore = entry.analysis.habitat.split(",").length >= 3 ? 1 : 0;
    return clamp(1, 10, 3 + detailScore + categoryScore + habitatScore);
}

function scoreGlobalPopularity(entry) {
    const megaFaunaBoost = /(lion|tiger|bear|wolf|eagle|owl|shark|dolphin|elephant|gorilla|orangutan|rhino|cheetah|fox|penguin|whale|octopus|crocodile|alligator|komodo)/i.test(entry.name) ? 3 : 0;
    const searchBreadth = Math.min(4, Math.floor(entry.searchIntents.length / 2));
    const rarityPenalty = entry.analysis.rarityScore > 90 ? -1 : 0;
    return clamp(1, 10, 4 + searchBreadth + megaFaunaBoost + rarityPenalty);
}

function scoreBacklinkPotential(entry, profile) {
    const authorityAnimalBoost = /(elephant|dolphin|gorilla|wolf|lion|tiger|shark|owl|eagle|rhino|octopus|whale)/i.test(entry.name) ? 3 : 0;
    const principleBoost = ["Communication", "Resilience", "Memory", "Observation", "Teamwork"].includes(profile.principle) ? 2 : 1;
    const educationalAssetBoost = entry.analysis.identification.length >= 4 ? 1 : 0;
    return clamp(1, 10, 3 + authorityAnimalBoost + principleBoost + educationalAssetBoost);
}

function scoreBrandFit(entry, profile) {
    const appFit = /(animal|wildlife|field|spot|track|identify)/i.test(entry.analysis.summary) ? 2 : 1;
    const flagshipBoost = /(komodo|orangutan|polar bear|barn owl|bald eagle|snowy owl|cheetah|white rhinoceros|black rhinoceros|octopus|wandering albatross|dolphin|gorilla|elephant|axolotl)/i.test(entry.name) ? 3 : 1;
    const principleBoost = ["Communication", "Resilience", "Memory", "Observation", "Adaptability"].includes(profile.principle) ? 2 : 1;
    return clamp(1, 10, 2 + appFit + flagshipBoost + principleBoost);
}

function weightedScore(parts, weights) {
    return Number((
        parts.symbolismIntent * weights.symbolismIntent
        + parts.educationalIntent * weights.educationalIntent
        + parts.globalPopularity * weights.globalPopularity
        + parts.backlinkPotential * weights.backlinkPotential
        + parts.brandFit * weights.brandFit
    ).toFixed(2));
}

function buildRationale(entry, profile, parts) {
    return `Strong ${profile.principle.toLowerCase()} angle; symbolism intent ${parts.symbolismIntent}/10, educational depth ${parts.educationalIntent}/10, popularity ${parts.globalPopularity}/10, backlink potential ${parts.backlinkPotential}/10, brand fit ${parts.brandFit}/10.`;
}

function rerankWithDiversity(items, targetCount, penalty = 0.75) {
    const selected = [];
    const clusterCounts = new Map();
    const candidates = [...items];

    while (selected.length < targetCount && candidates.length > 0) {
        let bestIndex = 0;
        let bestAdjusted = -Infinity;

        for (let i = 0; i < candidates.length; i += 1) {
            const item = candidates[i];
            const clusterCount = clusterCounts.get(item.familyCluster) ?? 0;
            const adjustedScore = Number((item.baseScore - (clusterCount * penalty)).toFixed(2));
            if (adjustedScore > bestAdjusted) {
                bestAdjusted = adjustedScore;
                bestIndex = i;
            }
        }

        const [winner] = candidates.splice(bestIndex, 1);
        winner.adjustedScore = bestAdjusted;
        selected.push(winner);
        clusterCounts.set(winner.familyCluster, (clusterCounts.get(winner.familyCluster) ?? 0) + 1);
    }

    return selected;
}

function selectWithHardFamilyCap(items, targetCount, maxPerFamily = 2) {
    const selected = [];
    const deferred = [];
    const familyCounts = new Map();

    for (const item of items) {
        if (selected.length >= targetCount) {
            break;
        }
        const current = familyCounts.get(item.familyCluster) ?? 0;
        if (current >= maxPerFamily) {
            deferred.push({
                ...item,
                deferReason: `Cluster cap reached for "${item.familyCluster}"`
            });
            continue;
        }
        selected.push(item);
        familyCounts.set(item.familyCluster, current + 1);
    }

    return {selected, deferred, familyCounts};
}

function keywordsForAnimal(entry) {
    const base = entry.name.toLowerCase();
    return {
        target: `${base} meaning`,
        supporting: [
            `${base} symbolism`,
            `what does ${base} symbolize`,
            `${base} spiritual meaning`,
            `${base} lesson`
        ]
    };
}

function main() {
    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));
    const {getBehavioralPrincipleProfile} = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));

    const profiles = speciesEntries.map((entry) => {
        const profile = getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence);
        const parts = {
            symbolismIntent: scoreSymbolismIntent(entry, profile),
            educationalIntent: scoreEducationalIntent(entry),
            globalPopularity: scoreGlobalPopularity(entry),
            backlinkPotential: scoreBacklinkPotential(entry, profile),
            brandFit: scoreBrandFit(entry, profile)
        };
        return {
            entry,
            profile,
            familyCluster: getFamilyCluster(entry),
            parts
        };
    });

    const symbolismCandidates = profiles.map((item) => ({
        ...item,
        baseScore: weightedScore(item.parts, {
            symbolismIntent: 0.35,
            educationalIntent: 0.2,
            globalPopularity: 0.2,
            backlinkPotential: 0.15,
            brandFit: 0.1
        }),
        rationale: buildRationale(item.entry, item.profile, item.parts)
    })).sort((a, b) => b.baseScore - a.baseScore);

    const educationalCandidates = profiles.map((item) => ({
        ...item,
        baseScore: weightedScore(item.parts, {
            symbolismIntent: 0.15,
            educationalIntent: 0.4,
            globalPopularity: 0.15,
            backlinkPotential: 0.15,
            brandFit: 0.15
        }),
        rationale: buildRationale(item.entry, item.profile, item.parts)
    })).sort((a, b) => b.baseScore - a.baseScore);

    const brandCandidates = profiles.map((item) => ({
        ...item,
        baseScore: weightedScore(item.parts, {
            symbolismIntent: 0.2,
            educationalIntent: 0.2,
            globalPopularity: 0.2,
            backlinkPotential: 0.15,
            brandFit: 0.25
        }),
        rationale: buildRationale(item.entry, item.profile, item.parts)
    })).sort((a, b) => b.baseScore - a.baseScore);

    const top50Symbolism = rerankWithDiversity(symbolismCandidates, 50, 0.75);
    const top50Educational = rerankWithDiversity(educationalCandidates, 50, 0.75);
    const top50Brand = rerankWithDiversity(brandCandidates, 50, 0.75);

    const combinedMap = new Map();
    for (const list of [top50Symbolism, top50Educational, top50Brand]) {
        list.forEach((item, index) => {
            const key = item.entry.slug;
            const existing = combinedMap.get(key) ?? {
                item,
                score: 0,
                symbolismRank: null,
                educationalRank: null,
                brandRank: null
            };
            const contribution = (51 - (index + 1));
            existing.score += contribution;
            if (list === top50Symbolism) existing.symbolismRank = index + 1;
            if (list === top50Educational) existing.educationalRank = index + 1;
            if (list === top50Brand) existing.brandRank = index + 1;
            combinedMap.set(key, existing);
        });
    }

    const combinedCandidates = Array.from(combinedMap.values())
        .map((value) => ({
            ...value,
            familyCluster: value.item.familyCluster,
            baseScore: value.score
        }))
        .sort((a, b) => b.baseScore - a.baseScore);

    const finalCandidatePool = rerankWithDiversity(
        combinedCandidates.map((value) => ({
            entry: value.item.entry,
            profile: value.item.profile,
            familyCluster: value.familyCluster,
            baseScore: value.baseScore,
            rationale: value.item.rationale,
            symbolismRank: value.symbolismRank,
            educationalRank: value.educationalRank,
            brandRank: value.brandRank
        })),
        200,
        1.0
    );
    const uncappedTop25 = finalCandidatePool.slice(0, 25);
    const cappedSelection = selectWithHardFamilyCap(finalCandidatePool, 25, 2);
    const finalTop25 = cappedSelection.selected;
    const selectedSlugs = new Set(finalTop25.map((item) => item.entry.slug));
    const deferredByCap = uncappedTop25
        .filter((item) => !selectedSlugs.has(item.entry.slug))
        .map((item) => ({
            ...item,
            deferReason: `Cluster cap reached for "${item.familyCluster}"`
        }))
        .sort((a, b) => b.baseScore - a.baseScore)
        .slice(0, 40);
    const firstSprint10 = finalTop25.slice(0, 10).map((item) => {
        const kws = keywordsForAnimal(item.entry);
        return {
            ...item,
            targetKeyword: kws.target,
            supportingKeywords: kws.supporting,
            sectionsToImprove: [
                "Hero summary (direct-answer snippet)",
                "What does this animal teach us",
                "Symbolism & Meaning Q/A block",
                "Biological basis paragraph",
                "FAQ schema answers",
                "More animals with this principle links"
            ]
        };
    });

    const lines = [];
    lines.push("# High Intent Symbolism Priority Report");
    lines.push("");
    lines.push(`_Generated: ${new Date().toISOString()}_`);
    lines.push("");
    lines.push("## Ranking Model");
    lines.push("");
    lines.push("- Primary dimensions: symbolism/meaning intent, educational intent, global popularity, backlink potential, AnimalDex brand fit.");
    lines.push("- Diversity control: family-cluster penalty applied during selection to avoid taxonomy domination.");
    lines.push("- Example behavior: one rhinoceros variant ranking high suppresses additional rhinoceros variants in final picks.");
    lines.push("");
    lines.push("## Top 50 Symbolism Opportunity Animals");
    lines.push("");
    lines.push(table(
        ["Rank", "Animal", "Slug", "Principle", "Base Score", "Adjusted Score", "Rationale"],
        top50Symbolism.map((item, index) => [
            String(index + 1),
            item.entry.name,
            `\`${item.entry.slug}\``,
            item.profile.principle,
            String(item.baseScore),
            String(item.adjustedScore),
            item.rationale
        ])
    ));
    lines.push("");
    lines.push("## Top 50 Educational Opportunity Animals");
    lines.push("");
    lines.push(table(
        ["Rank", "Animal", "Slug", "Principle", "Base Score", "Adjusted Score", "Rationale"],
        top50Educational.map((item, index) => [
            String(index + 1),
            item.entry.name,
            `\`${item.entry.slug}\``,
            item.profile.principle,
            String(item.baseScore),
            String(item.adjustedScore),
            item.rationale
        ])
    ));
    lines.push("");
    lines.push("## Top 50 AnimalDex Brand Opportunity Animals");
    lines.push("");
    lines.push(table(
        ["Rank", "Animal", "Slug", "Principle", "Base Score", "Adjusted Score", "Rationale"],
        top50Brand.map((item, index) => [
            String(index + 1),
            item.entry.name,
            `\`${item.entry.slug}\``,
            item.profile.principle,
            String(item.baseScore),
            String(item.adjustedScore),
            item.rationale
        ])
    ));
    lines.push("");
    lines.push("## Final Recommended Implementation Queue (25 Animals)");
    lines.push("");
    lines.push(table(
        ["Rank", "Animal", "Slug", "Family Cluster", "Principle", "Raw Score", "Adjusted Score", "Symbolism Rank", "Educational Rank", "Brand Rank", "Rationale"],
        finalTop25.map((item, index) => [
            String(index + 1),
            item.entry.name,
            `\`${item.entry.slug}\``,
            item.familyCluster,
            item.profile.principle,
            String(item.baseScore),
            String(item.adjustedScore),
            item.symbolismRank ? String(item.symbolismRank) : "-",
            item.educationalRank ? String(item.educationalRank) : "-",
            item.brandRank ? String(item.brandRank) : "-",
            item.rationale
        ])
    ));
    lines.push("");
    lines.push("## Deferred Due To Cluster Cap");
    lines.push("");
    if (deferredByCap.length === 0) {
        lines.push("- None");
    } else {
        lines.push(table(
            ["Animal", "Slug", "Family Cluster", "Raw Score", "Adjusted Score", "Reason"],
            deferredByCap.map((item) => [
                item.entry.name,
                `\`${item.entry.slug}\``,
                item.familyCluster,
                String(item.baseScore),
                String(item.adjustedScore),
                item.deferReason
            ])
        ));
    }
    lines.push("");
    lines.push("## Recommended First Sprint (10 Pages)");
    lines.push("");
    lines.push(table(
        ["Sprint Rank", "Animal", "Slug", "Target Keyword", "Supporting Keywords", "Principle Focus", "Exact Sections To Improve"],
        firstSprint10.map((item, index) => [
            String(index + 1),
            item.entry.name,
            `\`${item.entry.slug}\``,
            item.targetKeyword,
            item.supportingKeywords.join(", "),
            item.profile.principle,
            item.sectionsToImprove.join("; ")
        ])
    ));

    const outPath = path.resolve(process.cwd(), "docs/seo/high-intent-symbolism-priority-report.md");
    mkdirSync(path.dirname(outPath), {recursive: true});
    writeFileSync(outPath, lines.join("\n"), "utf8");
    console.log(`Generated ${outPath}`);
}

main();
