module.exports = {
  singleQuote: true,
  trailingComma: 'all',
  jsxSingleQuote: false,
  semi: false,
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindFunctions: [
    'classnames',
    'clsx',
    'ctl',
    'cva',
    'tw',
    'twStyle',
    'twMerge',
    'twJoin',
    'cn',
  ],
}
