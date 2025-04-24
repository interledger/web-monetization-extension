// @ts-check
const fs = require('node:fs/promises');
const { COLORS, TEMPLATE_VARS } = require('./constants.cjs');

/**
 * @typedef {import('./constants.cjs').Browser} Browser
 */

/** @type {Record<Browser, {name: string, url: string, size: string}>} */
const ARTIFACTS_DATA = {
  chrome: {
    name: 'Chrome',
    url: '',
    size: '',
  },
  firefox: {
    name: 'Firefox',
    url: '',
    size: '',
  },
};

/**
 * @param {'failure' | 'success'} conclusion
 * @param {keyof typeof COLORS} badgeColor
 * @param {string} badgeLabel
 * @returns {string} HTML for badge image
 */
function getBadge(conclusion, badgeColor, badgeLabel) {
  const url = new URL(
    `/badge/${conclusion}-${COLORS[badgeColor]}`,
    'https://img.shields.io',
  );
  url.searchParams.set('style', 'for-the-badge');
  url.searchParams.set('label', badgeLabel);
  return `<img src="${url}" alt="${badgeLabel}" />`;
}

/**
 * @param {number} bytes
 * @param {number} decimals
 */
function formatBytes(bytes, decimals = 2) {
  if (!Number(bytes)) return '0B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))}${sizes[i]}`;
}

/** @param {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments */
module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const baseUrl = context.payload.repository?.html_url;
  const suiteId = context.payload.workflow_run.check_suite_id;
  const runId = context.payload.workflow_run.id;
  const conclusion = context.payload.workflow_run.conclusion;
  const sha = context.payload.workflow_run.pull_requests[0].head.sha;
  const prNumber = context.payload.workflow_run.pull_requests[0].number;
  const jobLogsUrl = `${baseUrl}/actions/runs/${context.payload.workflow_run.id}`;
  const template = await fs.readFile(
    './.github/actions/templates/build-status.md',
    'utf8',
  );

  /** @type {string[]} */
  const tableRows = [];

  core.setOutput('conclusion', conclusion);

  if (conclusion === 'cancelled') {
    return;
  }

  const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id: runId,
  });

  for (const artifact of artifacts.data.artifacts) {
    const key = /** @type {Browser} */ (artifact.name.split('-')[1]);
    ARTIFACTS_DATA[key].url =
      `${baseUrl}/suites/${suiteId}/artifacts/${artifact.id}`;
    ARTIFACTS_DATA[key].size = formatBytes(artifact.size_in_bytes);
  }

  for (const k of Object.keys(ARTIFACTS_DATA)) {
    const { name, url, size } = ARTIFACTS_DATA[/** @type {Browser} */ (k)];
    if (!url && !size) {
      const badge = getBadge('failure', 'red', name);
      tableRows.push(
        `<tr><td align="center">${badge}</td><td align="center">N/A</td></tr>`,
      );
    } else {
      const badgeUrl = getBadge('success', 'green', `${name} (${size})`);
      tableRows.push(
        `<tr><td align="center">${badgeUrl}</td><td align="center"><a href="${url}">Download</a></td></tr>`,
      );
    }
  }

  const tableBody = tableRows.join('');
  const commentBody = template
    .replace(TEMPLATE_VARS.conclusion, conclusion)
    .replace(TEMPLATE_VARS.sha, sha)
    .replace(TEMPLATE_VARS.jobLogs, `<a href="${jobLogsUrl}">Run #${runId}</a>`)
    .replace(TEMPLATE_VARS.tableBody, tableBody);

  core.setOutput('comment_body', commentBody);
  core.setOutput('pr_number', prNumber);
};
