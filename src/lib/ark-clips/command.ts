import type {ArkShotKind} from "@/lib/ark-clips/shots";

/** The recorder's command line (scripts/ark-clips.mts), as /admin shows it and the docs give it. */
export function arkClipCommand(options: {shot: ArkShotKind; species?: string | null; upload?: boolean; fixture?: boolean; out?: string | null}): string {
    const parts = ["npm run ark:clip --", `--shot ${options.shot}`];
    const species = options.species?.trim();
    if (species && /^[a-z0-9-]{1,120}$/i.test(species)) parts.push(`--species ${species}`);
    if (options.fixture) parts.push("--fixture");
    if (options.out) parts.push(`--out ${options.out}`);
    if (options.upload) parts.push("--upload");
    return parts.join(" ");
}
