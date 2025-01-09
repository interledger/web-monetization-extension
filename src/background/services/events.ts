import { EventEmitter } from 'events';
import type {
  AmountValue,
  PopupTransientState,
  Storage,
  TabId,
} from '@/shared/types';

interface BackgroundEvents {
  'open_payments.key_revoked': void;
  'open_payments.out_of_funds': void;
  'open_payments.invalid_receiver': { tabId: number };
  'connect_wallet.close_popup': void;
  'storage.rate_of_pay_update': { rate: string };
  'storage.state_update': {
    state: Storage['state'];
    prevState: Storage['state'];
  };
  'storage.popup_transient_state_update': PopupTransientState;
  'storage.balance_update': Record<
    'recurring' | 'oneTime' | 'total',
    AmountValue
  >;
  'monetization.state_update': TabId;
}

export class EventsService extends EventEmitter {
  constructor() {
    super();
  }

  on<TEvent extends keyof BackgroundEvents>(
    eventName: TEvent,
    listener: (param: BackgroundEvents[TEvent]) => void,
  ): this {
    return super.on(eventName, listener);
  }

  once<TEvent extends keyof BackgroundEvents>(
    eventName: TEvent,
    listener: (param: BackgroundEvents[TEvent]) => void,
  ): this {
    return super.once(eventName, listener);
  }

  emit<TEvent extends keyof BackgroundEvents>(
    eventName: TEvent,
    ...rest: undefined extends BackgroundEvents[TEvent]
      ? [param?: BackgroundEvents[TEvent]]
      : [param: BackgroundEvents[TEvent]]
  ): boolean {
    return super.emit(eventName, ...rest);
  }

  /**
   * Use `on` instead of `addListener`
   * @deprecated
   */
  addListener(): this {
    throw new Error('Use `on` instead of `addListener`.');
  }

  /**
   * Use `off` instead of `removeListener`
   * @deprecated
   */
  removeListener(): this {
    // eslint-disable-next-line prefer-rest-params
    return super.removeListener.apply(this, arguments);
  }
}
