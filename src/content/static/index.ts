import { wm2Polyfill } from '@/content/static/polyfill'

function inject(configure: (_script: HTMLScriptElement) => void) {
  const script = document.createElement('script')
  configure(script)
  document.documentElement.appendChild(script)
}

// eslint-disable-next-line @typescript-eslint/no-extra-semi
;(function injectCode(code: string) {
  inject(script => (script.innerHTML = code))
})(wm2Polyfill)
