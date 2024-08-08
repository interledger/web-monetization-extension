import type { Browser } from 'webextension-polyfill'

export class Heartbeat {
  constructor(private browser: Browser) {}

  start() {
    setTimeout(
      () =>
        this.browser.alarms.create('keep-alive-alarm-0', {
          periodInMinutes: 1
        }),
      0
    )
    setTimeout(
      () =>
        this.browser.alarms.create('keep-alive-alarm-1', {
          periodInMinutes: 1
        }),
      15 * 1000
    )
    setTimeout(
      () =>
        this.browser.alarms.create('keep-alive-alarm-2', {
          periodInMinutes: 1
        }),
      30 * 1000
    )
    setTimeout(
      () =>
        this.browser.alarms.create('keep-alive-alarm-3', {
          periodInMinutes: 1
        }),
      45 * 1000
    )

    this.browser.alarms.onAlarm.addListener((ev) => {
      console.count('keeping extension alive - ' + ev.name)
    })
  }

  stop() {
    this.browser.alarms.clear('keep-alive-alarm-0')
    this.browser.alarms.clear('keep-alive-alarm-1')
    this.browser.alarms.clear('keep-alive-alarm-2')
    this.browser.alarms.clear('keep-alive-alarm-3')
  }
}
