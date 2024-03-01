/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
const { BROWSERS } = require('./constants.cjs')

async function getBrowserArfifacts({ github, owner, repo, name }) {
  const artifacts = []
  const result = await github.rest.actions.listArtifactsForRepo({
    owner,
    repo,
    name
  })

  for (let i = 0; i < result.data.total_count; i++) {
    artifacts.push(result.data.artifacts[i].id)
  }

  return artifacts
}

async function getPRArtifacts({ github, owner, repo, prNumber }) {
  const promises = []
  const artifacts = []

  BROWSERS.forEach((browser) =>
    promises.push(
      getBrowserArfifacts({
        github,
        owner,
        repo,
        name: `${prNumber}-${browser}`
      })
    )
  )

  const data = await Promise.all(promises)

  for (let i = 0; i < data.length; i++) {
    artifacts.push.apply(artifacts, data[i])
  }

  return artifacts
}

module.exports = async ({ github, context, core }) => {
  if (context.payload.action !== 'closed') {
    core.setFailed('This action only works on closed PRs.')
  }

  const { owner, repo } = context.repo
  const prNumber = context.payload.number
  const promises = []

  const artifacts = await getPRArtifacts({ github, owner, repo, prNumber })

  for (let i = 0; i < artifacts.length; i++) {
    promises.push(
      github.rest.actions.deleteArtifact({
        owner,
        repo,
        artifact_id: artifacts[i]
      })
    )
  }

  await Promise.all(promises)
  console.log(`Deleted ${artifacts.length} artifacts for PR #${prNumber}.`)
}
