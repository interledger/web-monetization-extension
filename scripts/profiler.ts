/* eslint-disable no-console */
import { webpack } from 'webpack'
import { Target, callbackFn } from '../webpack/config'
import { getProfileConfig } from '../webpack/profile'

const TARGET = (process.argv[2] as Target) || 'chrome'
const MANIFEST_VERSION = process.argv.slice(2).includes('--mv2') ? 2 : 3

if (TARGET !== 'firefox' && TARGET !== 'chrome') {
  console.log('Invalid target. Please use "chrome" or "firefox" as target.')
  console.log(
    'Usage: pnpm dev <TARGET>, where <TARGET> is either "firefox" or "chrome".'
  )
  process.exit(1)
}

process.env.NODE_ENV = 'development'
const config = getProfileConfig(TARGET, MANIFEST_VERSION)

webpack(config, callbackFn)
