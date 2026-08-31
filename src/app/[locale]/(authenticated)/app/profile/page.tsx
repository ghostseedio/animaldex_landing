import {redirect} from "next/navigation";
import {ProfilePageBody} from "@/app/[locale]/(composited)/u/[handle]/page";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getLocalePath} from "@/lib/site";

export default async function ProfilePage({params}: {params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    const username = context?.profile.username?.trim();
    if (!username) redirect(getLocalePath(params.locale, "/account"));
    return ProfilePageBody({locale: params.locale, handle: username, surface: "app"});
}
