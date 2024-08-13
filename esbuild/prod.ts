/* eslint-disable no-console */
import fs from 'fs'
import path from 'path'
import type { BuildOptions, Plugin as ESBuildPlugin } from 'esbuild'
import archiver from 'archiver'
import type { BuildArgs } from './config'
import { getPlugins } from './plugins'
import { typecheckPlugin } from '@jgoz/esbuild-plugin-typecheck'

export const getProdOptions = ({
  outDir,
  target,
  channel
}: Omit<BuildArgs, 'dev'> & {
  outDir: string
}): BuildOptions => {
  return {
    sourcemap: false,
    metafile: true,
    minify: true,
    plugins: getPlugins({ outDir, dev: false, target, channel }).concat([
      typecheckPlugin({ buildMode: 'readonly' }),
      zipPlugin({ outDir })
    ]),
    define: {
      NODE_ENV: JSON.stringify('production'),
      CONFIG_LOG_LEVEL: JSON.stringify('WARN'),
      CONFIG_PERMISSION_HOSTS: JSON.stringify({ origins: ['https://*/*'] }),
      CONFIG_ALLOWED_PROTOCOLS: JSON.stringify(['https:']),
      CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
        'https://webmonetization.org/welcome'
      )
    }
  }
}

function zipPlugin({ outDir }): ESBuildPlugin {
  return {
    name: 'zipPlugin',
    setup(build) {
      build.onEnd(async () => {
        const output = fs.createWriteStream(`${outDir}.zip`)
        const archive = archiver('zip')
        archive.on('end', function () {
          const archiveSize = archive.pointer()
          const fileName = path.relative(process.cwd(), `${outDir}.zip`)
          console.log(`   Archived ${fileName}: ${formatBytes(archiveSize)}`)
        })
        archive.pipe(output)
        archive.glob('**/*', { cwd: outDir, ignore: ['meta.json'] })
        // archive.directory(outDir, false)
        await archive.finalize()
      })
    }
  }
}

function formatBytes(bytes: number, decimals: number = 2) {
  if (!Number(bytes)) return '0B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`
}
