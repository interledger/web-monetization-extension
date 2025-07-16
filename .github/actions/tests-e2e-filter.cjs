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
    if (!isAllowedAuthor(event.pull_request.author_association)) {
      skip(core, 'The PR author is not allowed to run them.');
    }

    const matrix = getMatrix(['chromium']);
    core.setOutput('matrix', matrix);
    core.info(`Running tests for ${matrix.map((m) => m.name).join(', ')}`);
  }

  if (context.eventName === 'pull_request_review') {
    const event = /** @type {PullRequestReviewSubmitted} */ (context.payload);
    if (event.review.body !== 'test-e2e') {
      skip(core, 'The review comment body is not `test-e2e`');
    }
    if (!isAllowedAuthor(event.review.author_association)) {
      skip(core, 'The review author is not allowed to run them.');
    }

    const matrix = getMatrix(['chromium', 'chrome', 'msedge']);
    core.setOutput('matrix', matrix);
    core.info(`Running tests for ${matrix.map((m) => m.name).join(', ')}`);
  }
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
 * @param {string} reason
 * @returns {never}
 */
function skip(core, reason) {
  void core.summary.addQuote(`Skipping tests: ${reason}`).write();
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
