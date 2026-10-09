const {fontFamily} = require('tailwindcss/defaultTheme')
const plugin = require('tailwindcss/plugin')

const defaultColors = require('tailwindcss/colors')

const isSolid = (opacityValue) => opacityValue === undefined || opacityValue.startsWith("var(")
const withAlpha = (channels, opacityValue) => opacityValue === undefined
    ? `rgb(${channels})`
    : `rgb(${channels} / ${opacityValue})`
const token = (name) => ({opacityValue}) => withAlpha(`var(--c-${name})`, opacityValue)
const tokenScale = (name, shades) => Object.fromEntries(shades.map((shade) => [shade, token(`${name}-${shade}`)]))
const fixedScale = (channelsByShade) => Object.fromEntries(
    Object.entries(channelsByShade).map(([shade, channels]) => [shade, ({opacityValue}) => withAlpha(channels, opacityValue)])
)

const hexToChannels = (hex) => {
    const value = hex.replace("#", "")
    return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)).join(" ")
}

// Tailwind's own hues (text-emerald-300, text-amber-200 ...) were picked for a dark
// page and wash out on a light one. Each light shade reads through a variable that
// only the light theme defines (see the plugin below), falling back to the original.
const MIRRORED_HUES = ["red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"]
const LIGHT_TEXT_SHADE = {50: 800, 100: 800, 200: 800, 300: 700, 400: 700, 500: 700}
const paletteTextMirrors = () => Object.fromEntries(MIRRORED_HUES.map((hue) => [hue, Object.fromEntries(
    Object.entries(LIGHT_TEXT_SHADE).map(([shade]) => [
        shade,
        ({opacityValue}) => withAlpha(`var(--tx-${hue}-${shade}, ${hexToChannels(defaultColors[hue][shade])})`, opacityValue)
    ])
)]))

const generateColorMap = (colors, callback, prefix = '') => {
    return Object.keys(colors).reduce((acc, color) => {
        const fullColor = (prefix ? prefix + '-' : '') + color

        if (typeof colors[color] === 'string' || typeof colors[color] === 'function') {
            const value = typeof colors[color] === 'function' ? colors[color]({}) : colors[color]
            return {
                ...acc,
                ...callback(fullColor, value)
            }
        }

        return {
            ...acc,
            ...generateColorMap(colors[color], callback, fullColor)
        }
    }, {})
}

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        fontFamily: {
            sans: ["var(--font-sans)", ...fontFamily.sans],
            display: ["var(--font-display)", ...fontFamily.sans],
            // Declaring fontFamily at the theme root replaces the defaults, which dropped
            // font-mono even though the codebase uses it.
            mono: [...fontFamily.mono],
        },
        extend: {
            // Tailwind only emits a utility when the exact token exists. Shades and opacity
            // steps used in the codebase but missing here compiled to nothing, so the
            // elements using them rendered unstyled. Each value below fills such a gap.
            // Brand colours resolve through CSS variables so one attribute on <html>
            // (data-theme) re-skins the whole site. The values for each theme live
            // in globals.css. See `themed` for why text gets its own mapping.
            colors: {
                canvas: tokenScale("canvas", [950, 900, 850]),
                surface: tokenScale("surface", [950, 900, 800, 700]),
                ink: tokenScale("ink", [100, 200, 300, 400, 500, 600]),
                line: tokenScale("line", [100, 200, 300, 400]),
                primary: tokenScale("primary", [50, 100, 200, 300, 400, 500, 600, 900, 950]),
                // White is the dark design's "ink at an opacity" (text-white/70,
                // bg-white/5, border-white/10), so it flips with the theme. A solid
                // bg-white is a literal white surface and is handled in backgroundColor.
                white: token("white"),
            },
            backgroundColor: {
                white: ({opacityValue}) => isSolid(opacityValue) ? "#FFFFFF" : withAlpha("var(--c-white)", opacityValue),
            },
            // Text sits on a different background from the fill of the same name, so
            // it needs its own light-theme values: lime text darkens to a legible
            // green, and canvas/surface/primary-900+ text (only ever used on lime or
            // white fills) stays dark in both themes.
            textColor: {
                canvas: fixedScale({950: "7 16 11", 900: "10 22 16", 850: "13 42 22"}),
                surface: fixedScale({950: "7 16 11", 900: "13 42 22", 800: "18 53 28", 700: "22 68 34"}),
                primary: {
                    ...tokenScale("primary-text", [50, 100, 200, 300, 400, 500, 600]),
                    ...fixedScale({900: "13 42 22", 950: "7 16 11"}),
                },
                ...paletteTextMirrors(),
            },
            // Opacity modifiers outside the default scale (e.g. bg-white/15) emit no CSS.
            opacity: {
                4: "0.04",
                8: "0.08",
                12: "0.12",
                14: "0.14",
                15: "0.15",
                16: "0.16",
                18: "0.18",
                35: "0.35",
                45: "0.45",
                55: "0.55",
                58: "0.58",
                65: "0.65",
                78: "0.78",
                85: "0.85",
                92: "0.92",
            },
            // Numeric min-w/min-h/max-w utilities only gained a spacing scale in Tailwind 3.4.
            minWidth: ({theme}) => ({...theme("spacing")}),
            minHeight: ({theme}) => ({...theme("spacing")}),
            maxWidth: ({theme}) => ({...theme("spacing")}),
            borderRadius: {
                '4xl': '2rem',
                '5xl': '2.5rem',
                '6xl': '3rem',
            },
            margin: {
                'offset': 'var(--tw-offset)',
            },
            width: {
                'full-no-offset': 'calc(100% - var(--tw-offset) * 2)',
            }
        }
    },
    plugins: [
        // `light:` styles an element only in the light theme; dark is the default
        // the rest of the class list was written for. It skips anything inside a
        // .theme-dark subtree, so a shared component can carry light: overrides and
        // still render dark where a page pins it (the /app shell).
        plugin(function({ addVariant, addBase }) {
            addVariant('light', ':root[data-theme="light"] &:not(.theme-dark *)')
            addBase({
                ':root[data-theme="light"]': Object.fromEntries(MIRRORED_HUES.flatMap((hue) =>
                    Object.entries(LIGHT_TEXT_SHADE).map(([shade, lightShade]) => [
                        `--tx-${hue}-${shade}`, hexToChannels(defaultColors[hue][lightShade])
                    ])
                )),
                // A pinned-dark subtree goes back to the original hues.
                '.theme-dark': Object.fromEntries(MIRRORED_HUES.flatMap((hue) =>
                    Object.keys(LIGHT_TEXT_SHADE).map((shade) => [`--tx-${hue}-${shade}`, 'initial'])
                ))
            })
        }),
        require('@tailwindcss/typography'),
        // line-clamp only ships with Tailwind from 3.3; this project is on 3.2.
        plugin(function({ addUtilities }) {
            const clamp = {};
            for (const lines of [1, 2, 3, 4, 5, 6]) {
                clamp[`.line-clamp-${lines}`] = {
                    overflow: 'hidden',
                    display: '-webkit-box',
                    '-webkit-box-orient': 'vertical',
                    '-webkit-line-clamp': `${lines}`,
                };
            }
            clamp['.line-clamp-none'] = { '-webkit-line-clamp': 'unset' };
            addUtilities(clamp);
        }),
        require('tailwindcss-interaction-media'),
        plugin(function({ matchUtilities, theme }) {
            matchUtilities(
                {
                    'o': (value) => ({
                        '--tw-offset': value
                    }),
                },
                { values: theme('margin') }
            )
        }),
        plugin(function({ matchUtilities, theme }) {
            matchUtilities(
                {
                    'word-spacing': (value) => ({
                        wordSpacing: value
                    }),
                },
                { values: theme('wordSpacing') }
            )
        }, {
            theme: {
                wordSpacing: {
                    'normal': 'normal',
                    1: '0.5rem',
                    2: '1rem',
                    4: '2rem',
                    6: '3rem',
                    8: '4rem',
                }
            }
        }),
        plugin(function({ addUtilities, theme }) {
            const colorMap = generateColorMap(theme('colors'), (color, value) => ({
                [`.text-outline-${color}`]: {
                    textShadow: `-2px -2px 0 ${value}, 2px -2px 0 ${value}, -2px 2px 0 ${value}, 2px 2px 0 ${value}`
                }
            }))
            addUtilities(colorMap)
        }),
    ],
}
