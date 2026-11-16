/** p3 (solid): `lib/ark-collide/solid-audit.ts` from the command line: `--before`, `--hours=24`, `--step=20`. Prints JSON. */
import {townSolidAudit} from "@/lib/ark-collide/solid-audit";

const arg = (name: string, fallback: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
console.log(JSON.stringify(townSolidAudit({before: process.argv.includes("--before"), hours: arg("hours", 24), step: arg("step", 20)}), null, 1));
