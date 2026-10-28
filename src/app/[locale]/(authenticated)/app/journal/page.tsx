import {redirect} from "next/navigation";

// The Daily Companion journal is gone (docs/companion-loop/SPEC.md, phase 4):
// what you work on with an animal now happens with that animal, in its chat.
export default function LegacyJournalRedirect({params}: {params: {locale: string}}) {
    redirect(`/${params.locale}/app`);
}
