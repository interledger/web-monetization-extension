// @ts-check
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-var-requires */
const path = require('node:path')
const fs = require('node:fs/promises')

/**
 * Retrieves the manifest version from the built extension.
 * @param {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments
 */
module.exports = async ({ core }) => {
  const manifestPath = path.join(__dirname, 'dist', 'chrome', 'manifest.json')
  const manifest = await fs.readFile(manifestPath, 'utf8').then(JSON.parse)

  core.setOutput('version', manifest.version)
}
