const BADGE =
  '<img src="https://img.shields.io/badge/{{ CONCLUSION }}-{{ BADGE_COLOR }}?style=for-the-badge&label={{ BADGE_LABEL }}" alt="Badge" />';
const BROWSERS = ['chrome', 'firefox', 'opera', 'edge'];
const COLORS = {
  green: '3fb950',
  red: 'd73a49',
};
const TEMPLATE_VARS = {
  tableBody: '{{ TABLE_BODY }}',
  sha: '{{ SHA }}',
  conslusion: '{{ CONCLUSION }}',
  badgeColor: '{{ BADGE_COLOR }}',
  badgeLabel: '{{ BADGE_LABEL }}',
  jobLogs: '{{ JOB_LOGS }}',
};

module.exports = {
  BADGE,
  BROWSERS,
  COLORS,
  TEMPLATE_VARS,
};
