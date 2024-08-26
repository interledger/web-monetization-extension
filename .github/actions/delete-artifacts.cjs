// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const { BROWSERS } = require('./constants.cjs');

/**
 * @param {Pick<import('github-script').AsyncFunctionArguments, 'github' | 'context'>} AsyncFunctionArguments
 * @param {string} name
 */
async function getBrowserArtifacts({ github, context }, name) {
  const result = await github.rest.actions.listArtifactsForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name,
  });
  return result.data.artifacts;
}

/**
 * @param {Pick<import('github-script').AsyncFunctionArguments, 'github' | 'context'>} AsyncFunctionArguments
 * @param {number} prNumber
 */
async function getPRArtifacts({ github, context }, prNumber) {
  const data = await Promise.all(
    BROWSERS.map((browser) =>
      getBrowserArtifacts({ github, context }, `${prNumber}-${browser}`),
    ),
  );

  /** @type {{id: number}[]} */
  const artifacts = [];
  for (let i = 0; i < data.length; i++) {
    // same as `artifacts.push(...data[i])` but it's a bit faster
    artifacts.push.apply(artifacts, data[i]);
  }
  return artifacts;
}

/** @param {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments */
module.exports = async ({ github, context, core }) => {
  if (context.payload.action !== 'closed') {
    core.setFailed('This action only works on closed PRs.');
  }

  const { owner, repo } = context.repo;
  /** @type {number} */
  const prNumber = context.payload.number;

  const artifacts = await getPRArtifacts({ github, context }, prNumber);

  await Promise.all(
    artifacts.map((artifact) =>
      github.rest.actions.deleteArtifact({
        owner,
        repo,
        artifact_id: artifact.id,
      }),
    ),
  );

  console.log(`Deleted ${artifacts.length} artifacts for PR #${prNumber}.`);
};
