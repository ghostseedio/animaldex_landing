import {redirect} from "next/navigation";

export default function LegacyJournalRedirect({params}: {params: {locale: string}}) {
    redirect(`/${params.locale}/app/train/daily-companion`);
}
