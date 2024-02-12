import Background from '@/background/Background'

const loadFireHandler = async (data: undefined, background: Background) => {
  chrome.runtime.sendMessage({ type: 'LOAD', data: 'from runtime' }, res => {
    console.log('LOAD message sent successfully from runtime and received', res)
  })

  chrome.tabs.query({}, tabs => {
    console.log(tabs)
    tabs.forEach(tab => {
      console.log(tab.id)
      chrome.tabs.sendMessage(tab.id || 0, { type: 'LOAD', data: `from tab ${tab.id}` }, res => {
        console.log('LOAD message sent successfully from tabs and received', res)
      })
    })
  })

  return 'SUCCESS'
}

export default { callback: loadFireHandler, type: 'FIRE_LOAD' }
