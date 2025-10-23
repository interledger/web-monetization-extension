import type { AsyncFunctionArguments } from 'github-script';
import type { components } from '@octokit/openapi-webhooks-types';

type Schemas = components['schemas'];
type PullRequestReviewSubmitted =
  Schemas['webhook-pull-request-review-submitted'];
type PullRequest = Schemas['webhook-pull-request-opened'];
type AuthorAssociation = Schemas['author-association'];

type Project = 'chromium' | 'chrome' | 'msedge';

export default async ({ core, context }: AsyncFunctionArguments) => {
  if (context.eventName === 'pull_request') {
    const event = context.payload as PullRequest;
    if (!isAllowedAuthor(event.pull_request.author_association)) {
      await skip(core, 'The PR author is not allowed to run them.');
    }

    const matrix = getMatrix(['chromium']);
    core.setOutput('matrix', matrix);
    core.info(`Running E2E tests for ${matrix.map((m) => m.name).join(', ')}`);
  }

  if (context.eventName === 'pull_request_review') {
    const event = context.payload as PullRequestReviewSubmitted;
    if (event.review.body !== 'test-e2e') {
      await skip(core, 'The review comment body is not `test-e2e`');
    }
    if (!isAllowedAuthor(event.review.author_association)) {
      await skip(core, 'The review author is not allowed to run them.');
    }

    const matrix = getMatrix(['chromium', 'chrome', 'msedge']);
    core.setOutput('matrix', matrix);
    core.info(`Running E2E tests for ${matrix.map((m) => m.name).join(', ')}`);
  }
};

function isAllowedAuthor(authorAssociation: AuthorAssociation): boolean {
  return (
    authorAssociation === 'OWNER' ||
    authorAssociation === 'MEMBER' ||
    authorAssociation === 'COLLABORATOR'
  );
}

async function skip(
  core: AsyncFunctionArguments['core'],
  reason: string,
): Promise<never> {
  core.info('Skipping running E2E tests.');
  core.setOutput('skip', true);
  core.setOutput('matrix', getMatrix([]));
  await core.summary.addQuote(`Skipping tests: ${reason}`).write();
  process.exit(0);
}

function getMatrix(projects: Project[]) {
  return [
    {
      name: 'Chromium',
      project: 'chromium' as Project,
      target: 'chrome',
      'runs-on': 'ubuntu-24.04',
    },
    {
      name: 'Chrome',
      project: 'chrome' as Project,
      target: 'chrome',
      'runs-on': 'ubuntu-24.04',
    },
    {
      name: 'Edge',
      project: 'msedge' as Project,
      target: 'chrome',
      'runs-on': 'ubuntu-24.04',
    },
  ].filter((p) => projects.includes(p.project));
}
