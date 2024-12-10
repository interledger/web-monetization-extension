import { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import { fontFamily } from 'tailwindcss/defaultTheme';

module.exports = {
  content: [
    './src/**/*.{html,js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        titillium: ['Titillium Web', ...fontFamily.sans],
      },
      width: {
        popup: 'var(--popup-width)',
      },
      height: {
        popup: 'var(--popup-height)',
      },
      textColor: {
        primary: 'rgb(var(--text-primary) / <alpha-value>)',
        secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        'secondary-dark': 'rgb(var(--text-secondary-dark) / <alpha-value>)',
        weak: 'rgb(var(--text-weak) / <alpha-value>)',
        medium: 'rgb(var(--text-medium) / <alpha-value>)',
        strong: 'rgb(var(--text-strong) / <alpha-value>)',
        error: 'rgb(var(--text-error) / <alpha-value>)',
        disabled: 'rgb(var(--text-disabled) / <alpha-value>)',
      },
      backgroundColor: {
        primary: 'rgb(var(--bg-primary) / <alpha-value>)',
        error: 'rgb(var(--bg-error) / <alpha-value>)',
        'nav-active': 'rgb(var(--bg-nav-active) / <alpha-value>)',
        'error-hover': 'rgb(var(--bg-error-hover) / <alpha-value>)',
        'button-base': 'rgb(var(--bg-button-base) / <alpha-value>)',
        'button-base-hover': 'rgb(var(--bg-button-base-hover) / <alpha-value>)',
        'switch-base': 'rgb(var(--bg-switch-base) / <alpha-value>)',
        disabled: 'rgb(var(--bg-disabled) / <alpha-value>)',
        'disabled-hover': 'rgb(var(--bg-disabled-base-hover) / <alpha-value>)',
        'disabled-strong': 'rgb(var(--bg-disabled-strong) / <alpha-value>)',
      },
      borderColor: {
        base: 'rgb(var(--border-base) / <alpha-value>)',
        popup: 'rgb(var(--border-popup) / <alpha-value>)',
        focus: 'rgb(var(--border-focus) / <alpha-value>)',
        error: 'rgb(var(--border-error) / <alpha-value>)',
      },
      backgroundImage: {
        'divider-gradient':
          'linear-gradient(90deg, #FF7A7F 0%, #FF7A7F 0%, #FF7A7F 14.3%, #56B7B5 14.3%, #56B7B5 28.6%, #56B7B5 28.6%, #A3BEDC 28.6%, #A3BEDC 42.9%, #A3BEDC 42.9%, #FFC8DC 42.9%, #FFC8DC 57.2%, #FFC8DC 57.2%, #FF9852 57.2%, #FF9852 71.5%, #FF9852 71.5%, #98E1D0 71.5%, #98E1D0 85.8%, #98E1D0 85.8%, #8075B3 85.8%, #8075B3 100%, #8075B3 100%)',
      },
    },
  },
  plugins: [forms],
} satisfies Config;
