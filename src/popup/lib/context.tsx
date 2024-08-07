import React, { type PropsWithChildren } from 'react'
import type { Browser } from 'webextension-polyfill'
import { getContextData } from '@/popup/lib/messages'
import { tFactory, type Translation } from '@/shared/helpers'
import type { DeepNonNullable, PopupStore } from '@/shared/types'
import {
  BACKGROUND_TO_POPUP_CONNECTION_NAME as CONNECTION_NAME,
  type BackgroundToPopupMessage
} from '@/shared/messages'

// #region PopupState
export enum ReducerActionType {
  SET_DATA = 'SET_DATA',
  TOGGLE_WM = 'TOGGLE_WM',
  SET_CONNECTED = 'SET_CONNECTED',
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

interface SetConnected extends ReducerActionMock {
  type: ReducerActionType.SET_CONNECTED
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
  | SetConnected
  | UpdateRateOfPayAction
  | BackgroundToPopupAction

export const PopupStateContext = React.createContext<PopupContext>(
  {} as PopupContext
)
export const usePopupState = () => React.useContext(PopupStateContext)

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
    case ReducerActionType.SET_CONNECTED:
      return { ...state, connected: action.data.value }
    case ReducerActionType.UPDATE_RATE_OF_PAY: {
      return {
        ...state,
        rateOfPay: action.data.rateOfPay
      }
    }
    case 'SET_STATE':
      return { ...state, state: action.data.state }
    case 'SET_IS_MONETIZED':
      return { ...state, isSiteMonetized: action.data }
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
  const browser = useBrowser()
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
    const port = browser.runtime.connect({ name: CONNECTION_NAME })
    port.onMessage.addListener((message: BackgroundToPopupMessage) => {
      switch (message.type) {
        case 'SET_BALANCE':
        case 'SET_STATE':
        case 'SET_IS_MONETIZED':
          return dispatch(message)
      }
    })
    port.onDisconnect.addListener(() => {
      // nothing to do
    })
    return () => {
      port.disconnect()
    }
  }, [browser])

  if (isLoading) {
    return <>Loading</>
  }

  return (
    <PopupStateContext.Provider value={{ state, dispatch }}>
      {children}
    </PopupStateContext.Provider>
  )
}
// #endregion

// #region Browser
const BrowserContext = React.createContext<Browser>({} as Browser)

export const BrowserContextProvider = ({
  browser,
  children
}: PropsWithChildren<{ browser: Browser }>) => {
  return (
    <BrowserContext.Provider value={browser}>
      {children}
    </BrowserContext.Provider>
  )
}

export const useBrowser = () => React.useContext(BrowserContext)
// #endregion

// #region Translation
const TranslationContext = React.createContext<Translation>((v: string) => v)

export const TranslationContextProvider = ({ children }: PropsWithChildren) => {
  const browser = useBrowser()
  const t = tFactory(browser)

  return (
    <TranslationContext.Provider value={t}>
      {children}
    </TranslationContext.Provider>
  )
}

export const useTranslation = () => React.useContext(TranslationContext)
// #endregion
