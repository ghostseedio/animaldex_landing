import {redirect} from "next/navigation";

type TrainPageProps = {
    params: {locale: string};
};

export default function TrainPage({params}: TrainPageProps) {
    redirect(`/${params.locale}/app/arena`);
}
