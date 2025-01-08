// @ts-check
const fs = require('node:fs/promises');

/**
 * Retrieves the manifest version from the built extension.
 * @param {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments
 */
module.exports = async ({ core }) => {
  const manifest = await fs
    .readFile('./dist/chrome/manifest.json', 'utf8')
    .then(JSON.parse);

  core.setOutput('version', manifest.version);
};
