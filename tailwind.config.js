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
        },
        extend: {
            colors: {
                canvas: {
                    950: "#040705",
                    900: "#0a0f0c",
                    850: "#101612",
                },
                surface: {
                    900: "#111714",
                    800: "#151d19",
                    700: "#1b241f",
                },
                ink: {
                    100: "#f4fff5",
                    200: "#d1ddd3",
                    300: "#9fb0a2",
                    400: "#748376",
                },
                line: {
                    300: "#314036",
                    400: "#243028",
                },
                primary: {
                    50: "#effff2",
                    100: "#cffff0",
                    200: "#83ffae",
                    400: "#32db65",
                    500: "#1bc451",
                    600: "#13953e",
                }
            },
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
