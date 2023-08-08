import initReloadClient from '../initReloadClient'
import { BrowserAPI } from '@/src/lib'

export default function addHmrIntoScript(watchPath: string) {
  initReloadClient({
    watchPath,
    onUpdate: () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      BrowserAPI.runtime.reload()
    },
  })
}
