export type SizeScaleAnchor = {
    position: number;
    label: string;
    slug: string;
};

export const SIZE_SCALE_ANCHORS: SizeScaleAnchor[] = [
    {position: 2, label: "Butterfly", slug: "glasswing-butterfly"},
    {position: 16, label: "Cat", slug: "maine-coon-cat"},
    {position: 30, label: "Dog", slug: "samoyed"},
    {position: 52, label: "Horse", slug: "arabian-horse"},
    {position: 82, label: "Elephant", slug: "asian-elephant"},
    {position: 98, label: "Whale Shark", slug: "whale-shark"}
];
