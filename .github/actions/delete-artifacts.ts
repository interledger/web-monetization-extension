import type { AsyncFunctionArguments } from 'github-script';
import { BROWSERS, type Browser } from './constants.ts';

async function getBrowserArtifacts(
  { github, context }: Pick<AsyncFunctionArguments, 'github' | 'context'>,
  name: string,
) {
  const result = await github.rest.actions.listArtifactsForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name,
  });
  return result.data.artifacts;
}

async function getPRArtifacts(
  { github, context }: Pick<AsyncFunctionArguments, 'github' | 'context'>,
  prNumber: number,
) {
  const data = await Promise.all(
    BROWSERS.map((browser: Browser) =>
      getBrowserArtifacts({ github, context }, `${prNumber}-${browser}`),
    ),
  );

  const artifacts: { id: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    // same as `artifacts.push(...data[i])` but it's a bit faster
    artifacts.push.apply(artifacts, data[i]);
  }
  return artifacts;
}

export default async ({ github, context, core }: AsyncFunctionArguments) => {
  if (context.payload.action !== 'closed') {
    core.setFailed('This action only works on closed PRs.');
  }

  const { owner, repo } = context.repo;
  const prNumber: number = context.payload.number;

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
