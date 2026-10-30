import {redirect} from "next/navigation";
import {getLocalePath} from "@/lib/site";

/**
 * "Talk to several animals" is gone in 3.2 (docs/debates/SPEC.md): the group
 * conversation is only for a debate, started from an animal's own chat. An
 * old link lands on Companions.
 */
export default function AnimalGroupChatPage({params}: {params: {locale: string}}) {
    redirect(getLocalePath(params.locale, "/app/companions"));
}
