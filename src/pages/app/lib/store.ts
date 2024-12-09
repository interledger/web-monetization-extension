import { proxy, useSnapshot } from 'valtio';

export type AppState = {
  connected: boolean;
};

export const store = proxy<AppState>({} as AppState);

// easier than importing valtio and store (single import)
export const useAppState = () => useSnapshot(store);

export const dispatch = ({ type, data }: Actions) => {
  switch (type) {
    case 'SET_DATA': {
      for (const key of Object.keys(data) as Array<keyof AppState>) {
        store[key] = data[key];
      }
      break;
    }
    default:
      throw new Error('Unknown action');
  }
};

type Actions = { type: 'SET_DATA'; data: AppState };
