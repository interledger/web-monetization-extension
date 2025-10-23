import fs from 'node:fs/promises';
import type { AsyncFunctionArguments } from 'github-script';

/**
 * Retrieves the manifest version from the built extension.
 */
export default async ({ core }: AsyncFunctionArguments) => {
  const manifest = await fs
    .readFile('./dist/chrome/manifest.json', 'utf8')
    .then(JSON.parse);

  core.setOutput('version', manifest.version);
};