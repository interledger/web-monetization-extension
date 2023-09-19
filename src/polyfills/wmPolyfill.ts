import 'core-js/stable'
import 'regenerator-runtime/runtime'

import { wm2Polyfill } from './wm2Polyfill'

const createBindingCode = (events: string[]) => {
  const colorCode = `color: aqua; background-color: black`
  return events
    .map(
      e =>
        `document.monetization.addEventListener('${e}', ` +
        `(e) => console.log(
           '%c WM1 %s event:  %s',
           '${colorCode}',
           e.type,
           JSON.stringify(e.detail)) )
          `,
    )
    .join(';')
}

const basicEventsLoggingCode = createBindingCode([
  'monetizationstart',
  'monetizationstop',
  'monetizationpending',
])

// This can be quite noisy so only enable when localStorage.WM_DEBUG_PROGRESS
// is set.
const progressLoggingCode = createBindingCode(['monetizationprogress'])

// language=JavaScript
export const wm1Polyfill = `
  class Monetization extends EventTarget {
    state = 'stopped'

    get [Symbol.toStringTag]() {
      return 'Monetization'
    }
  }

  document.monetization = new Monetization()
  // TODO: use coil-monetization-v1 and update content script that sends
  // the events
  document.addEventListener('monetization-v1', function(event) {
    const { type, detail } = event.detail
    if (type === 'monetizationstatechange') {
      document.monetization.state = detail.state
    } else {
      document.monetization.dispatchEvent(
        new CustomEvent(type, {
          detail: detail
        }))
    }
  })
`

// language=JavaScript
export const wmPolyfill = `
  ${wm1Polyfill}

  if (localStorage.WM_DEBUG) {
    ${basicEventsLoggingCode}
  }

  if (localStorage.WM_DEBUG_PROGRESS) {
    ${progressLoggingCode}
  }

  // Block scoped so vars will not be set on window unless explicitly done
  // noinspection PointlessBooleanExpressionJS
  {
    ${wm2Polyfill}
  }
`

export const includePolyFillMessage = `
Unable to inject \`document.monetization\` polyfill!
Include the polyfill in your page:
<script type="application/javascript">${wm1Polyfill}</script>
`
