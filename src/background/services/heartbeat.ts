import type { StorageService } from '.'

export class Heartbeat {
  private interval: ReturnType<typeof setInterval>

  constructor(private storage: StorageService) {}

  start() {
    this.interval = setInterval(this.run.bind(this), 20 * 1000)
  }

  run() {
    void this.storage.get(['version'])
  }

  stop() {
    clearInterval(this.interval)
  }
}
