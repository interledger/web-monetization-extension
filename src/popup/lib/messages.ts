import {
  MessageManager,
  type PopupToBackgroundMessage
} from '@/shared/messages'
import browser from 'webextension-polyfill'

export const message = new MessageManager<PopupToBackgroundMessage>({ browser })
