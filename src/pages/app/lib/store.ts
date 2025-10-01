import type {
  AppStore,
  DeepNonNullable,
  PopupTransientState,
} from '@/shared/types';
import { proxy, useSnapshot } from 'valtio';

export type AppState = Required<DeepNonNullable<AppStore>>;

export const store = proxy<AppState>({
  transientState: {} as PopupTransientState,
} as AppState);

// easier access to the store via this hook
export const useAppState = () => useSnapshot(store);

export const dispatch = async ({ type, data }: Actions) => {
  switch (type) {
    case 'SET_DATA_APP':
      for (const key of Object.keys(data) as Array<keyof AppState>) {
        // @ts-expect-error we know TypeScript
        store[key] = data[key];
      }
      break;
    case 'SET_TRANSIENT_STATE':
      store.transientState = data;
      break;
    case 'SET_CONSENT':
      store.consent = data;
      break;
    default:
      throw new Error('Unknown action');
  }
};

type Actions =
  | { type: 'SET_TRANSIENT_STATE'; data: PopupTransientState }
  | { type: 'SET_CONSENT'; data: NonNullable<AppStore['consent']> }
  | { type: 'SET_DATA_APP'; data: Pick<AppStore, 'connected' | 'publicKey'> };
