import React from 'react'
import {
  getContextData,
  setContextData as setContextData_
} from '@/popup/lib/messages'
import { DeepNonNullable, PopupStore } from '@/shared/types'
import { debounceAsync } from '@/shared/helpers'

const setContextData = debounceAsync(setContextData_, 100)

export enum ReducerActionType {
  SET_DATA = 'SET_DATA',
  SET_PARTIAL_DATA = 'SET_PARTIAL_DATA',
  TOGGLE_WM = 'TOGGLE_WM',
  UPDATE_RATE_OF_PAY = 'UPDATE_RATE_OF_PAY'
}

export type PopupState = Required<DeepNonNullable<PopupStore>>

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

interface UpdateRateOfPayAction extends ReducerActionMock {
  type: ReducerActionType.UPDATE_RATE_OF_PAY
  data: {
    rateOfPay: string
  }
}

interface SetPartialDataAction extends ReducerActionMock {
  type: ReducerActionType.SET_PARTIAL_DATA
  data: {
    amountValue?: string
    walletAddressUrl?: string
    recurring?: boolean
  }
}

export type ReducerActions =
  | SetDataAction
  | ToggleWMAction
  | UpdateRateOfPayAction
  | SetPartialDataAction

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
    case ReducerActionType.UPDATE_RATE_OF_PAY: {
      return {
        ...state,
        rateOfPay: action.data.rateOfPay
      }
    }
    case ReducerActionType.SET_PARTIAL_DATA: {
      setContextData(action.data)

      return { ...state, ...action.data }
    }
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

  if (isLoading) {
    return <>Loading</>
  }

  return (
    <PopupStateContext.Provider value={{ state, dispatch }}>
      {children}
    </PopupStateContext.Provider>
  )
}
