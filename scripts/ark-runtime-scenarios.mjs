/**
 * What a reader feels while using the Ark (graphics and performance pass, 2026-11-14): the interaction scenarios for
 * `scripts/ark-runtime-measure.mjs --page embed|hero --scenario <name>`. The first rounds measured the opening view and
 * the untouched page; these drive the world as a reader does and say what each action cost.
 *
 *   zoom     in to an animal (the host's `ark:select`, close up) and back out, species after species on both islands,
 *            then the same animals again (first-time against second-time cost)
 *   pan      orbit the island view, zoom to mid height, pan there, cross to the town and back
 *   select   animals selected in quick succession (the card and the bars follow)
 *   hide     the app's panel covered and shown again (`ark:visible`), then the page hidden and shown: what still runs
 *            while unseen, and what the first frames back cost
 *   resize   a phone turned on its side and back; a desktop window dragged narrower and wider
 *   weather  night, rain and snow pinned in turn (the scene's `setHours` / `setEnvironment`)
 *   long     ten minutes (`--seconds`) of mixed use, with a forced collection every minute
 *
 * Every drawn frame is recorded by the driver already (interval, main-thread work, heap); this adds, per frame, what the
 * page asked of the GPU (programs compiled and linked and the time the page waited on them, texture uploads and their
 * bytes, buffer uploads, render targets made), and the marks each action leaves, so a hitch is read against its cause.
 */

/**
 * Before the page's own script: WebGL's uploads and compiles counted (prototype wrappers on the few calls that matter,
 * never the draws), the scene's handle kept (`window.__arkHandle`), timers and listeners counted.
 */
export function scenarioInit() {
    const gl = {compiles: 0, links: 0, programMs: 0, tex: 0, texMs: 0, texBytes: 0, buf: 0, bufBytes: 0, bufMs: 0, targets: 0, texturesMade: 0, texturesFreed: 0, programsFreed: 0};
    window.__arkGl = gl;
    window.__arkMarks = [];
    window.__arkBigTex = [];
    window.__arkMark = (name) => window.__arkMarks.push({t: performance.now(), name});
    const wrap = (proto, name, around) => {
        const native = proto?.[name];
        if (typeof native !== "function") return;
        proto[name] = function (...args) {
            return around(native, this, args);
        };
    };
    const timed = (key, count) => (native, self, args) => {
        const s = performance.now();
        try {
            return native.apply(self, args);
        } finally {
            gl[key] += performance.now() - s;
            if (count) gl[count]++;
        }
    };
    for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
        if (!proto) continue;
        // Programs: the compile and link are asked for here; the page waits on them in the status and reflection calls.
        wrap(proto, "compileShader", timed("programMs", "compiles"));
        wrap(proto, "linkProgram", timed("programMs", "links"));
        for (const name of ["getProgramParameter", "getShaderParameter", "getProgramInfoLog", "getShaderInfoLog", "getActiveUniform", "getActiveAttrib", "getUniformLocation", "getAttribLocation"]) wrap(proto, name, timed("programMs"));
        wrap(proto, "deleteProgram", (native, self, args) => {
            gl.programsFreed++;
            return native.apply(self, args);
        });
        // Textures: every upload, its time and (roughly) its bytes.
        const sized = (args) => {
            const last = args[args.length - 1];
            const source = last && typeof last === "object" && !ArrayBuffer.isView(last) ? last : null;
            if (source && (source.width || source.videoWidth)) return (source.width || source.videoWidth) * (source.height || source.videoHeight) * 4;
            if (ArrayBuffer.isView(last)) return last.byteLength;
            // (target, level, internalformat, width, height, …) or (target, level, x, y, width, height, …)
            const nums = args.filter((v) => typeof v === "number");
            return nums.length >= 5 ? nums[3] * nums[4] * 4 : 0;
        };
        for (const name of ["texImage2D", "texSubImage2D", "texImage3D", "texSubImage3D", "compressedTexImage2D", "compressedTexSubImage2D"]) {
            wrap(proto, name, (native, self, args) => {
                const s = performance.now();
                try {
                    return native.apply(self, args);
                } finally {
                    const bytes = sized(args) || 0;
                    gl.texMs += performance.now() - s;
                    gl.tex++;
                    gl.texBytes += bytes;
                    // A big upload (2 MB and up): when, how big, how long, and who asked (a named build reads best).
                    if (bytes >= 2 * 2 ** 20 && window.__arkBigTex.length < 400) {
                        const nums = args.filter((v) => typeof v === "number");
                        window.__arkBigTex.push({t: Math.round(performance.now()), call: name, mb: Math.round((bytes / 2 ** 20) * 10) / 10, ms: Math.round((performance.now() - s) * 10) / 10, dims: nums.slice(2, 6).join("x"), stack: String(new Error().stack ?? "").split("\n").slice(2, 12).map((line) => line.trim().replace(/^at /, "").replace(/\(?https?:\/\/[^/]+\//, "(").slice(0, 70))});
                    }
                }
            });
        }
        for (const name of ["bufferData", "bufferSubData"]) {
            wrap(proto, name, (native, self, args) => {
                const s = performance.now();
                try {
                    return native.apply(self, args);
                } finally {
                    gl.bufMs += performance.now() - s;
                    gl.buf++;
                    const data = name === "bufferData" ? args[1] : args[2];
                    gl.bufBytes += typeof data === "number" ? data : data?.byteLength ?? 0;
                }
            });
        }
        // Which programs: three names each shader in its first lines (`#define SHADER_TYPE`, `SHADER_NAME`); with the
        // defines that say which state made the variant (fog, shadows, clipping, instancing, tone mapping), and the
        // time the page then waited on that program (its status and reflection calls).
        const shaderInfo = new WeakMap();
        const programInfo = new WeakMap();
        const DEFINES = /#define (SHADER_TYPE|SHADER_NAME|USE_FOG|FOG_EXP2|USE_SHADOWMAP|USE_INSTANCING|USE_INSTANCING_COLOR|USE_BATCHING|USE_SKINNING|NUM_CLIPPING_PLANES|UNION_CLIPPING_PLANES|TONE_MAPPING|USE_ENVMAP|USE_MAP|USE_NORMALMAP|DOUBLE_SIDED|FLIP_SIDED|USE_COLOR|DEPTH_PACKING|USE_LOGDEPTHBUF|NUM_DIR_LIGHTS|NUM_POINT_LIGHTS|NUM_SPOT_LIGHTS|NUM_HEMI_LIGHTS|NUM_DIR_LIGHT_SHADOWS|ARK_[A-Z0-9_]+)\b ?([^\n]*)/g;
        wrap(proto, "shaderSource", (native, self, args) => {
            const source = String(args[1] ?? "");
            if (/gl_FragColor|pc_fragColor|out highp vec4/.test(source)) {
                const defs = {};
                let match;
                DEFINES.lastIndex = 0;
                while ((match = DEFINES.exec(source))) defs[match[1]] = match[2].trim() || "1";
                // (three inlines NUM_* as loop bounds, not defines: read them from the unrolled uniforms.)
                const count = (name) => (source.match(new RegExp(`${name}\\[ ?(\\d+) ?\\]`)) ?? [])[1];
                const dir = count("directionalLights");
                const point = count("pointLights");
                const spot = count("spotLights");
                const clip = count("clippingPlanes");
                if (dir) defs.dirLights = dir;
                if (point) defs.pointLights = point;
                if (spot) defs.spotLights = spot;
                if (clip) defs.clipPlanes = clip;
                shaderInfo.set(args[0], {type: defs.SHADER_TYPE ?? "?", name: defs.SHADER_NAME ?? "", defs, bytes: source.length});
            }
            return native.apply(self, args);
        });
        wrap(proto, "attachShader", (native, self, args) => {
            const info = shaderInfo.get(args[1]);
            if (info) programInfo.set(args[0], {...info, t: performance.now(), waitMs: 0});
            return native.apply(self, args);
        });
        window.__arkPrograms = [];
        wrap(proto, "linkProgram", (native, self, args) => {
            const info = programInfo.get(args[0]);
            if (info) {
                info.t = performance.now();
                window.__arkPrograms.push(info);
            }
            return native.apply(self, args);
        });
        for (const name of ["getProgramParameter", "getProgramInfoLog", "getActiveUniform", "getActiveAttrib", "getUniformLocation", "getAttribLocation"]) {
            wrap(proto, name, (native, self, args) => {
                const info = programInfo.get(args[0]);
                // (The parallel-compile poll, COMPLETION_STATUS_KHR 0x91B1, never waits.)
                if (!info || args[1] === 0x91b1) return native.apply(self, args);
                const s = performance.now();
                try {
                    return native.apply(self, args);
                } finally {
                    info.waitMs += performance.now() - s;
                }
            });
        }
        // Render targets made (a resize, a resolution step, a tier change).
        for (const name of ["renderbufferStorage", "renderbufferStorageMultisample", "createFramebuffer"]) {
            wrap(proto, name, (native, self, args) => {
                gl.targets++;
                return native.apply(self, args);
            });
        }
        wrap(proto, "createTexture", (native, self, args) => {
            gl.texturesMade++;
            return native.apply(self, args);
        });
        wrap(proto, "deleteTexture", (native, self, args) => {
            gl.texturesFreed++;
            return native.apply(self, args);
        });
    }
    // The scene's handle, as the page gets it (a production build exposes none).
    let ark;
    try {
        Object.defineProperty(window, "AnimalDexArk", {configurable: true, get: () => ark, set: (value) => {
            for (const name of ["mountArchipelago", "mountArk"]) {
                const mount = value?.[name];
                if (typeof mount !== "function") continue;
                value[name] = (el, options) => {
                    const withView = window.__arkOpenOn && name === "mountArchipelago" ? {...options, openOn: window.__arkOpenOn} : options;
                    const handle = mount(el, withView);
                    window.__arkHandle = handle;
                    return handle;
                };
            }
            ark = value;
        }});
    } catch {
        // Defined already (another init script): no handle here.
    }
    // Timers and listeners alive (a leak grows them).
    const live = {intervals: 0, timeouts: 0, listeners: 0, timerRuns: 0, rafCalls: 0};
    window.__arkLive = live;
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const intervals = new Set();
    const timeouts = new Set();
    window.setInterval = (handler, ms, ...rest) => {
        const id = nativeSetInterval((...args) => {
            live.timerRuns++;
            return typeof handler === "function" ? handler(...args) : undefined;
        }, ms, ...rest);
        intervals.add(id);
        live.intervals = intervals.size;
        return id;
    };
    window.clearInterval = (id) => {
        intervals.delete(id);
        live.intervals = intervals.size;
        return nativeClearInterval(id);
    };
    window.setTimeout = (handler, ms, ...rest) => {
        const id = nativeSetTimeout((...args) => {
            timeouts.delete(id);
            live.timeouts = timeouts.size;
            live.timerRuns++;
            return typeof handler === "function" ? handler(...args) : undefined;
        }, ms, ...rest);
        timeouts.add(id);
        live.timeouts = timeouts.size;
        return id;
    };
    window.clearTimeout = (id) => {
        timeouts.delete(id);
        live.timeouts = timeouts.size;
        return nativeClearTimeout(id);
    };
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    const known = new WeakMap();
    const keyOf = (type, listener, options) => `${type}:${typeof options === "boolean" ? options : Boolean(options?.capture)}`;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (listener) {
            let mine = known.get(this);
            if (!mine) known.set(this, (mine = new Map()));
            const key = keyOf(type, listener, options);
            let set = mine.get(key);
            if (!set) mine.set(key, (set = new Set()));
            if (!set.has(listener)) {
                set.add(listener);
                live.listeners++;
            }
        }
        return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
        const set = known.get(this)?.get(keyOf(type, listener, options));
        if (set?.delete(listener)) live.listeners--;
        return remove.call(this, type, listener, options);
    };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Animals to visit: one a species, spread over the wild island's zones and the town's house, farm and zoo; the same every run. */
export function pickAnimals(snapshot, count) {
    const animals = [...(snapshot?.animals ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
    const groups = new Map();
    for (const animal of animals) {
        const key = animal.island === "town" ? `town/${animal.area ?? "street"}` : `wild/${animal.zone}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(animal);
    }
    const keys = [...groups.keys()].sort();
    const seen = new Set();
    const picked = [];
    for (let round = 0; picked.length < count && round < 40; round++) {
        for (const key of keys) {
            const list = groups.get(key);
            // (Spread through each group by a fixed stride, so the choice does not lean on the first ids.)
            const animal = list[(round * 37 + 11) % list.length];
            if (!animal || seen.has(animal.model_slug)) continue;
            seen.add(animal.model_slug);
            picked.push({id: animal.id, slug: animal.model_slug, island: animal.island ?? "wild", where: key});
            if (picked.length >= count) break;
        }
    }
    return picked;
}

/**
 * The driver's tools for one run: marks, host messages, real input (the mouse on a desktop, touches on a phone, through
 * the DevTools protocol, so the page's own handlers run as for a reader).
 */
export function scenarioTools({page, frame, cdp, device, offset = {x: 0, y: 0}, log}) {
    const size = () => page.viewportSize();
    const mark = (name) => frame.evaluate((n) => window.__arkMark?.(n), name).catch(() => undefined);
    const send = (message) => frame.evaluate((m) => window.AnimalDexArkHost?.send(m), message).catch(() => undefined);
    const handle = (fn, arg) => frame.evaluate(([source, a]) => {
        const h = window.__arkHandle;
        // eslint-disable-next-line no-new-func
        return h ? new Function("h", "a", `return (${source})(h, a)`)(h, a) : null;
    }, [fn.toString(), arg]).catch((error) => {
        log?.(`handle call failed: ${String(error).slice(0, 120)}`);
        return null;
    });
    const touch = Boolean(device.hasTouch);
    const at = (fx, fy) => ({x: Math.round(offset.x + size().width * fx), y: Math.round(offset.y + (size().height - offset.y) * fy)});
    /** One finger (or the left button) from a to b over `ms`, a move every ~16 ms. */
    const drag = async (from, to, ms, {button = "left"} = {}) => {
        const a = at(from[0], from[1]);
        const b = at(to[0], to[1]);
        const steps = Math.max(Math.round(ms / 16), 2);
        if (touch) {
            await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: a.x, y: a.y, id: 1}]});
            for (let i = 1; i <= steps; i++) {
                const k = i / steps;
                await cdp.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [{x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, id: 1}]});
                await sleep(16);
            }
            await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
            return;
        }
        await page.mouse.move(a.x, a.y);
        await page.mouse.down({button});
        for (let i = 1; i <= steps; i++) {
            const k = i / steps;
            await page.mouse.move(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
            await sleep(16);
        }
        await page.mouse.up({button});
    };
    /** Two fingers: `spread` > 1 opens them (zoom in), < 1 closes; `shift` moves both (a pan). A desktop: the wheel, or the right button. */
    const pinch = async (spread, ms, shift = [0, 0]) => {
        const steps = Math.max(Math.round(ms / 16), 2);
        if (!touch) {
            if (shift[0] || shift[1]) return drag([0.5, 0.5], [0.5 + shift[0], 0.5 + shift[1]], ms, {button: "right"});
            const centre = at(0.5, 0.5);
            await page.mouse.move(centre.x, centre.y);
            const total = -Math.log(spread) * 900;
            for (let i = 0; i < steps; i++) {
                await page.mouse.wheel(0, total / steps);
                await sleep(16);
            }
            return;
        }
        const c = at(0.5, 0.5);
        const gap = Math.min(size().width, size().height) * 0.18;
        const points = (k) => {
            const g = gap * (1 + (spread - 1) * k);
            const sx = shift[0] * size().width * k;
            const sy = shift[1] * size().height * k;
            return [{x: c.x - g + sx, y: c.y + sy, id: 1}, {x: c.x + g + sx, y: c.y + sy, id: 2}];
        };
        await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: points(0)});
        for (let i = 1; i <= steps; i++) {
            await cdp.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: points(i / steps)});
            await sleep(16);
        }
        await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
    };
    const tap = async (fx, fy) => {
        const p = at(fx, fy);
        if (touch) {
            await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: p.x, y: p.y, id: 1}]});
            await sleep(40);
            await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
        } else await page.mouse.click(p.x, p.y);
    };
    return {mark, send, handle, drag, pinch, tap, sleep, touch, size};
}

/** The scenarios: each leaves marks (`name` starts a phase that lasts until the next mark). */
export const SCENARIOS = {
    async zoom(t, {animals, dwell = 6000, out = 3500, passes = 2, shot = null}) {
        for (let pass = 1; pass <= passes; pass++) {
            for (const [i, animal] of animals.entries()) {
                await t.mark(`in${pass}:${i}:${animal.slug}:${animal.island}`);
                await t.send({type: "ark:select", id: animal.id, closeUp: true});
                // (`--shots`: the picture 1.5 s in, while the flight is arriving, and at the end of the stay.)
                if (shot) {
                    await t.sleep(1500);
                    await shot(`in${pass}-${i}-${animal.slug}-arriving`);
                    await t.sleep(dwell - 1500);
                    await shot(`in${pass}-${i}-${animal.slug}`);
                } else await t.sleep(dwell);
                await t.mark(`out${pass}:${i}:${animal.slug}:${animal.island}`);
                await t.send({type: "ark:select", id: null});
                await t.send({type: "ark:reset"});
                await t.sleep(out);
                if (shot) await shot(`out${pass}-${i}`);
            }
        }
        await t.mark("end");
    },
    async pan(t, {animals}) {
        const town = animals.find((a) => a.island === "town");
        const wild = animals.find((a) => a.island !== "town");
        for (let round = 1; round <= 2; round++) {
            await t.mark(`orbit${round}`);
            for (let i = 0; i < 3; i++) {
                await t.drag([0.3, 0.5], [0.7, 0.55], 1200);
                await t.sleep(300);
                await t.drag([0.7, 0.55], [0.35, 0.45], 1200);
                await t.sleep(300);
            }
            await t.mark(`zoom-mid${round}`);
            await t.pinch(2.2, 1200);
            await t.sleep(600);
            await t.pinch(1.8, 1000);
            await t.sleep(1200);
            await t.mark(`orbit-mid${round}`);
            for (let i = 0; i < 3; i++) {
                await t.drag([0.3, 0.5], [0.7, 0.5], 1000);
                await t.sleep(250);
            }
            await t.mark(`pan-mid${round}`);
            for (let i = 0; i < 4; i++) {
                await t.pinch(1, 900, [i % 2 ? 0.25 : -0.25, 0.12]);
                await t.sleep(250);
            }
            await t.mark(`zoom-out${round}`);
            await t.pinch(0.3, 1200);
            await t.sleep(800);
            await t.send({type: "ark:reset"});
            await t.sleep(3000);
            if (town) {
                await t.mark(`cross-to-town${round}`);
                const flew = await t.handle((h) => (h.flyToIsland ? (h.flyToIsland("town"), true) : false));
                if (!flew) await t.send({type: "ark:select", id: town.id});
                await t.sleep(6000);
                await t.mark(`orbit-town${round}`);
                for (let i = 0; i < 3; i++) {
                    await t.drag([0.3, 0.5], [0.7, 0.55], 1200);
                    await t.sleep(300);
                }
                await t.mark(`zoom-town${round}`);
                await t.pinch(2.4, 1200);
                await t.sleep(500);
                for (let i = 0; i < 4; i++) {
                    await t.pinch(1, 900, [i % 2 ? 0.25 : -0.25, 0.1]);
                    await t.sleep(250);
                }
                await t.mark(`cross-to-wild${round}`);
                const back = await t.handle((h) => (h.flyToIsland ? (h.flyToIsland("wild"), true) : false));
                if (!back && wild) await t.send({type: "ark:select", id: wild.id});
                await t.sleep(6000);
                await t.send({type: "ark:select", id: null});
                await t.send({type: "ark:reset"});
                await t.sleep(3000);
            }
        }
        await t.mark("end");
    },
    async select(t, {animals, every = 700}) {
        for (let pass = 1; pass <= 2; pass++) {
            await t.mark(`quick${pass}`);
            for (const animal of animals) {
                await t.send({type: "ark:select", id: animal.id});
                await t.sleep(every);
            }
            await t.mark(`settle${pass}`);
            await t.sleep(4000);
            await t.send({type: "ark:select", id: null});
            await t.send({type: "ark:reset"});
            await t.sleep(3000);
        }
        await t.mark("end");
    },
    async hide(t, {page, frame, cdp}) {
        const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
        const state = async () => frame.evaluate(() => ({frames: window.__arkRec.n, runs: window.__arkLive.timerRuns, intervals: window.__arkLive.intervals, timeouts: window.__arkLive.timeouts, requests: performance.getEntriesByType("resource").length}));
        const out = {};
        for (const how of ["host", "document"]) {
            await t.mark(`before-${how}`);
            await t.sleep(4000);
            const a = {...(await state()), ...(await metrics())};
            await t.mark(`hidden-${how}`);
            if (how === "host") await t.send({type: "ark:visible", visible: false});
            else await frame.evaluate(() => {
                Object.defineProperty(document, "visibilityState", {configurable: true, get: () => "hidden"});
                Object.defineProperty(document, "hidden", {configurable: true, get: () => true});
                document.dispatchEvent(new Event("visibilitychange"));
            });
            // (Long enough to cross a 45 s read.)
            await t.sleep(60_000);
            const b = {...(await state()), ...(await metrics())};
            await t.mark(`shown-${how}`);
            if (how === "host") await t.send({type: "ark:visible", visible: true});
            else await frame.evaluate(() => {
                delete document.visibilityState;
                delete document.hidden;
                document.dispatchEvent(new Event("visibilitychange"));
            });
            await t.sleep(6000);
            out[how] = {hiddenSeconds: 60, rafCallbacks: b.frames - a.frames, timerRuns: b.runs - a.runs, intervalsAlive: b.intervals, timeoutsPending: b.timeouts, requests: b.requests - a.requests, scriptMs: Math.round((b.ScriptDuration - a.ScriptDuration) * 1000), taskMs: Math.round((b.TaskDuration - a.TaskDuration) * 1000)};
        }
        await t.mark("end");
        void page;
        return out;
    },
    async resize(t, {page, device}) {
        const {width, height} = device.viewport;
        for (let round = 1; round <= 3; round++) {
            if (device.isMobile) {
                await t.mark(`rotate-landscape${round}`);
                await page.setViewportSize({width: height, height: width});
                await t.sleep(3000);
                await t.mark(`rotate-portrait${round}`);
                await page.setViewportSize({width, height});
                await t.sleep(3000);
            } else {
                await t.mark(`drag-narrow${round}`);
                for (let i = 1; i <= 20; i++) {
                    await page.setViewportSize({width: Math.round(width - (width * 0.4 * i) / 20), height});
                    await t.sleep(50);
                }
                await t.sleep(2000);
                await t.mark(`drag-wide${round}`);
                for (let i = 1; i <= 20; i++) {
                    await page.setViewportSize({width: Math.round(width * 0.6 + (width * 0.4 * i) / 20), height});
                    await t.sleep(50);
                }
                await t.sleep(2000);
            }
        }
        await t.mark("end");
    },
    async weather(t, {animals}) {
        const near = animals.find((a) => a.island !== "town");
        const pins = [
            ["day-clear", {hours: 12, environment: {rain: 0, wetness: 0, snow: 0, storm: 0, cloud: 0.1}}],
            ["night", {hours: 1, environment: {rain: 0, wetness: 0, snow: 0, storm: 0, cloud: 0.1}}],
            ["rain", {hours: 12, environment: {rain: 1, wetness: 1, snow: 0, storm: 0.6, cloud: 1}}],
            ["snow", {hours: 12, environment: {rain: 0, wetness: 0, snow: 1, storm: 0, cloud: 0.8}}],
            ["night-rain", {hours: 1, environment: {rain: 1, wetness: 1, snow: 0, storm: 0.8, cloud: 1}}]
        ];
        for (const [name, pin] of pins) {
            await t.handle((h, p) => {
                h.setHours?.(p.hours);
                h.setEnvironment?.(p.environment);
            }, pin);
            await t.sleep(2500);
            await t.mark(`${name}:island`);
            await t.sleep(7000);
            if (near) {
                await t.send({type: "ark:select", id: near.id, closeUp: true});
                await t.sleep(5000);
                await t.mark(`${name}:close`);
                await t.sleep(6000);
                await t.send({type: "ark:select", id: null});
                await t.send({type: "ark:reset"});
                await t.mark(`${name}:back`);
                await t.sleep(3500);
            }
        }
        await t.handle((h) => {
            h.setHours?.(null);
            h.setEnvironment?.(null);
        });
        await t.mark("end");
    },
    async long(t, {animals, seconds, gc}) {
        const until = Date.now() + seconds * 1000;
        let i = 0;
        let minute = 0;
        const started = Date.now();
        while (Date.now() < until) {
            const animal = animals[i % animals.length];
            const kind = i % 4;
            await t.mark(`use:${Math.floor((Date.now() - started) / 60000)}`);
            if (kind === 0) {
                await t.send({type: "ark:select", id: animal.id, closeUp: true});
                await t.sleep(7000);
                await t.send({type: "ark:select", id: null});
                await t.send({type: "ark:reset"});
                await t.sleep(3000);
            } else if (kind === 1) {
                await t.drag([0.3, 0.5], [0.7, 0.55], 1200);
                await t.pinch(2, 1000);
                await t.drag([0.7, 0.5], [0.3, 0.5], 1200);
                await t.sleep(2500);
                await t.pinch(0.4, 1000);
                await t.sleep(1500);
            } else if (kind === 2) {
                await t.send({type: "ark:select", id: animal.id});
                await t.sleep(5000);
                await t.send({type: "ark:select", id: null});
                await t.sleep(1500);
            } else {
                // Left alone a while (the idle drift, the calm rate).
                await t.sleep(9000);
            }
            i++;
            if (gc && Math.floor((Date.now() - started) / 60000) > minute) {
                minute = Math.floor((Date.now() - started) / 60000);
                await gc(`minute ${minute}`);
            }
        }
        await t.mark("end");
    }
};

const quantile = (list, share) => {
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => a - b);
    return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] * 10) / 10;
};
const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Each phase's frames: `rec` is the driver's per-frame record with the GL counters' running totals (`gl`: an array per
 * counter), `marks` the phase starts. A long frame: an interval over 50 ms; a hitch: over 100 ms; a dropped run: two or
 * more intervals in a row at or over twice the phase's median.
 */
export function analysePhases(rec, marks, glKeys) {
    const phases = [];
    for (let m = 0; m + 1 <= marks.length - 1; m++) {
        const from = marks[m].t;
        const to = marks[m + 1].t;
        const idx = [];
        for (let i = 1; i < rec.n; i++) if (rec.t[i] >= from && rec.t[i] < to && rec.cpu[i] > 1) idx.push(i);
        if (idx.length < 2) {
            phases.push({name: marks[m].name, from: Math.round(from), to: Math.round(to), seconds: round1((to - from) / 1000), frames: idx.length});
            continue;
        }
        const intervals = [];
        const cpu = [];
        let alloc = 0;
        let gcDrops = 0;
        let worst = {ms: 0, at: 0, cpu: 0};
        for (let k = 1; k < idx.length; k++) {
            const a = idx[k - 1];
            const b = idx[k];
            const interval = rec.t[b] - rec.t[a];
            intervals.push(interval);
            cpu.push(rec.cpu[b]);
            if (interval > worst.ms) worst = {ms: round1(interval), at: Math.round(rec.t[b] - from), cpu: round1(rec.cpu[b])};
            const grew = rec.heap[b] - rec.heap[a];
            if (grew > 0) alloc += grew;
            else if (grew < -1024 * 1024) gcDrops++;
        }
        const median = quantile(intervals, 0.5);
        let runs = 0;
        let inRun = 0;
        let longestRun = 0;
        for (const v of intervals) {
            if (v >= median * 2 - 1) {
                inRun++;
                if (inRun === 2) runs++;
                longestRun = Math.max(longestRun, inRun);
            } else inRun = 0;
        }
        const first = idx[0];
        const last = idx[idx.length - 1];
        const gl = {};
        for (const key of glKeys) gl[key] = round1(rec.gl[key][last] - rec.gl[key][first]);
        const secs = (rec.t[last] - rec.t[first]) / 1000;
        // The longest waits of the phase. A wait is the gap before a frame, so its cause is the frame drawn before it
        // (and anything run between the two): that frame's own work and what the page asked of the GPU up to the next.
        const top = idx.slice(1).map((i, k) => ({i, before: idx[k], interval: intervals[k]})).sort((a, b) => b.interval - a.interval).slice(0, 3).filter((f) => f.interval > 50).map(({i, before, interval}) => {
            const from0 = Math.max(before - 1, 0);
            const d = (key) => rec.gl[key][i] - rec.gl[key][from0];
            return {
                at: Math.round(rec.t[before] - from),
                interval: round1(interval),
                cpu: round1(rec.cpu[before]),
                cpuNext: round1(rec.cpu[i]),
                programMs: round1(d("programMs")),
                links: d("links"),
                texMs: round1(d("texMs")),
                tex: d("tex"),
                texMB: round1(d("texBytes") / 2 ** 20),
                bufMB: round1(d("bufBytes") / 2 ** 20),
                bufMs: round1(d("bufMs"))
            };
        });
        phases.push({
            name: marks[m].name,
            from: Math.round(from),
            to: Math.round(to),
            seconds: round1((to - from) / 1000),
            frames: idx.length,
            fps: secs ? round1((idx.length - 1) / secs) : null,
            interval: {p50: median, p95: quantile(intervals, 0.95), p99: quantile(intervals, 0.99), max: round1(Math.max(...intervals))},
            long: intervals.filter((v) => v > 50).length,
            hitches: intervals.filter((v) => v > 100).length,
            worst,
            droppedRuns: runs,
            longestRun,
            cpu: {p50: quantile(cpu, 0.5), p95: quantile(cpu, 0.95), max: round1(Math.max(...cpu))},
            allocMBps: secs ? round1(alloc / 2 ** 20 / secs) : null,
            gcDrops,
            gl,
            top
        });
    }
    return phases;
}

/** Phases whose names share a prefix (`in1`, `out2`, …), summed and their medians taken: the scenario's table. */
export function groupPhases(phases, keyOf = (name) => name.split(":")[0]) {
    const groups = new Map();
    for (const phase of phases) {
        if (!phase.interval) continue;
        const key = keyOf(phase.name);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(phase);
    }
    const med = (values) => quantile(values.filter((v) => typeof v === "number"), 0.5);
    const sum = (values) => round1(values.reduce((s, v) => s + (v ?? 0), 0));
    return [...groups.entries()].map(([name, list]) => ({
        name,
        phases: list.length,
        seconds: sum(list.map((p) => p.seconds)),
        fps: med(list.map((p) => p.fps)),
        p50: med(list.map((p) => p.interval.p50)),
        p95: med(list.map((p) => p.interval.p95)),
        p99: med(list.map((p) => p.interval.p99)),
        worstMedian: med(list.map((p) => p.interval.max)),
        worst: Math.max(...list.map((p) => p.interval.max)),
        long: sum(list.map((p) => p.long)),
        hitches: sum(list.map((p) => p.hitches)),
        droppedRuns: sum(list.map((p) => p.droppedRuns)),
        cpuP50: med(list.map((p) => p.cpu.p50)),
        cpuP95: med(list.map((p) => p.cpu.p95)),
        cpuMax: Math.max(...list.map((p) => p.cpu.max)),
        allocMBps: med(list.map((p) => p.allocMBps)),
        gcDrops: sum(list.map((p) => p.gcDrops)),
        links: sum(list.map((p) => p.gl.links)),
        programMs: sum(list.map((p) => p.gl.programMs)),
        tex: sum(list.map((p) => p.gl.tex)),
        texMB: round1(sum(list.map((p) => p.gl.texBytes)) / 2 ** 20),
        texMs: sum(list.map((p) => p.gl.texMs)),
        bufMB: round1(sum(list.map((p) => p.gl.bufBytes)) / 2 ** 20),
        targets: sum(list.map((p) => p.gl.targets))
    }));
}

export const GL_KEYS = ["compiles", "links", "programMs", "tex", "texMs", "texBytes", "buf", "bufBytes", "bufMs", "targets", "texturesMade", "texturesFreed", "programsFreed"];

export function scenarioTable(groups) {
    const lines = [
        "| phase | n | s | fps | interval p50 / p95 / p99 ms | worst ms (median of phases / max) | frames > 50 ms | > 100 ms | dropped runs | frame work p50 / p95 / max ms | alloc MB/s | GC drops | programs linked | program wait ms | texture uploads (MB, ms) | buffers MB | targets made |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"
    ];
    for (const g of groups) lines.push(`| ${g.name} | ${g.phases} | ${g.seconds} | ${g.fps} | ${g.p50} / ${g.p95} / ${g.p99} | ${g.worstMedian} / ${round1(g.worst)} | ${g.long} | ${g.hitches} | ${g.droppedRuns} | ${g.cpuP50} / ${g.cpuP95} / ${round1(g.cpuMax)} | ${g.allocMBps} | ${g.gcDrops} | ${g.links} | ${g.programMs} | ${g.tex} (${g.texMB}, ${g.texMs}) | ${g.bufMB} | ${g.targets} |`);
    return lines.join("\n");
}
