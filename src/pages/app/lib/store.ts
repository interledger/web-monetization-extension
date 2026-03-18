import type { AppStore, DeepNonNullable, TransientState } from '@/shared/types';
import { proxy, useSnapshot } from 'valtio';

export type AppState = Required<DeepNonNullable<AppStore>>;

const transientState = {
  connect: {
    type: 'failure',
    code: 'grant_invalid',
    intent: 'update_budget',
    retryPossible: 'auto',
    retryMessage: {
      action: 'UPDATE_BUDGET',
      payload: {
        amount: '8.40',
        recurring: true,
        walletAddressUrl: 'https://ilp.interledger-test.dev/sid',
      },
    },
  },
} as TransientState;

export const store = proxy<AppState>({
  transientState: transientState as TransientState,
} as AppState);

// easier access to the store via this hook
export const useAppState = () => useSnapshot(store);

export const dispatch = ({ type, data }: Actions) => {
  switch (type) {
    case 'SET_DATA_APP':
      for (const key of Object.keys(data) as Array<keyof AppState>) {
        // @ts-expect-error we know TypeScript
        store[key] = data[key];
      }
      store.transientState = transientState;
      break;
    case 'SET_TRANSIENT_STATE':
      store.transientState = transientState;
      break;
    case 'SET_CONSENT': {
      store.consent = data.consent;
      store.consentTelemetry = data.consentTelemetry;
      break;
    }
    default:
      throw new Error('Unknown action');
  }
};

type Actions =
  | { type: 'SET_TRANSIENT_STATE'; data: TransientState }
  | {
      type: 'SET_CONSENT';
      data: {
        consent: NonNullable<AppStore['consent']>;
        consentTelemetry: Required<NonNullable<AppStore['consentTelemetry']>>;
      };
    }
  | {
      type: 'SET_DATA_APP';
      data: Pick<AppStore, 'connected' | 'publicKey' | 'consentTelemetry'>;
    };
