import { proxy, useSnapshot } from 'valtio';
import { normalizeHostname } from '@/shared/helpers';
import { compareSitesByDomain } from '@/pages/shared/lib/utils';
import type {
  AmountValue,
  DeepNonNullable,
  Host,
  PopupStore,
} from '@/shared/types';
import type { BackgroundToPopupMessage } from '@/shared/messages';

export type PopupState = Required<
  DeepNonNullable<Omit<PopupStore, 'state'>> & Pick<PopupStore, 'state'>
>;

export const store = proxy<PopupState>({} as PopupState);

// easier than importing valtio and store (single import)
export const usePopupState = () => useSnapshot(store);

// This exists so we don't have to update all dispatch calls everywhere. Also
// keeps all actions together. Can move to better strategies in future.
export const dispatch = ({ type, data }: Actions) => {
  switch (type) {
    case 'SET_DATA_POPUP': {
      for (const key of Object.keys(data) as Array<keyof PopupState>) {
        // @ts-expect-error we know TypeScript
        store[key] = data[key];
      }
      break;
    }
    case 'TOGGLE_CONTINUOUS_PAYMENTS': {
      store.continuousPaymentsEnabled = !store.continuousPaymentsEnabled;
      return;
    }
    case 'TOGGLE_PAYMENTS': {
      store.enabled = !store.enabled;
      return;
    }
    case 'OPT_IN_OUT_TELEMETRY':
      store.consentTelemetry = data.isOptedIn;
      break;
    case 'SET_CONNECTED':
      store.connected = data.connected;
      break;
    case 'UPDATE_RATE_OF_PAY':
      store.rateOfPay = data.rateOfPay;
      break;
    case 'UPDATE_SITE_RATE_OF_PAY': {
      const hostname = normalizeHostname(data.hostname);
      const tabHostname = URL.parse(store.tab.url || '')?.hostname;
      if (tabHostname && normalizeHostname(tabHostname) === hostname) {
        store.tab.rateOfPay = data.rate ?? undefined;
      }

      store.sitesRateOfPay ??= [];
      if (data.rate === null) {
        store.sitesRateOfPay = store.sitesRateOfPay.filter(
          (e) => e.hostname !== hostname,
        );
      } else {
        const e = store.sitesRateOfPay.find((e) => e.hostname === hostname);
        if (!e) {
          store.sitesRateOfPay = [
            ...store.sitesRateOfPay,
            { hostname, rate: data.rate },
          ].sort((a, b) => compareSitesByDomain(a.hostname, b.hostname));
        } else {
          e.rate = data.rate;
        }
      }
      break;
    }
    case 'SET_DATA_SITES_RATE_OF_PAY':
      store.sitesRateOfPay = [...data].sort((a, b) =>
        compareSitesByDomain(a.hostname, b.hostname),
      );
      break;
    case 'SET_STATE':
      store.state = data.state;
      break;
    case 'SET_TAB_DATA':
      store.tab = data;
      break;
    case 'SET_BALANCE':
      store.balance = data.total;
      break;
    case 'SET_TRANSIENT_STATE':
      store.transientState = data;
      break;
    default:
      throw new Error('Unknown action');
  }
};

type Actions =
  | { type: 'SET_DATA_POPUP'; data: PopupState }
  | { type: 'TOGGLE_CONTINUOUS_PAYMENTS'; data?: never }
  | { type: 'TOGGLE_PAYMENTS'; data?: never }
  | { type: 'OPT_IN_OUT_TELEMETRY'; data: { isOptedIn: boolean } }
  | { type: 'SET_CONNECTED'; data: { connected: boolean } }
  | { type: 'UPDATE_RATE_OF_PAY'; data: { rateOfPay: AmountValue } }
  | {
      type: 'UPDATE_SITE_RATE_OF_PAY';
      data: { hostname: Host; rate: AmountValue | null };
    }
  | {
      type: 'SET_DATA_SITES_RATE_OF_PAY';
      data: { hostname: Host; rate: AmountValue }[];
    }
  | BackgroundToPopupMessage;
