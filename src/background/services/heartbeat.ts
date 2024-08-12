import type { Cradle } from '@/background/container'
import type { Browser } from 'webextension-polyfill'

export class Heartbeat {
  private browser: Browser

  constructor({ browser }: Cradle) {
    Object.assign(this, {
      browser
    })
  }

  start() {
    const alarms = this.browser.alarms
    // The minimum supported cross-browser period is 1 minute. So, we create 4
    // alarms at a 0,15,30,45 seconds delay. So, we'll get an alarm every 15s -
    // and that'll help us keep the background script alive.

    // Note that the first alarm will trigger after a minute, but this maybe
    // fine for our use case, as we may have enough events between start and
    // first minute that our extension stays alive.
    setTimeout(
      () => alarms.create('keep-alive-alarm-0', { periodInMinutes: 1 }),
      0
    )
    setTimeout(
      () => alarms.create('keep-alive-alarm-1', { periodInMinutes: 1 }),
      15 * 1000
    )
    setTimeout(
      () => alarms.create('keep-alive-alarm-2', { periodInMinutes: 1 }),
      30 * 1000
    )
    setTimeout(
      () => alarms.create('keep-alive-alarm-3', { periodInMinutes: 1 }),
      45 * 1000
    )

    alarms.onAlarm.addListener(() => {
      // doing nothing is enough to keep it alive
    })
  }

  stop() {
    this.browser.alarms.clear('keep-alive-alarm-0')
    this.browser.alarms.clear('keep-alive-alarm-1')
    this.browser.alarms.clear('keep-alive-alarm-2')
    this.browser.alarms.clear('keep-alive-alarm-3')
  }
}
