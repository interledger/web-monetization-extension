import { act, render, screen } from '@testing-library/react'
import React, { useContext } from 'react'

import { defaultData, PopupContext, PopupProvider } from '../popup.provider'

jest.mock('webextension-polyfill', () => ({
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
}))

const TestComponent = () => {
  const { data, setData } = useContext(PopupContext)

  return (
    <div>
      <div data-testid="amount">{data.amount}</div>
      <div data-testid="rateOfPay">{data.rateOfPay}</div>
      <button onClick={() => setData({ ...data, amount: 100 })}>Update Amount</button>
    </div>
  )
}

const MockChildComponent = () => {
  const { data } = useContext(PopupContext)
  return <div data-testid="mock-child">{data.amount}</div>
}

describe('PopupProvider', () => {
  it('provides the initial context values', () => {
    render(
      <PopupProvider>
        <TestComponent />
      </PopupProvider>,
    )

    expect(screen.getByTestId('amount').textContent).toBe('0')
    expect(screen.getByTestId('rateOfPay').textContent).toBe('0.36')
  })

  it('updates context values when setData is called', () => {
    render(
      <PopupProvider>
        <TestComponent />
      </PopupProvider>,
    )

    act(() => {
      screen.getByText('Update Amount').click()
    })

    expect(screen.getByTestId('amount').textContent).toBe('100')
  })

  it('displays different initial values correctly', () => {
    const customInitialData = {
      ...defaultData,
      amount: 50,
      rateOfPay: 0.45,
    }

    render(
      <PopupContext.Provider value={{ data: customInitialData, setData: () => {} }}>
        <TestComponent />
      </PopupContext.Provider>,
    )

    expect(screen.getByTestId('amount').textContent).toBe('50')
    expect(screen.getByTestId('rateOfPay').textContent).toBe('0.45')
  })

  it('handles multiple updates to context values', () => {
    render(
      <PopupProvider>
        <TestComponent />
      </PopupProvider>,
    )

    act(() => {
      screen.getByText('Update Amount').click()
      screen.getByText('Update Amount').click()
    })

    expect(screen.getByTestId('amount').textContent).toBe('100')
  })

  it('renders child component with context data', () => {
    render(
      <PopupProvider>
        <MockChildComponent />
      </PopupProvider>,
    )

    expect(screen.getByTestId('mock-child').textContent).toBe('0')
  })
})
