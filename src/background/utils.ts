import { action, runtime } from 'webextension-polyfill'

const iconActive34 = runtime.getURL('assets/icons/icon-active-34.png')
const iconActive128 = runtime.getURL('assets/icons/icon-active-128.png')
const iconInactive34 = runtime.getURL('assets/icons/icon-inactive-34.png')
const iconInactive128 = runtime.getURL('assets/icons/icon-inactive-128.png')

export const updateIcon = async (active: boolean) => {
  const iconData = {
    '34': active ? iconActive34 : iconInactive34,
    '128': active ? iconActive128 : iconInactive128,
  }

  if (action) {
    await action.setIcon({ path: iconData })
  } else if (chrome.browserAction) {
    chrome.browserAction.setIcon({ path: iconData })
  }
}
