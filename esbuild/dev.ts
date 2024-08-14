import type { BuildOptions } from 'esbuild'
import type { BuildArgs } from './config'
import { getPlugins } from './plugins'
import { typecheckPlugin } from '@jgoz/esbuild-plugin-typecheck'

export const getDevOptions = ({
  outDir,
  target,
  channel
}: Omit<BuildArgs, 'dev'> & {
  outDir: string
}): BuildOptions => {
  return {
    sourcemap: 'linked',
    metafile: false,
    minify: false,
    define: {
      NODE_ENV: JSON.stringify('development'),
      CONFIG_LOG_LEVEL: JSON.stringify('DEBUG'),
      CONFIG_PERMISSION_HOSTS: JSON.stringify({
        origins: ['http://*/*', 'https://*/*']
      }),
      CONFIG_ALLOWED_PROTOCOLS: JSON.stringify(['http:', 'https:']),
      CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
        'https://webmonetization.org/welcome'
      )
    },
    plugins: getPlugins({ outDir, dev: true, target, channel }).concat([
      typecheckPlugin({ buildMode: 'readonly', watch: true })
    ])
  }
}
