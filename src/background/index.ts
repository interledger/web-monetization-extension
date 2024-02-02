import { action, Runtime, runtime, Tabs, tabs } from 'webextension-polyfill'

import { PaymentFlowService } from '@/background/grantFlow'

const iconActive34 = runtime.getURL('assets/icons/icon-active-34.png')
const iconActive128 = runtime.getURL('assets/icons/icon-active-128.png')
const iconInactive34 = runtime.getURL('assets/icons/icon-inactive-34.png')
const iconInactive128 = runtime.getURL('assets/icons/icon-inactive-128.png')

function arrayBufferToString(buf: ArrayBuffer) {
  return String.fromCharCode.apply(null, new Uint8Array(buf))
}

/**
 * Define background script functions
 * @type {class}
 */
class Background {
  _port: number
  grantFlow: PaymentFlowService | null = null
  spentAmount: number = 0
  paymentStarted = false

  constructor() {
    this.init()
  }

  /**
   * Document Ready
   *
   * @returns {void}
   */
  init = async () => {
    //When extension installed
    runtime.onInstalled.addListener(this.onInstalled)

    //Add message listener in Browser.
    runtime.onMessage.addListener(this.onMessage)

    //Add Update listener for tab
    tabs.onUpdated.addListener(this.onUpdatedTab)

    //Add New tab create listener
    tabs.onCreated.addListener(this.onCreatedTab)

    //Add tab change listener
    tabs.onActivated.addListener(this.handleTabChange)
  }

  //TODO: Listeners

  async exportPublicCryptoKey(key: CryptoKey) {
    const publicKey = await window.crypto.subtle.exportKey('spki', key)
    const jwk = await window.crypto.subtle.exportKey('jwk', key)

    if (!jwk.x) {
      throw new Error('Missing x coordinate')
    }

    // Used the fetch the key id from the jwks.json route
    chrome.storage.local.set({ x: jwk.x })

    const stringPublicKey = arrayBufferToString(publicKey)
    const base64PublicKey = window.btoa(stringPublicKey)
    const pem = `-----BEGIN PUBLIC KEY-----\n${base64PublicKey}\n-----END PUBLIC KEY-----`

    return pem
  }

  async exportPrivateCryptoKey(key: CryptoKey) {
    const privateKey = await window.crypto.subtle.exportKey('jwk', key)
    // const stringPrivateKey = arrayBufferToString(privateKey)
    // const base64PrivateKey = window.btoa(stringPrivateKey)
    // const pemExported = `-----BEGIN PRIVATE KEY-----\n${base64PrivateKey}\n-----END PRIVATE KEY-----`

    return privateKey
  }

  private async keyExists(): Promise<boolean> {
    return new Promise(res => {
      chrome.storage.local.get(['publicKey', 'privateKey', 'x'], values => {
        if (values.publicKey && values.privateKey && values.x) {
          res(true)
        } else {
          res(false)
        }
      })
    })
  }

  /**
   * Extension Installed
   */
  onInstalled = async () => {
    chrome.storage.local.get(['publicKey', 'privateKey', 'x', 'keyId'], values => {
      console.log({ values })
    })

    if (await this.keyExists()) return

    const keys = await window.crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      true,
      ['sign', 'verify'],
    )

    if (keys instanceof CryptoKey) {
      throw new Error('Expected CryptoKeyPair. CryptoKey was generated')
    }

    const publicKey = await this.exportPublicCryptoKey(keys.publicKey)
    const privateKey = await this.exportPrivateCryptoKey(keys.privateKey)

    chrome.storage.local.set({ publicKey, privateKey }, () => {
      console.info('Public key and private key were successfully saved.')
    })
  }

  /**
   * Message Handler Function
   *
   * @param message
   * @param sender
   * @returns
   */
  onMessage = async (message: EXTMessage, sender: Runtime.MessageSender) => {
    try {
      console.log('[===== Received message =====]', message, sender)
      switch (message.type) {
        case 'IS_MONETIZATION_READY': {
          if (message?.data) {
            this.updateIcon(message.data.monetization)
          }
          break
        }

        case 'SET_INCOMING_POINTER': {
          const {
            incomingPayment: receivingPaymentPointerUrl,
            paymentPointer: sendingPaymentPointerUrl,
            amount,
          } = message.data

          chrome.storage.local.get('x', async v => {
            const { x } = v
            const response = await fetch('https://eu1.fynbos.me/radu/jwks.json', {
              headers: {
                'Content-Type': 'application/json',
              },
            })

            const json = (await response.json()) as { keys: (JsonWebKey & { kid: string })[] }

            json.keys.forEach(j => {
              if (j.x === x) {
                chrome.storage.local.set({ keyId: j.kid }, () => {
                  console.info('Fetched key id for public key - ' + j.kid)
                })
              }
            })
          })

          if (this.grantFlow?.sendingPaymentPointerUrl === sendingPaymentPointerUrl) {
            if (!this.paymentStarted) {
              this.paymentStarted = true
              const currentTabId = await this.grantFlow?.getCurrentActiveTabId()
              await tabs.sendMessage(currentTabId ?? 0, { type: 'START_PAYMENTS' })
            }
          } else {
            this.grantFlow = new PaymentFlowService(
              sendingPaymentPointerUrl,
              receivingPaymentPointerUrl,
              amount,
            )

            this.grantFlow.initPaymentFlow()
          }

          break
        }

        case 'GET_SENDING_PAYMENT_POINTER': {
          if (this.grantFlow) {
            const { sendingPaymentPointerUrl, amount } = this.grantFlow
            return {
              type: 'SUCCESS',
              data: { sendingPaymentPointerUrl, amount, started: this.paymentStarted },
            }
          }

          return {
            type: 'ERROR',
            data: { sendingPaymentPointerUrl: '' },
          }
        }

        case 'RUN_PAYMENT': {
          if (this.grantFlow) {
            this.grantFlow.sendPayment()
            this.spentAmount = Number(
              parseFloat(String(this.spentAmount + 1000000 / 10 ** 9)).toFixed(3),
            )
            this.sendSpendAmount()
            this.paymentStarted = true
          }
          break
        }

        case 'PAUSE_PAYMENTS': {
          this.paymentStarted = false
          break
        }
      }

      return true // result to reply
    } catch (error) {
      console.log('[===== Error in MessageListener =====]', error)
      return error
    }
  }

  /**
   * Message from Long Live Connection
   *
   * @param msg
   */
  onMessageFromExtension = (msg: EXTMessage) => {
    console.log('[===== Message from Long Live Connection =====]', msg)
  }

  /**
   *
   * @param tab
   */
  onCreatedTab = (tab: Tabs.Tab) => {
    console.log('[===== New Tab Created =====]', tab)
  }

  sendSpendAmount() {
    runtime.sendMessage({
      type: 'SPENT_AMOUNT',
      data: { spentAmount: this.spentAmount },
    })
  }

  /**
   * When changes tabs
   *
   * @param {*} tabId
   * @param {*} changeInfo
   * @param {*} tab
   */
  onUpdatedTab = async (tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, tab: Tabs.Tab) => {
    if (tab.status === 'complete' && tab.url?.match(/^http/)) {
      const response = await this.sendMessage(tab, { type: 'IS_MONETIZATION_READY' })
      if (response.data) {
        await this.updateIcon(response.data.monetization)
      }
    }
  }

  /**
   * Get url from tabId
   *
   */
  getURLFromTab = async (tabId: number) => {
    try {
      const tab = await tabs.get(tabId)
      return tab.url || ''
    } catch (error) {
      console.log(`[===== Could not get Tab Info$(tabId) in getURLFromTab =====]`, error)
      throw ''
    }
  }

  /**
   * Open new tab by url
   *
   */
  openNewTab = async (url: string) => {
    try {
      const tab = await tabs.create({ url })
      return tab
    } catch (error) {
      console.log(`[===== Error in openNewTab =====]`, error)
      return null
    }
  }

  /**
   * Close specific tab
   *
   * @param {number} tab
   */
  closeTab = async (tab: Tabs.Tab) => {
    try {
      await tabs.remove(tab.id ?? 0)
    } catch (error) {
      console.log(`[===== Error in closeTab =====]`, error)
    }
  }

  /**
   * send message
   */
  sendMessage = async (tab: Tabs.Tab, msg: EXTMessage) => {
    try {
      const res = await tabs.sendMessage(tab.id ?? 0, msg)
      return res
    } catch (error) {
      console.log(`[===== Error in sendMessage =====]`, error)
      return null
    }
  }

  updateIcon = async (active: boolean) => {
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

  handleTabChange = async (activeInfo: chrome.tabs.TabActiveInfo) => {
    const tabId = activeInfo.tabId

    const tab = await tabs.get(tabId)
    if (tab && tab.url?.includes('https') && tab.status === 'complete') {
      const response = await this.sendMessage(tab, { type: 'IS_MONETIZATION_READY' })
      if (response?.data) {
        this.updateIcon(response.data.monetization)
      }
    }
  }
}

export const background = new Background()
