import {redirect} from "next/navigation";
import {getLocalePath} from "@/lib/site";

/**
 * Explore's Battles is Debates in 3.2 (docs/debates/SPEC.md): an old link to
 * the battle hub, a segment or a target lands on My debates.
 */
export default function ArenaPage({params}: {params: {locale: string}}) {
    redirect(getLocalePath(params.locale, "/app/debates"));
}
