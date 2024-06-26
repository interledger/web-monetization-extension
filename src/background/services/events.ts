import { EventEmitter } from 'events'

interface BackgroundEvents {
  'storage.rate_of_pay_update': { rate: string }
  'storage.host_permissions_update': { status: boolean }
}

export class EventsService extends EventEmitter {
  constructor() {
    super()
  }

  on<TEvent extends keyof BackgroundEvents>(
    eventName: TEvent,
    listener: (param: BackgroundEvents[TEvent]) => void
  ): this {
    return super.on(eventName, listener)
  }

  once<TEvent extends keyof BackgroundEvents>(
    eventName: TEvent,
    listener: (param: BackgroundEvents[TEvent]) => void
  ): this {
    return super.once(eventName, listener)
  }

  emit<TEvent extends keyof BackgroundEvents>(
    eventName: TEvent,
    ...rest: undefined extends BackgroundEvents[TEvent]
      ? [param?: BackgroundEvents[TEvent]]
      : [param: BackgroundEvents[TEvent]]
  ): boolean {
    return super.emit(eventName, ...rest)
  }

  /**
   * Use `on` instead of `addListener`
   * @deprecated
   */
  addListener(): this {
    throw new Error('Use `on` instead of `addListener`.')
  }

  /**
   * Use `off` instead of `removeListener`
   * @deprecated
   */
  removeListener(): this {
    // eslint-disable-next-line prefer-rest-params
    super.removeListener.apply(this, arguments)
    return this
  }
}
