import { Browser } from 'webextension-polyfill'

export class EventsService {
  constructor(private browser: Browser) {}

  async getStorageData() {
    try {
      const data = await this.browser.storage.sync.get(['data'])
      console.log({ data })
      return {
        success: true,
        payload: {
          test: 'x'
        }
      }
    } catch (error) {
      return {
        type: 'ERROR',
        error
      }
    }
  }
}
