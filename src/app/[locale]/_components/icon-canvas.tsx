"use client";

import { useCallback, useEffect, useRef } from "react";

export type PathData = {
    _name: string;
    d: string;
    fillRule?: CanvasFillRule;
};

export type IconVelocity = {
    y: number;
    rotation: number;
    scale: number;
};

export type XFunction = (y: number) => number;

export type Icon = {
    pos: {
        x: number;
        y: number;
    };
    xFunction: XFunction;
    velocity: IconVelocity;
    opacity: number;
    scale: number;
    rotation: number;
    path?: PathData;
    imageSrc?: string;
};

export type IconVelocityProp = { [k in keyof IconVelocity]?: IconVelocity[k] };

export type IconCanvasProps = {
    probability: number;
    paths: PathData[];
    imageSources?: string[];
    minVelocity?: IconVelocityProp;
    maxVelocity?: IconVelocityProp;
    minScale?: number;
    maxScale?: number;
    minOpacity?: number;
    maxOpacity?: number;
    color?: string;
    height?: number;
    minIcons?: number;
};

export default function IconCanvas({
    probability,
    paths,
    imageSources = [],
    minVelocity: {
        y: minYVelocity = -0.1,
        rotation: minRotationVelocity = -0.015625,
        scale: minScaleVelocity = -0.015625,
    } = {},
    maxVelocity: {
        y: maxYVelocity = -0.025,
        rotation: maxRotationVelocity = 0.015625,
        scale: maxScaleVelocity = 0.015625,
    } = {},
    minScale = 1.3,
    maxScale = 1.9,
    minOpacity = 80,
    maxOpacity = 150,
    color = "#1BC451",
    height,
    minIcons = 32,
}: IconCanvasProps) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const currentFrame = useRef<number>(0);
    const lastFrameTime = useRef<DOMHighResTimeStamp>(0);
    const icons = useRef<Icon[]>([]);
    const loadedImages = useRef<Map<string, HTMLImageElement>>(new Map());
    const silhouetteCache = useRef<Map<string, HTMLCanvasElement>>(new Map());
    const useImages = imageSources.length > 0;

    const createSilhouette = useCallback((image: HTMLImageElement, cacheKey: string) => {
        const cached = silhouetteCache.current.get(cacheKey);
        if (cached) return cached;

        const size = 96;
        const offscreen = document.createElement("canvas");
        offscreen.width = size;
        offscreen.height = size;

        const offscreenCtx = offscreen.getContext("2d");
        if (!offscreenCtx) return null;

        offscreenCtx.clearRect(0, 0, size, size);

        /*
         * Step 1: draw the transparent PNG/WebP normally.
         * This creates the animal alpha mask.
         */
        offscreenCtx.drawImage(image, 0, 0, size, size);

        /*
         * Step 2: replace all visible pixels with one flat colour.
         * This is the actual silhouette effect.
         */
        offscreenCtx.globalCompositeOperation = "source-in";
        offscreenCtx.fillStyle = color;
        offscreenCtx.fillRect(0, 0, size, size);

        offscreenCtx.globalCompositeOperation = "source-over";

        silhouetteCache.current.set(cacheKey, offscreen);
        return offscreen;
    }, [color]);

    const animate = useCallback(
        (time: DOMHighResTimeStamp) => {
            const c = canvas.current;
            const ctx = c?.getContext("2d");

            if (!ctx || !c) return;

            if (lastFrameTime.current) {
                const delta = time - lastFrameTime.current;

                ctx.clearRect(0, 0, c.width, c.height);

                const lacksIcons = icons.current.length < minIcons;

                if (Math.random() > 1 - probability || lacksIcons) {
                    const scale = Math.random() * (maxScale - minScale) + minScale;
                    const t = Math.random();
                    const n = t > 0.3 && t < 0.5 ? 0.3 : t < 0.7 && t > 0.5 ? 0.7 : t;
                    const x = n * c.width;

                    const fun = (y: number) =>
                        (x * c.width +
                            3 *
                                (x > c.width / 2 ? 1 : -1) *
                                Math.sqrt(y * (2 * x + c.width) ** 2)) /
                        c.width;

                    const imageSrc = useImages
                        ? imageSources[Math.floor(Math.random() * imageSources.length)]
                        : undefined;

                    icons.current.push({
                        pos: {
                            x,
                            y: lacksIcons ? Math.random() * c.height : c.height + scale * 24,
                        },
                        velocity: {
                            y: Math.random() * (maxYVelocity - minYVelocity) + minYVelocity,
                            rotation:
                                Math.random() * (maxRotationVelocity - minRotationVelocity) +
                                minRotationVelocity,
                            scale:
                                Math.random() * (maxScaleVelocity - minScaleVelocity) +
                                minScaleVelocity,
                        },
                        xFunction: fun,
                        opacity: Math.random() * (maxOpacity - minOpacity) + minOpacity,
                        scale,
                        rotation: Math.random() * 360,
                        path: !imageSrc ? paths[Math.floor(Math.random() * paths.length)] : undefined,
                        imageSrc,
                    });
                }

                const deletionQueue: number[] = [];

                icons.current.forEach((icon, i) => {
                    icon.pos.y += icon.velocity.y * delta;
                    icon.pos.x = icon.xFunction(c.height - icon.pos.y);
                    icon.rotation += icon.velocity.rotation * delta;
                    icon.scale += icon.velocity.scale * delta;
                    icon.scale = Math.min(maxScale, Math.max(icon.scale, minScale));

                    if (icon.pos.y < -icon.scale * 24) {
                        deletionQueue.push(i);
                        return;
                    }

                    if (Number.isNaN(icon.pos.x)) return;

                    ctx.save();

                    ctx.translate(icon.pos.x, icon.pos.y);
                    ctx.scale(icon.scale, icon.scale);
                    ctx.rotate((icon.rotation * Math.PI) / 180);

                    const alpha = Math.round(icon.opacity);
                    let opacity = alpha.toString(16);
                    if (opacity.length < 2) opacity = "0" + opacity;

                    if (icon.imageSrc) {
                        const image = loadedImages.current.get(icon.imageSrc);

                        if (!image || !image.complete || image.naturalWidth === 0) {
                            ctx.restore();
                            return;
                        }

                        const silhouette = createSilhouette(image, icon.imageSrc);
                        if (!silhouette) {
                            ctx.restore();
                            return;
                        }

                        const size = 54;
                        const visibleAlpha = Math.min(0.48, Math.max(0.22, alpha / 255));

                        /*
                         * Draw the cached single-colour silhouette.
                         * No filters. No original image colours.
                         * No square background.
                         */
                        ctx.globalAlpha = visibleAlpha;
                        ctx.drawImage(silhouette, -size / 2, -size / 2, size, size);
                        ctx.globalAlpha = 1;
                    } else if (icon.path) {
                        ctx.beginPath();
                        ctx.fillStyle = color + opacity;

                        const path = new Path2D(icon.path.d);
                        ctx.fill(path, icon.path.fillRule);
                    }

                    ctx.restore();
                });

                deletionQueue.forEach((i) => icons.current.splice(i, 1));
            }

            lastFrameTime.current = time;
            currentFrame.current = requestAnimationFrame(animate);
        },
        [
            color,
            createSilhouette,
            imageSources,
            maxOpacity,
            maxRotationVelocity,
            maxScale,
            maxScaleVelocity,
            maxYVelocity,
            minIcons,
            minOpacity,
            minRotationVelocity,
            minScale,
            minScaleVelocity,
            minYVelocity,
            paths,
            probability,
            useImages,
        ]
    );

    const resize = useCallback(() => {
        if (!canvas.current) return;

        canvas.current.width = window.document.body.clientWidth;
        canvas.current.height = height || window.visualViewport?.height || 1080;
    }, [height]);

    useEffect(() => {
        resize();
        window.addEventListener("resize", resize);

        currentFrame.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(currentFrame.current);
            window.removeEventListener("resize", resize);
        };
    }, [animate, resize]);

    useEffect(() => {
        if (!useImages) {
            loadedImages.current.clear();
            silhouetteCache.current.clear();
            return;
        }

        const nextImages = new Map<string, HTMLImageElement>();

        imageSources.forEach((src) => {
            const image = new window.Image();
            image.decoding = "async";

            /*
             * Same-origin images are safest for canvas.
             * Remote images may work visually but can fail if CORS is strict.
             */
            if (src.startsWith("/") || src.includes(window.location.host)) {
                image.crossOrigin = "anonymous";
            }

            image.onload = () => {
                silhouetteCache.current.delete(src);
            };

            image.src = src;
            nextImages.set(src, image);
        });

        loadedImages.current = nextImages;
        silhouetteCache.current.clear();
    }, [imageSources, useImages]);

    return (
        <canvas
            ref={canvas}
            className="absolute pointer-events-none top-0 left-0 -z-10 max-w-full"
        />
    );
}