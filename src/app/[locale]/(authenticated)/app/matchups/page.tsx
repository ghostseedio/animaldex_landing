import {redirect} from "next/navigation";
import {getLocalePath} from "@/lib/site";

/** Old "Compare" links (a card, a shared target) land on Debates (3.2): no new battle can start. */
export default function MatchupsPage({params}: {params: {locale: string}}) {
    redirect(getLocalePath(params.locale, "/app/debates"));
}
