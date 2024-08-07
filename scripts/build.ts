/* eslint-disable no-console */
import { webpack } from 'webpack'
import { TARGETS, callbackFn, type Target } from '../webpack/config'
import { getProdConfig } from '../webpack/prod'

const TARGET: Target | null = process.argv[2]
  ? (process.argv[2] as Target)
  : null

if (TARGET !== null && !TARGETS.includes(TARGET)) {
  console.log('Invalid target. Please use "chrome" or "firefox" as target.')
  console.log(
    'Usage: pnpm prod <TARGET>, where <TARGET> is either "firefox" or "chrome".'
  )
  console.log(
    'Omitting the target the extension will be built for all available targets.'
  )
  process.exit(1)
}

process.env.NODE_ENV ||= 'production'

// If no target is specified, build for all available targets
if (TARGET === null) {
  console.log(`Building extension for all available targets...`)
  TARGETS.forEach((target) => {
    const config = getProdConfig(target)
    webpack(config, callbackFn)
  })
} else {
  const config = getProdConfig(TARGET)
  console.log(`Building extension for ${TARGET.toUpperCase()}...`)
  webpack(config, callbackFn)
}
