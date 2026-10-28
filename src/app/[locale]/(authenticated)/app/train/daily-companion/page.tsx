import {redirect} from "next/navigation";

// The Daily Companion is gone (docs/companion-loop/SPEC.md, phase 4); old links land on Companions.
export default function LegacyDailyCompanionRedirect({params}: {params: {locale: string}}) {
    redirect(`/${params.locale}/app`);
}
