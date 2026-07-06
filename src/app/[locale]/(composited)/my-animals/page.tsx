import {redirect} from "next/navigation";

export default function LegacyMyAnimalsPage({params}: {params: {locale: string}}) {
    redirect(`/${params.locale}/app/collection`);
}
