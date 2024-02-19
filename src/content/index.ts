import { runtime } from 'webextension-polyfill'

import { initMonetizationTagManager } from '@/utils/monetizationTagManager'

import { loadObserver } from './linksObserver'
import MessageListener from './messageListener'

runtime.onMessage.addListener(MessageListener)

// DEBUG PURPOSE
loadObserver()

// TBD - check logic
initMonetizationTagManager()
