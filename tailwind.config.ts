import { Config } from 'tailwindcss'

module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}', './src/components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      width: {
        popup: 'var(--popup-width)',
      },
      height: {
        popup: 'var(--popup-height)',
      },
      textColor: {
        primary: 'rgb(var(--text-primary) / <alpha-value>)',
        weak: 'rgb(var(--text-weak) / <alpha-value>)',
        medium: 'rgb(var(--text-medium) / <alpha-value>)',
        strong: 'rgb(var(--text-strong) / <alpha-value>)',
        error: 'rgb(var(--text-error) / <alpha-value>)',
        disabled: 'rgb(var(--text-disabled) / <alpha-value>)',
      },
      backgroundColor: {
        primary: 'rgb(var(--bg-primary) / <alpha-value>)',
        error: 'rgb(var(--bg-error) / <alpha-value>)',
        'error-hover': 'rgb(var(--bg-error-hover) / <alpha-value>)',
        'button-base': 'rgb(var(--bg-button-base) / <alpha-value>)',
        'button-base-hover': 'rgb(var(--bg-button-base-hover) / <alpha-value>)',
        'switch-base': 'rgb(var(--bg-switch-base) / <alpha-value>)',
        'disabled-base': 'rgb(var(--bg-disabled-base) / <alpha-value>)',
        'disabled-base-hover': 'rgb(var(--bg-disabled-base-hover) / <alpha-value>)',
      },
      borderColor: {
        base: 'rgb(var(--border-base) / <alpha-value>)',
        popup: 'rgb(var(--border-popup) / <alpha-value>)',
        focus: 'rgb(var(--border-focus) / <alpha-value>)',
      },
    },
  },
  plugins: [],
} satisfies Config
