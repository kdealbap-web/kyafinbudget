/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: ['./src/**/*.{html,ts}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'var(--color-primary)',
                    hover: 'var(--color-primary-hover)',
                    light: 'var(--color-primary-light)',
                    soft: 'var(--color-primary-soft)',
                },
                success: 'var(--color-success)',
                danger: 'var(--color-danger)',
                warning: 'var(--color-warning)',
                info: 'var(--color-info)',
                bg: {
                    DEFAULT: 'var(--color-bg)',
                    dark: 'var(--color-bg-dark)',
                },
                surface: {
                    DEFAULT: 'var(--color-surface)',
                    muted: 'var(--color-surface-muted)',
                    dark: 'var(--color-surface-dark)',
                },
                border: {
                    DEFAULT: 'var(--color-border)',
                    strong: 'var(--color-border-strong)',
                    dark: 'var(--color-border-dark)',
                },
                text: {
                    DEFAULT: 'var(--color-text)',
                    secondary: 'var(--color-text-secondary)',
                    muted: 'var(--color-text-muted)',
                    light: 'var(--color-text-light)',
                    dark: 'var(--color-text-dark)',
                },
                ring: {
                    DEFAULT: 'var(--color-ring)',
                },
                paper: 'var(--color-paper)',
                cream: 'var(--color-cream)',
                ink: {
                    900: 'var(--color-ink-900)',
                    700: 'var(--color-ink-700)',
                    500: 'var(--color-ink-500)',
                    300: 'var(--color-ink-300)',
                    100: 'var(--color-ink-100)',
                    50:  'var(--color-ink-50)',
                },
                blue: {
                    900: 'var(--color-blue-900)',
                    700: 'var(--color-blue-700)',
                    500: 'var(--color-blue-500)',
                    300: 'var(--color-blue-300)',
                    100: 'var(--color-blue-100)',
                    50:  'var(--color-blue-50)',
                },
                gold: {
                    700: 'var(--color-gold-700)',
                    600: 'var(--color-gold-600)',
                    500: 'var(--color-gold-500)',
                    400: 'var(--color-gold-400)',
                    200: 'var(--color-gold-200)',
                    100: 'var(--color-gold-100)',
                    50:  'var(--color-gold-50)',
                },
                terra: {
                    900: 'var(--color-terra-900)',
                    800: 'var(--color-terra-800)',
                    700: 'var(--color-terra-700)',
                    600: 'var(--color-terra-600)',
                    500: 'var(--color-terra-500)',
                    400: 'var(--color-terra-400)',
                    300: 'var(--color-terra-300)',
                    200: 'var(--color-terra-200)',
                    100: 'var(--color-terra-100)',
                    50:  'var(--color-terra-50)',
                },
                sand: {
                    DEFAULT: 'var(--color-sand)',
                    deep:    'var(--color-sand-deep)',
                },
                ivory: 'var(--color-ivory)',
            },
            fontFamily: {
                sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
                mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
                display: ['Fraunces', 'Cormorant Garamond', 'serif'],
                wedding: ['Cormorant Garamond', 'Fraunces', 'serif'],
            },
            boxShadow: {
                'card': 'var(--shadow-card)',
                'card-hover': 'var(--shadow-card-hover)',
                'modal': 'var(--shadow-modal)',
                'dropdown': 'var(--shadow-dropdown)',
                'focus': 'var(--shadow-focus)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out forwards',
                'slide-up': 'slideUp 0.4s ease-out forwards',
                'slide-down': 'slideDown 0.4s ease-out forwards',
                'pulse-soft': 'pulseSoft 2s infinite ease-in-out',
                'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
                shake: {
                    '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
                    '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
                    '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
                    '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
                }
            },
            borderRadius: {
                'sm': '6px',
                DEFAULT: '10px',
                'lg': '16px',
            },
            spacing: {
                '18': '72px',
                '22': '88px',
            }
        },
    },
    plugins: [],
}
