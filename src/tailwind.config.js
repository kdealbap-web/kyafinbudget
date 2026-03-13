/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{html,ts}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#1E40AF',
                    light: '#3B82F6',
                    soft: '#EFF6FF',
                },
                success: '#059669',
                danger: '#DC2626',
                warning: '#D97706',
                info: '#0891B2',
                bg: {
                    DEFAULT: '#F8FAFC',
                    dark: '#0F172A',
                },
                surface: {
                    DEFAULT: '#FFFFFF',
                    dark: '#1E293B',
                },
                border: {
                    DEFAULT: '#E2E8F0',
                    dark: '#334155',
                },
                text: {
                    DEFAULT: '#0F172A',
                    muted: '#64748B',
                    light: '#94A3B8',
                    dark: '#F1F5F9',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                sm: '0 1px 3px rgba(0,0,0,0.08)',
                md: '0 4px 12px rgba(0,0,0,0.10)',
                lg: '0 8px 24px rgba(0,0,0,0.12)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                'slide-down': 'slideDown 0.3s ease-out',
                'pulse-soft': 'pulseSoft 2s infinite',
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
                }
            }
        },
    },
    plugins: [],
}
