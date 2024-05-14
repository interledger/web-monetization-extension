/* eslint-disable no-console */
import { webpack } from 'webpack'
import { getDevConfig } from '../webpack/dev'
import { callbackFn } from '../webpack/config'

const TARGET = process.argv[2] || 'chrome'

if (TARGET !== 'firefox' && TARGET !== 'chrome') {
  console.log('Invalid target. Please use "chrome" or "firefox" as target.')
  console.log(
    'Usage: pnpm dev <TARGET>, where <TARGET> is either "firefox" or "chrome".'
  )
  process.exit(1)
}

const config = getDevConfig(TARGET)

webpack(config, callbackFn)
