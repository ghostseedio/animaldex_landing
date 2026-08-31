const {fontFamily} = require('tailwindcss/defaultTheme')
const plugin = require('tailwindcss/plugin')

const generateColorMap = (colors, callback, prefix = '') => {
    return Object.keys(colors).reduce((acc, color) => {
        const fullColor = (prefix ? prefix + '-' : '') + color

        if (typeof colors[color] === 'string') {
            return {
                ...acc,
                ...callback(fullColor, colors[color])
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
            colors: {
                canvas: {
                    950: "#07100B",
                    900: "#0A1610",
                    850: "#0D2A16",
                },
                surface: {
                    950: "#07100B",
                    900: "#0D2A16",
                    800: "#12351C",
                    700: "#164422",
                },
                ink: {
                    100: "#FFFFFF",
                    200: "#A8B0AA",
                    300: "#A8B0AA",
                    400: "#7E8781",
                    500: "#5C6660",
                    600: "#3F4842",
                },
                line: {
                    100: "#3D5C46",
                    200: "#2A4434",
                    300: "#1C3324",
                    400: "#0D2A16",
                },
                primary: {
                    50: "#F3FFD0",
                    100: "#D4FB7A",
                    200: "#A7F432",
                    300: "#C8FA63",
                    400: "#A7F432",
                    500: "#21C05E",
                    600: "#1A9A4B",
                    900: "#0D2A16",
                    950: "#07100B",
                }
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
