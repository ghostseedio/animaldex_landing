export type ContentImage = {
    src: string;
    alt: string;
    width: number;
    height: number;
    caption?: string;
};

export type ContentImageBlock = {
    type: "image";
    image: ContentImage;
};

export type ContentGalleryBlock = {
    type: "gallery";
    title?: string;
    images: ContentImage[];
};

export type ContentVideoBlock = {
    type: "video";
    title?: string;
    embedUrl: string;
    watchUrl: string;
    caption?: string;
};

export type BlogMediaBlock = ContentImageBlock | ContentGalleryBlock | ContentVideoBlock;

export type SystemsIntelligenceEntry = {
    roleTitle: string;
    specializedHardware: string;
    systemsScript: string;
    strategicInsight: string;
};

export type CanonicalContentMetadata = {
    title: string;
    description: string;
    publishedAt: string;
    updatedAt?: string;
    featuredImage: ContentImage;
};
