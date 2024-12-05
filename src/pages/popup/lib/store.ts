import { proxy, useSnapshot } from 'valtio';
import type { DeepNonNullable, PopupStore } from '@/shared/types';
import type { BackgroundToPopupMessage } from '@/shared/messages';

export type PopupState = Required<
  DeepNonNullable<Omit<PopupStore, 'state'>> & Pick<PopupStore, 'state'>
>;

export const store = proxy<PopupState>({} as PopupState);

// easier than importing valtio and store (single import)
export const usePopupState = () => useSnapshot(store);

// This exists so we don't have to update all dispatch calls everywhere. Also
// keeps all actions together. Can move to better strategies in future.
export const dispatch = ({ type, data }: ReducerActions) => {
  switch (type) {
    case 'SET_DATA': {
      for (const key of Object.keys(data) as Array<keyof PopupState>) {
        // @ts-expect-error we know TypeScript
        store[key] = data[key];
      }
      break;
    }
    case 'TOGGLE_WM': {
      return TOGGLE_WM(data);
    }
    case 'SET_CONNECTED':
      return SET_CONNECTED(data);
    case 'UPDATE_RATE_OF_PAY':
      return UPDATE_RATE_OF_PAY(data);
    case 'SET_STATE':
      return SET_STATE(data);
    case 'SET_TAB_DATA':
      return SET_TAB_DATA(data);
    case 'SET_BALANCE':
      return SET_BALANCE(data);
    case 'SET_TRANSIENT_STATE':
      return SET_TRANSIENT_STATE(data);
    default:
      throw new Error('Unknown action');
  }
};

interface ReducerActionMock {
  type: string;
  data?: any;
}

interface SetDataAction extends ReducerActionMock {
  type: 'SET_DATA';
  data: PopupState;
}

interface ToggleWMAction extends ReducerActionMock {
  type: 'TOGGLE_WM';
}

interface SetConnected extends ReducerActionMock {
  type: 'SET_CONNECTED';
  data: { connected: boolean };
}

interface UpdateRateOfPayAction extends ReducerActionMock {
  type: 'UPDATE_RATE_OF_PAY';
  data: { rateOfPay: string };
}

type BackgroundToPopupAction = BackgroundToPopupMessage;

export type ReducerActions =
  | SetDataAction
  | ToggleWMAction
  | SetConnected
  | UpdateRateOfPayAction
  | BackgroundToPopupAction;

type ActionMap = {
  [T in ReducerActions['type']]: Extract<ReducerActions, { type: T }>['data'];
};

const TOGGLE_WM: ActionMap['TOGGLE_WM'] = () => {
  store.continuousPaymentsEnabled = !store.continuousPaymentsEnabled;
};

const SET_CONNECTED = (data: ActionMap['SET_CONNECTED']) => {
  store.connected = data.connected;
};

const UPDATE_RATE_OF_PAY = (data: ActionMap['UPDATE_RATE_OF_PAY']) => {
  store.rateOfPay = data.rateOfPay;
};

const SET_STATE = (data: ActionMap['SET_STATE']) => {
  store.state = data.state;
};

const SET_TAB_DATA = (data: ActionMap['SET_TAB_DATA']) => {
  store.tab = data;
};

const SET_BALANCE = (data: ActionMap['SET_BALANCE']) => {
  store.balance = data.total;
};

const SET_TRANSIENT_STATE = (data: ActionMap['SET_TRANSIENT_STATE']) => {
  store.transientState = data;
};
