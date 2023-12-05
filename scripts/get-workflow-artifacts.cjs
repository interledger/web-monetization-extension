/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */

const fs = require('node:fs/promises')
const { COLORS, TEMPLATE_VARS } = require('./constants.cjs')

function capitalizeArtifactName(artifactName) {
  const [, browser] = artifactName.split('-')
  return browser.charAt(0).toUpperCase() + browser.slice(1)
}

function formatBytes(bytes, decimals = 2) {
  if (!Number(bytes)) return '0 bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`
}

module.exports = async ({ github, context, core }) => {
  const workflowRun = context.payload.workflow_run
  const runId = workflowRun.id
  const conclusion = workflowRun.conclusion
  const baseUrl = context.payload.repository.html_url
  const sha = workflowRun.pull_requests[0].head.sha
  const prNumber = workflowRun.pull_requests[0].number
  const jobLogsUrl = `${baseUrl}/actions/runs/${workflowRun.id}`
  const template = await fs.readFile('./scripts/templates/build-status.md', 'utf8')
  const tableRows = []

  let tableBody = ''
  let badgeColor = COLORS.red

  if (conclusion === 'success') {
    const { owner, repo } = context.repo
    const suiteId = workflowRun.check_suite_id
    badgeColor = COLORS.green

    const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: runId,
    })

    artifacts.data.artifacts.forEach(artifact => {
      const browser = capitalizeArtifactName(artifact.name)
      const artifactUrl = `${baseUrl}/suites/${suiteId}/artifacts/${artifact.id}`
      tableRows.push(`
        <tr>
          <td>${browser} (${formatBytes(artifact.size_in_bytes)})
          </td>
          <td>
            <a href="${artifactUrl}">Download</a>
          </td>
        </tr>
        `)
    })

    tableBody = tableRows.join('')
  }

  const commentBody = template
    .replace(TEMPLATE_VARS.conslusion, conclusion)
    .replace(TEMPLATE_VARS.badgeColor, badgeColor)
    .replace(TEMPLATE_VARS.sha, sha)
    .replace(TEMPLATE_VARS.jobLogs, `<a href="${jobLogsUrl}">${jobLogsUrl}}</a>`)
    .replace(TEMPLATE_VARS.tableBody, tableBody)

  core.setOutput('comment_body', commentBody)
  core.setOutput('pr_number', prNumber)
}
