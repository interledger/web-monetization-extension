import { runtime } from 'webextension-polyfill'

import { initMonetizationTagManager } from '@/utils/monetizationTagManager'
import { wm2Polyfill } from '@/utils/polyfill'

import { loadObserver } from './linksObserver'
import MessageListener from './messageListener'

// import "./content.css";

runtime.onMessage.addListener(MessageListener)

function inject(configure: (_script: HTMLScriptElement) => void) {
  const script = document.createElement('script')
  configure(script)
  document.documentElement.appendChild(script)
  // document.documentElement.removeChild(script)
}

// eslint-disable-next-line @typescript-eslint/no-extra-semi
;(function injectCode(code: string) {
  inject(script => (script.innerHTML = code))
})(wm2Polyfill)

loadObserver()
initMonetizationTagManager()

// Example of getting data into content
;(() => {
  chrome.runtime.sendMessage({ type: 'GET_STORAGE_DATA' }, res => {
    console.log('in content', res)
  })
})()

// Test if script executed everytime or only on active tab
;(() => {
  // set listener
  chrome.runtime.onMessage.addListener(
    (message: EXTMessage, sender: any, sendResponse: (res: any) => void) => {
      if (message.type === 'LOAD') {
        console.log('LOAD event with data', message.data)
        sendResponse(message.data)
      }
      // return true
    },
  )

  // tell background to fire the load event
  chrome.runtime.sendMessage({ type: 'FIRE_LOAD' }, res => {
    console.log('LOAD_FIRE finished with result', res)
  })
})()
