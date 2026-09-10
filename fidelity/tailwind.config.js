/* -------------------------------------------------------------------------- */
/*  IMPORT                                                                    */
/* -------------------------------------------------------------------------- */
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import colors from 'tailwindcss/colors.js';
import plugin from 'tailwindcss/plugin';
/** Converte un colore HEX in spazio-separato RGB: es. "#ff00aa" → "255 0 170" */
const toRGB = (value) => {
    // Handle hex colors
    if (value.startsWith('#')) {
        const hex = value.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `${r} ${g} ${b}`;
    }

    // Handle rgb/rgba colors
    if (value.startsWith('rgb')) {
        const matches = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (matches) {
            return `${matches[1]} ${matches[2]} ${matches[3]}`;
        }
    }

    return null;
};

/* -------------------------------------------------------------------------- */
/*  CONFIG                                                                    */
/* -------------------------------------------------------------------------- */
export default /** @type {import('tailwindcss').Config} */({
    content: [
        './index.html',
        './src/**/*.{ts,tsx}',
        '!./src/**/node_modules/**/*',
    ],
    darkMode: 'class',

    /* ------------------------------  THEME  --------------------------------- */
    theme: {
        container: { screens: { '2xl': '1320px' } },

        extend: {
            /* ---------- ANIMAZIONI & KEYFRAMES ---------- */
            keyframes: {
                shimmer: {
                    '0%': { backgroundPosition: '-1000px 0' },
                    '100%': { backgroundPosition: '1000px 0' }
                },

                dialogOpen: {
                    '0%': { opacity: '0', transform: 'rotateX(-10deg) translateY(-20px)' },
                    '100%': { opacity: '1', transform: 'rotateX(0) translateY(0)' }
                },

                fadeInRight: {
                    '0%': { opacity: '0', transform: 'translateX(-10px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' }
                },

                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },

                gradientBg: {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' }
                },
            },

            animation: {
                shimmer: 'shimmer 2s infinite linear',
                shimmer_slow: 'shimmer 10s infinite linear',
                'dialog-open': 'dialogOpen 0.4s ease-out forwards',
                'fade-in-right': 'fadeInRight 0.3s ease-out forwards',
                'fade-in-up': 'fadeInUp 0.3s ease-out forwards',
                'gradient-bg': 'gradientBg 3s ease infinite',
                'enter-fast': 'fadeInUp 0.2s ease-out forwards',
                'enter-base': 'fadeInUp 0.3s ease-out forwards',
                'enter-dialog': 'dialogOpen 0.4s ease-out forwards',
            },

            /* -------------------  BREAKPOINTS  ------------------- */
            screens: {
                '3xl': '1600px',
                xs: '320px',
            },

            /* -----------------------  COLORI  -------------------- */
            colors: {
                'sb-track': '#ffffff',
                'sb-thumb': "#626b96",
                theme: {
                    1: "rgb(var(--color-theme-1) / <alpha-value>)",
                    2: "rgb(var(--color-theme-2) / <alpha-value>)",
                },
                primary: "rgb(var(--color-primary) / <alpha-value>)",
                secondary: "rgb(var(--color-secondary) / <alpha-value>)",
                success: "rgb(var(--color-success) / <alpha-value>)",
                info: "rgb(var(--color-info) / <alpha-value>)",
                warning: "rgb(var(--color-warning) / <alpha-value>)",
                pending: "rgb(var(--color-pending) / <alpha-value>)",
                danger: "rgb(var(--color-danger) / <alpha-value>)",
                light: "rgb(var(--color-light) / <alpha-value>)",
                dark: "rgb(var(--color-dark) / <alpha-value>)",
                darkmode: {
                    50: "rgb(var(--color-darkmode-50) / <alpha-value>)",
                    100: "rgb(var(--color-darkmode-100) / <alpha-value>)",
                    200: "rgb(var(--color-darkmode-200) / <alpha-value>)",
                    300: "rgb(var(--color-darkmode-300) / <alpha-value>)",
                    400: "rgb(var(--color-darkmode-400) / <alpha-value>)",
                    500: "rgb(var(--color-darkmode-500) / <alpha-value>)",
                    600: "rgb(var(--color-darkmode-600) / <alpha-value>)",
                    700: "rgb(var(--color-darkmode-700) / <alpha-value>)",
                    800: "rgb(var(--color-darkmode-800) / <alpha-value>)",
                    900: "rgb(var(--color-darkmode-900) / <alpha-value>)",
                },
            },

            /* -----------------------  FONT  ---------------------- */
            fontFamily: {
                'urbanist': ['Urbanist', 'system-ui', '-apple-system', 'sans-serif'],
                'space-grotesk': ['Space Grotesk', 'sans-serif'],
                'dm-sans': ['DM Sans', 'sans-serif'],
                'poppins': ['Poppins', 'sans-serif'],
                'allura': ['Allura', 'cursive'],
            },
            fontWeight: {
                urbanist: '600', // Urbanist leggermente più grosso
            },

            /* ---------------  BACKGROUND-IMAGES  ----------------- */
            backgroundImage: {
                "texture-black":
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2346.899' height='1200.894' viewBox='0 0 2346.899 1200.894'%3E%3Cg id='Group_369' data-name='Group 369' transform='translate(-33.74 508.575)'%3E%3Cg id='Group_366' data-name='Group 366' transform='translate(33.74 -458.541)'%3E%3Crect id='Rectangle_492' data-name='Rectangle 492' width='745.289' height='650.113' transform='matrix(0.978, 0.208, -0.208, 0.978, 296.729, 261.648)' fill='rgba(30,41,59,0.01)'/%3E%3Crect id='Rectangle_491' data-name='Rectangle 491' width='1335.276' height='650.113' transform='translate(0 543.106) rotate(-24)' fill='rgba(30,41,59,0.01)'/%3E%3C/g%3E%3Cg id='Group_367' data-name='Group 367' transform='translate(1647.456 1026.688) rotate(-128)'%3E%3Crect id='Rectangle_492-2' data-name='Rectangle 492' width='745.289' height='650.113' transform='matrix(0.978, 0.208, -0.208, 0.978, 296.729, 261.648)' fill='rgba(30,41,59,0.01)'/%3E%3Crect id='Rectangle_491-2' data-name='Rectangle 491' width='1335.276' height='650.113' transform='translate(0 543.106) rotate(-24)' fill='rgba(30,41,59,0.01)'/%3E%3C/g%3E%3Cg id='Group_368' data-name='Group 368' transform='matrix(-0.656, -0.755, 0.755, -0.656, 1017.824, 1042.94)'%3E%3Crect id='Rectangle_492-3' data-name='Rectangle 492' width='745.289' height='650.113' transform='matrix(0.978, 0.208, -0.208, 0.978, 296.729, 261.648)' fill='rgba(30,41,59,0.01)'/%3E%3Crect id='Rectangle_491-3' data-name='Rectangle 491' width='1335.276' height='650.113' transform='translate(0 543.106) rotate(-24)' fill='rgba(30,41,59,0.01)'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A\")",
                "texture-white":
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2346.899' height='1200.894' viewBox='0 0 2346.899 1200.894'%3E%3Cg id='Group_369' data-name='Group 369' transform='translate(-33.74 508.575)'%3E%3Cg id='Group_366' data-name='Group 366' transform='translate(33.74 -458.541)'%3E%3Crect id='Rectangle_492' data-name='Rectangle 492' width='745.289' height='650.113' transform='translate(296.729 261.648) rotate(12.007)' fill='rgba(255,255,255,0.014)'/%3E%3Crect id='Rectangle_491' data-name='Rectangle 491' width='1335.276' height='650.113' transform='translate(0 543.106) rotate(-24)' fill='rgba(255,255,255,0.014)'/%3E%3C/g%3E%3Cg id='Group_367' data-name='Group 367' transform='translate(1647.456 1026.688) rotate(-128)'%3E%3Crect id='Rectangle_492-2' data-name='Rectangle 492' width='745.289' height='650.113' transform='translate(296.729 261.648) rotate(12.007)' fill='rgba(255,255,255,0.014)'/%3E%3Crect id='Rectangle_491-2' data-name='Rectangle 491' width='1335.276' height='650.113' transform='translate(0 543.106) rotate(-24)' fill='rgba(255,255,255,0.014)'/%3E%3C/g%3E%3Cg id='Group_368' data-name='Group 368' transform='matrix(-0.656, -0.755, 0.755, -0.656, 1017.824, 1042.94)'%3E%3Crect id='Rectangle_492-3' data-name='Rectangle 492' width='745.289' height='650.113' transform='translate(296.729 261.648) rotate(12.007)' fill='rgba(255,255,255,0.014)'/%3E%3Crect id='Rectangle_491-3' data-name='Rectangle 491' width='1335.276' height='650.113' transform='translate(0 543.106) rotate(-24)' fill='rgba(255,255,255,0.014)'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A\")",
                "chevron-white":
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ffffff95' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                "chevron-black":
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2300000095' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
            },
            fontSize: {
                xxs: '0.625rem', // 10px
            },

            /* -------------------  CONTAINER  --------------------- */
            container: { center: true },
        },
    },

    /* --------------------  PLUGINS  -------------------------- */
    plugins: [
        forms,
        typography,
        plugin(function ({ addBase, matchUtilities, addUtilities }) {
            addBase({
                // ... il tuo codice esistente ...

                // Migliora focus states
                '*:focus-visible': {
                    outline: '2px solid rgb(var(--color-primary) / 0.5)',
                    outlineOffset: '2px',
                    borderRadius: '4px',
                },
            }),
                addBase({
                    // Default colors
                    ":root": {
                        "--color-theme-1": toRGB("#03045e"),
                        "--color-theme-2": toRGB("#0c4a6e"),
                        "--color-primary": toRGB("#03045e"),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                    },
                    // Default dark-mode colors
                    ".dark": {
                        "--color-primary": toRGB(colors.blue["700"]),
                        "--color-darkmode-50": "87 103 132",
                        "--color-darkmode-100": "74 90 121",
                        "--color-darkmode-200": "65 81 114",
                        "--color-darkmode-300": "53 69 103",
                        "--color-darkmode-400": "48 61 93",
                        "--color-darkmode-500": "41 53 82",
                        "--color-darkmode-600": "40 51 78",
                        "--color-darkmode-700": "35 45 69",
                        "--color-darkmode-800": "27 37 59",
                        "--color-darkmode-900": "15 23 42",
                    },
                    // Theme 1 colors
                    ".theme-1": {
                        "--color-theme-1": toRGB(colors.violet["900"]),
                        "--color-theme-2": toRGB(colors.rose["800"]),
                        "--color-primary": toRGB(colors.violet["900"]),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 2 colors
                    ".theme-2": {
                        "--color-theme-1": toRGB(colors.purple["900"]),
                        "--color-theme-2": toRGB(colors.cyan["700"]),
                        "--color-primary": toRGB(colors.purple["900"]),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 3 colors
                    ".theme-3": {
                        "--color-theme-1": toRGB(colors.cyan["700"]),
                        "--color-theme-2": toRGB(colors.violet["800"]),
                        "--color-primary": toRGB(colors.cyan["700"]),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 4 colors
                    ".theme-4": {
                        "--color-theme-1": toRGB(colors.sky["700"]),
                        "--color-theme-2": toRGB(colors.rose["800"]),
                        "--color-primary": toRGB(colors.sky["700"]),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 5 colors
                    ".theme-5": {
                        "--color-theme-1": toRGB(colors.sky["800"]),
                        "--color-theme-2": toRGB(colors.emerald["800"]),
                        "--color-primary": toRGB(colors.sky["800"]),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 6 colors
                    ".theme-6": {
                        "--color-theme-1": toRGB("#247ba0"),
                        "--color-theme-2": toRGB("#0a2463"),
                        "--color-primary": toRGB("#247ba0"),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 7 colors
                    ".theme-7": {
                        "--color-theme-1": toRGB(colors.lime["950"]),
                        "--color-theme-2": toRGB(colors.teal["900"]),
                        "--color-primary": toRGB(colors.lime["950"]),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 8 colors
                    ".theme-8": {
                        "--color-theme-1": toRGB("#357266"),
                        "--color-theme-2": toRGB("#0E3B43"),
                        "--color-primary": toRGB("#357266"),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 9 colors
                    ".theme-9": {
                        "--color-theme-1": toRGB("#6C6C60"),
                        "--color-theme-2": toRGB("#4D4D42"),
                        "--color-primary": toRGB("#6C6C60"),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 10 colors
                    ".theme-10": {
                        "--color-theme-1": toRGB(colors.indigo["800"]),
                        "--color-theme-2": toRGB(colors.blue["900"]),
                        "--color-primary": toRGB(colors.indigo["800"]),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 11 colors
                    ".theme-11": {
                        "--color-theme-1": toRGB("#2f3e46"),
                        "--color-theme-2": toRGB("#52796f"),
                        "--color-primary": toRGB("#2f3e46"),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 12 colors
                    ".theme-12": {
                        "--color-theme-1": toRGB("#5e503f"),
                        "--color-theme-2": toRGB("#22333b"),
                        "--color-primary": toRGB("#5e503f"),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 13 colors
                    ".theme-13": {
                        "--color-theme-1": toRGB("#5e548e"),
                        "--color-theme-2": toRGB("#231942"),
                        "--color-primary": toRGB("#5e548e"),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 14 colors
                    ".theme-14": {
                        "--color-theme-1": toRGB("#02292f"),
                        "--color-theme-2": toRGB("#767522"),
                        "--color-primary": toRGB("#02292f"),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 15 colors
                    ".theme-15": {
                        "--color-theme-1": toRGB("#4c956c"),
                        "--color-theme-2": toRGB("#006466"),
                        "--color-primary": toRGB("#4c956c"),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 16 colors
                    ".theme-16": {
                        "--color-theme-1": toRGB(colors.sky["900"]),
                        "--color-theme-2": toRGB(colors.blue["950"]),
                        "--color-primary": toRGB(colors.sky["900"]),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                    // Theme 17 colors
                    ".theme-17": {
                        "--color-theme-1": toRGB(colors.slate["900"]),
                        "--color-theme-2": toRGB(colors.slate["800"]),
                        "--color-primary": toRGB(colors.slate["900"]),
                        "--color-secondary": toRGB(colors.slate["200"]),
                        "--color-success": toRGB(colors.teal["600"]),
                        "--color-info": toRGB(colors.cyan["600"]),
                        "--color-warning": toRGB(colors.yellow["600"]),
                        "--color-pending": toRGB(colors.orange["700"]),
                        "--color-danger": toRGB(colors.red["700"]),
                        "--color-light": toRGB(colors.slate["100"]),
                        "--color-dark": toRGB(colors.slate["800"]),
                        "&.dark": {
                            "--color-primary": toRGB(colors.sky["800"]),
                        },
                    },
                });

            addUtilities({
                // Scrollbar base
                ".scrollbar": {
                    overflowY: 'auto',
                    scrollBehavior: 'smooth',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--color-secondary) transparent',
                },
                '.scrollbar::-webkit-scrollbar': {
                    width: '6px',
                    height: '6px',
                },

                // Track (background)
                '.scrollbar::-webkit-scrollbar-track': {
                    background: 'transparent',
                },

                // Thumb (sliding part)
                '.scrollbar::-webkit-scrollbar-thumb': {
                    backgroundColor: 'var(--secondary-color)',
                    borderRadius: '3px',
                },

                // Nasconde i bottoni standard
                '.scrollbar::-webkit-scrollbar-button': {
                    display: 'none',
                },

                // Corner where vertical and horizontal scrollbars meet
                '.scrollbar::-webkit-scrollbar-corner': {
                    background: 'transparent',
                }
            });

        }),
    ],
});
