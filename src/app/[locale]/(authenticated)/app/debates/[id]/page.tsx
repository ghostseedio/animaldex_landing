import {notFound, redirect} from "next/navigation";
import DebateDetail from "@/app/[locale]/(authenticated)/app/debates/[id]/debate-detail";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getDebateForViewer, loadDebatesEnabled} from "@/data/debates";
import {debateUuid} from "@/lib/debates";
import {getCompanionWords} from "@/loaders/companion-words";
import {getScopedTranslator} from "@/loaders/translation";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * One debate (docs/debates/SPEC.md, sections 1.3 to 1.7), as the reader may
 * see it: its turns, its report and, in public, the vote. The result push
 * and "your animal joined" open it.
 */
export default async function DebatePage({params}: {params: {locale: string; id: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(getLocalePath(params.locale, `/account?next=${encodeURIComponent(`/app/debates/${params.id}`)}`));
    if (!(await loadDebatesEnabled())) redirect(getLocalePath(params.locale, "/app/explore"));
    const id = debateUuid(params.id);
    if (!id) notFound();
    const [debate, words, askT] = await Promise.all([
        getDebateForViewer(id),
        getCompanionWords(params.locale),
        getScopedTranslator(params.locale, "askAnimalDex")
    ]);
    if (!debate) notFound();
    return <DebateDetail debate={debate} words={words} typingLabel={askT("typing")} backLabel={askT("memoryBack")} locale={params.locale} />;
}
