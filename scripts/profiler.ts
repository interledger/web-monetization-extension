/* eslint-disable no-console */
import { webpack } from 'webpack'
import { Target } from '../webpack/config'
import { getProfileConfig } from '../webpack/profile'

const TARGET = (process.argv[2] as Target) || 'chrome'

if (TARGET !== 'firefox' && TARGET !== 'chrome') {
  console.log('Invalid target. Please use "chrome" or "firefox" as target.')
  console.log(
    'Usage: pnpm dev <TARGET>, where <TARGET> is either "firefox" or "chrome".'
  )
  process.exit(1)
}

const config = getProfileConfig(TARGET)

webpack(config, (_, s) => {
  console.log('Compilation complete', `${s?.endTime - s?.startTime}ms`)
})
