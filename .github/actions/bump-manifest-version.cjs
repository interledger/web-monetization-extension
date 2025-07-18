// @ts-check
const fs = require('node:fs/promises');

/** @param {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments */
module.exports = async ({ core }) => {
  const manifestPath = './src/manifest.json';
  const manifestFile = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestFile);
  /**@type {string} */
  const existingVersion = manifest.version;

  const bumpType = /** @type {BumpType} */ (process.env.INPUT_VERSION);
  if (!bumpType) {
    throw new Error('Missing bump type');
  }

  const version = bumpVersion(existingVersion, bumpType).join('.');

  console.log({ existingVersion, bumpType, version });

  manifest.version = version;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  await updateXCConfig(version);
  core.setOutput('version', version);
};

/**
 * @typedef {'build' | 'patch' | 'minor'} BumpType
 * @param {string} existingVersion
 * @param {BumpType} type
 * @return {[major: number, minor: number, patch: number, build: number]}
 */
function bumpVersion(existingVersion, type) {
  const parts = existingVersion.split('.').map(Number);
  if (parts.length !== 4 || parts.some((e) => !Number.isSafeInteger(e))) {
    throw new Error('Existing version does not have right format');
  }
  const [major, minor, patch, build] = parts;

  switch (type) {
    case 'build':
      return [major, minor, patch, build + 1];
    case 'patch':
      return [major, minor, patch + 1, 0];
    case 'minor':
      return [major, minor + 1, 0, 0];
    default:
      throw new Error(`Unknown bump type: ${type}`);
  }
}

/**
 * @param {string} version
 */
async function updateXCConfig(version) {
  const filePath = './src/safari/Web Monetization/Config.xcconfig';

  const data = {
    CURRENT_PROJECT_VERSION: version,
  };

  let config = await fs.readFile(filePath, 'utf8');
  for (const [key, value] of Object.entries(data)) {
    const re = new RegExp(`${key} = .*`);
    config = config.replace(re, `${key} = ${value}`);
  }
  await fs.writeFile(filePath, config, 'utf8');
}
