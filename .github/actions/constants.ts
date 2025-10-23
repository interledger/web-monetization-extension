const BROWSERS = ['chrome', 'firefox', 'safari'] as const;
export type Browser = typeof BROWSERS[number];
const COLORS = {
  green: '3fb950',
  red: 'd73a49',
} as const;
const TEMPLATE_VARS = {
  tableBody: '{{ TABLE_BODY }}',
  sha: '{{ SHA }}',
  conclusion: '{{ CONCLUSION }}',
  jobLogs: '{{ JOB_LOGS }}',
} as const;

export { BROWSERS, COLORS, TEMPLATE_VARS };