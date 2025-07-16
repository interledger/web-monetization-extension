// @ts-check

/**
 * @typedef {import('@octokit/openapi-webhooks-types').components['schemas']} Schemas
 * @typedef {Schemas['webhook-pull-request-review-submitted']} PullRequestReviewSubmitted
 * @typedef {Schemas['webhook-pull-request-opened']} PullRequest
 */

/**
 * Retrieves the manifest version from the built extension.
 * @param {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments
 */
module.exports = async ({ core, context }) => {
  if (context.eventName === 'pull_request') {
    const event = /** @type {PullRequest} */ (context.payload);
    if (isAllowedAuthor(event.pull_request.author_association)) {
      core.setOutput('matrix', getMatrix(['chromium']));
      return;
    }
  } else if (context.eventName === 'pull_request_review') {
    const event = /** @type {PullRequestReviewSubmitted} */ (context.payload);
    if (
      event.review.body === 'test-e2e' &&
      isAllowedAuthor(event.review.author_association)
    ) {
      core.setOutput('matrix', getMatrix(['chromium', 'chrome', 'msedge']));
      return;
    }
  }

  skip(core);
};

/**
 * @param {Schemas['author-association']} authorAssociation
 */
function isAllowedAuthor(authorAssociation) {
  return (
    authorAssociation === 'OWNER' ||
    authorAssociation === 'MEMBER' ||
    authorAssociation === 'COLLABORATOR'
  );
}

/**
 * @param {import('github-script').AsyncFunctionArguments['core']} core
 * @returns {never}
 */
function skip(core) {
  core.setOutput('matrix', getMatrix([]));
  process.exit(0);
}

/**
 * @typedef {'chromium' | 'chrome' | 'msedge'} Project
 * @param {Project[]} projects
 */
function getMatrix(projects) {
  return [
    {
      name: 'Chromium',
      project: /** @type {Project} */ ('chromium'),
      target: 'chrome',
      'runs-on': 'ubuntu-22.04',
    },
    {
      name: 'Chrome',
      project: /** @type {Project} */ ('chrome'),
      target: 'chrome',
      'runs-on': 'ubuntu-22.04',
    },
    {
      name: 'Edge',
      project: /** @type {Project} */ ('msedge'),
      target: 'chrome',
      'runs-on': 'ubuntu-22.04',
    },
  ].filter((p) => projects.includes(p.project));
}
