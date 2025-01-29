import type { AppStore, PopupTransientState } from '@/shared/types';
import { proxy, useSnapshot } from 'valtio';

export const store = proxy<AppStore>({
  transientState: {} as PopupTransientState,
} as AppStore);

// easier access to the store via this hook
export const useAppState = () => useSnapshot(store);

export const dispatch = async ({ type, data }: Actions) => {
  switch (type) {
    case 'SET_DATA_APP':
      store.publicKey = data.publicKey;
      break;
    case 'SET_TRANSIENT_STATE':
      store.transientState = data;
      break;
    default:
      throw new Error('Unknown action');
  }
};

type Actions =
  | { type: 'SET_TRANSIENT_STATE'; data: PopupTransientState }
  | { type: 'SET_DATA_APP'; data: Pick<Storage, 'publicKey'> };
