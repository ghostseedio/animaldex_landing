import {redirect} from "next/navigation";
import {getLocalePath} from "@/lib/site";

/** Endorsements live at the foot of Gifts now (iOS `GiftsSentView`). */
export default function EndorsementsPage({params}: {params: {locale: string}}) {
    redirect(getLocalePath(params.locale, "/app/settings/gifts"));
}
