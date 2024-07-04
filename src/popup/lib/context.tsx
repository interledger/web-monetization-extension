import React from 'react'
import browser from 'webextension-polyfill'
import { getContextData } from '@/popup/lib/messages'
import { DeepNonNullable, PopupStore } from '@/shared/types'
import {
  ContentToBackgroundAction,
  type ContentToBackgroundMessage
} from '@/shared/messages'
import {
  BACKGROUND_TO_POPUP_CONNECTION_NAME as CONNECTION_NAME,
  type BackgroundToPopupMessage
} from '@/shared/messages'

export enum ReducerActionType {
  SET_DATA = 'SET_DATA',
  TOGGLE_WM = 'TOGGLE_WM',
  SET_IS_SITE_MONETIZED = 'SET_IS_TAB_MONETIZED',
  UPDATE_RATE_OF_PAY = 'UPDATE_RATE_OF_PAY'
}

export type PopupState = Required<
  DeepNonNullable<Omit<PopupStore, 'state'>> & Pick<PopupStore, 'state'>
>

export interface PopupContext {
  state: Required<NonNullable<PopupState>>
  dispatch: React.Dispatch<ReducerActions>
}

interface ReducerActionMock {
  type: ReducerActionType
  data?: any
}

interface SetDataAction extends ReducerActionMock {
  type: ReducerActionType.SET_DATA
  data: PopupState
}

interface ToggleWMAction extends ReducerActionMock {
  type: ReducerActionType.TOGGLE_WM
}

interface SetIsSiteMonetized extends ReducerActionMock {
  type: ReducerActionType.SET_IS_SITE_MONETIZED
  data: {
    value: boolean
  }
}

interface UpdateRateOfPayAction extends ReducerActionMock {
  type: ReducerActionType.UPDATE_RATE_OF_PAY
  data: {
    rateOfPay: string
  }
}

type BackgroundToPopupAction = BackgroundToPopupMessage

export type ReducerActions =
  | SetDataAction
  | ToggleWMAction
  | SetIsSiteMonetized
  | UpdateRateOfPayAction
  | BackgroundToPopupAction

export const PopupStateContext = React.createContext<PopupContext>(
  {} as PopupContext
)

const reducer = (state: PopupState, action: ReducerActions): PopupState => {
  switch (action.type) {
    case ReducerActionType.SET_DATA: {
      return action.data
    }
    case ReducerActionType.TOGGLE_WM: {
      return {
        ...state,
        enabled: !state.enabled
      }
    }
    case ReducerActionType.SET_IS_SITE_MONETIZED:
      return { ...state, isSiteMonetized: action.data.value }
    case ReducerActionType.UPDATE_RATE_OF_PAY: {
      return {
        ...state,
        rateOfPay: action.data.rateOfPay
      }
    }
    case 'SET_STATE':
      return { ...state, state: action.data.state }
    case 'SET_BALANCE':
      return { ...state, balance: action.data.total }
    default:
      return state
  }
}

interface PopupContextProviderProps {
  children: React.ReactNode
}

export function PopupContextProvider({ children }: PopupContextProviderProps) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [state, dispatch] = React.useReducer(reducer, {} as PopupState)

  React.useEffect(() => {
    async function get() {
      const response = await getContextData()

      if (response.success) {
        dispatch({ type: ReducerActionType.SET_DATA, data: response.payload })
        setIsLoading(false)
      }
    }

    get()
  }, [])

  React.useEffect(() => {
    type Listener = Parameters<typeof browser.runtime.onMessage.addListener>[0]
    const listener: Listener = (message: ContentToBackgroundMessage) => {
      if (message.action === ContentToBackgroundAction.IS_TAB_MONETIZED) {
        dispatch({
          type: ReducerActionType.SET_IS_SITE_MONETIZED,
          data: message.payload
        })
      }
    }

    browser.runtime.onMessage.addListener(listener)
    return () => {
      browser.runtime.onMessage.removeListener(listener)
    }
  }, [])

  React.useEffect(() => {
    const port = browser.runtime.connect({ name: CONNECTION_NAME })
    port.onMessage.addListener((message: BackgroundToPopupMessage) => {
      switch (message.type) {
        case 'SET_BALANCE':
        case 'SET_STATE':
          return dispatch(message)
      }
    })
    port.onDisconnect.addListener(() => {
      // nothing to do
    })
    return () => {
      port.disconnect()
    }
  }, [dispatch])

  if (isLoading) {
    return <>Loading</>
  }

  return (
    <PopupStateContext.Provider value={{ state, dispatch }}>
      {children}
    </PopupStateContext.Provider>
  )
}
