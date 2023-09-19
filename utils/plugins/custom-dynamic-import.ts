import type { PluginOption } from 'vite'

export default function customDynamicImport(): PluginOption {
  return {
    name: 'custom-dynamic-import',
    renderDynamicImport() {
      if (process.env.__FIREFOX__) {
        return {
          left: `
        //   @TODO: Replace chrome with browser on MV3
        {
          const dynamicImport = (path) => import(path);
          dynamicImport(chrome.runtime.getURL('./') +
          `,
          right: `.split('../').join(''))}`,
        }
      }

      return {
        left: `
        {
          const dynamicImport = (path) => import(path);
          dynamicImport(
          `,
        right: ')}',
      }
    },
  }
}
