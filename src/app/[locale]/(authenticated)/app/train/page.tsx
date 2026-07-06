import {AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainModuleTile from "@/app/[locale]/(authenticated)/app/train/train-module-tile";
import {getTrainPageData} from "@/data/train-modules";

type TrainPageProps = {
    params: {locale: string};
};

export default async function TrainPage({params}: TrainPageProps) {
    const {modules} = await getTrainPageData(`/${params.locale}`);

    return (
        <AppPage narrow>
            <AppPageHeader
                title="Train"
                eyebrow="Growth"
                description="Daily practice, identity, packs, missions, and set completion."
            />
            <div className="space-y-2">
                {modules.map((module) => (
                    <TrainModuleTile key={module.id} module={module} />
                ))}
            </div>
        </AppPage>
    );
}
