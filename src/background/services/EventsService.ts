import { Browser } from 'webextension-polyfill'

export class EventsService {
  constructor(private browser: Browser) {}

  async getStorageData() {
    try {
      const { data } = await this.browser.storage.sync.get('data')

      return {
        type: 'SUCCESS',
        data,
      }
    } catch (error) {
      return {
        type: 'ERROR',
        error,
      }
    }
  }
}
