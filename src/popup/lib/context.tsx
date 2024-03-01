import { getContextData } from '@/popup/lib/messages'
import { Amount, Storage } from '@/utils/types'
import React from 'react'

export type PopupState = Omit<Storage, 'privateKey' | 'keyId' | 'exceptionList'> & {
  publicKey: string
  websiteAmount: Amount
}

export enum ReducerActionType {
  SET_DATA = 'SET_DATA',
}

export interface PopupContext {
  state: PopupState
  dispatch: React.Dispatch<ReducerActions>
}

interface ReducerAction {
  type: ReducerActionType
  data: any
}

interface SetDataAction extends ReducerAction {
  type: ReducerActionType.SET_DATA
  data: PopupState
}

export type ReducerActions = SetDataAction

export const PopupStateContext = React.createContext<PopupContext>({} as PopupContext)

const reducer = (state: PopupState, action: ReducerActions): PopupState => {
  switch (action.type) {
    case ReducerActionType.SET_DATA: {
      return action.data
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
    <PopupStateContext.Provider value={{ state, dispatch }}>{children}</PopupStateContext.Provider>
  )
}
