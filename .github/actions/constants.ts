export const BROWSERS = ['chrome', 'firefox', 'safari'] as const;
export type Browser = (typeof BROWSERS)[number];
export const COLORS = {
  green: '3fb950',
  red: 'd73a49',
} as const;
export const TEMPLATE_VARS = {
  tableBody: '{{ TABLE_BODY }}',
  sha: '{{ SHA }}',
  conclusion: '{{ CONCLUSION }}',
  jobLogs: '{{ JOB_LOGS }}',
} as const;
