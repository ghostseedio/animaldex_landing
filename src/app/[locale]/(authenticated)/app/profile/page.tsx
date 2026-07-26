import {redirect} from "next/navigation";
import PublicProfilePage from "@/app/[locale]/(composited)/u/[handle]/page";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getLocalePath} from "@/lib/site";

export default async function ProfilePage({params}: {params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    const username = context?.profile.username?.trim();
    if (!username) redirect(getLocalePath(params.locale, "/account"));
    return PublicProfilePage({params: {locale: params.locale, handle: username}});
}
