// @ts-check

/**
 * @typedef {'chrome' | 'firefox'} Browser
 */

/** @type {Browser[]} */
const BROWSERS = ['chrome', 'firefox'];
const COLORS = {
  green: '3fb950',
  red: 'd73a49',
};
const TEMPLATE_VARS = {
  tableBody: '{{ TABLE_BODY }}',
  sha: '{{ SHA }}',
  conclusion: '{{ CONCLUSION }}',
  jobLogs: '{{ JOB_LOGS }}',
};

module.exports = {
  BROWSERS,
  COLORS,
  TEMPLATE_VARS,
};
