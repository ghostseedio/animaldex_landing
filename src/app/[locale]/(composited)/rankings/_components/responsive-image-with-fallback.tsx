"use client";

import Image from "next/image";
import {useState} from "react";

type ResponsiveImageWithFallbackProps = {
    src: string;
    fallbackSrc?: string;
    alt: string;
    width: number;
    height: number;
    sizes: string;
    priority?: boolean;
    className?: string;
};

const DEFAULT_FALLBACK_SRC = "/images/placeholders/species-no-image.svg";

export default function ResponsiveImageWithFallback({
    src,
    fallbackSrc = DEFAULT_FALLBACK_SRC,
    alt,
    width,
    height,
    sizes,
    priority = false,
    className = ""
}: ResponsiveImageWithFallbackProps) {
    const [imageSrc, setImageSrc] = useState(src);
    const isFallback = imageSrc === fallbackSrc;

    return (
        <Image
            src={imageSrc}
            alt={isFallback ? "" : alt}
            width={width}
            height={height}
            sizes={sizes}
            priority={priority}
            className={className}
            onError={() => setImageSrc(fallbackSrc)}
        />
    );
}
