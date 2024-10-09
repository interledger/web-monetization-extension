// @ts-check

/**
 * 1. Validate input version.
 * 2. Check if given tag/release is already promoted to stable. If so, crash.
 * @param {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments
 */
module.exports = async ({ github, context }) => {
  if (context.ref !== 'refs/heads/main') {
    throw new Error('This action only works on main branch');
  }

  const { owner, repo } = context.repo;
  const previewVersionTag = process.env.INPUT_VERSION;
  if (!previewVersionTag) {
    throw new Error('Missing env.INPUT_VERSION');
  }
  if (!previewVersionTag.match(/^v[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+-preview$/)) {
    throw new Error('Input "version" must match vX.X.X.X-preview');
  }

  const versionTag = previewVersionTag.replace('-preview', '');
  try {
    await github.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag: versionTag,
    });
    throw new Error('Release already promoted to stable');
  } catch (error) {
    if (!error.status) {
      throw error;
    }
    if (error.status === 404) {
      // do nothing
    } else {
      throw new Error(`Failed to check: HTTP ${error.status}`, {
        cause: error,
      });
    }
  }
};
