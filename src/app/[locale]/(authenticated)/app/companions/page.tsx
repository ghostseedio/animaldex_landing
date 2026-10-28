import {redirect} from "next/navigation";
import {getLocalePath} from "@/lib/site";

/** Companions is the app's first tab, at /app. */
export default function CompanionsRoute({params}: {params: {locale: string}}) {
    redirect(getLocalePath(params.locale, "/app"));
}
