import { render, screen } from '@testing-library/react'
import React from 'react'

import { queryActiveTab, sendTabsMessage } from '@/lib/messageUtils'
import Popup from '@/pages/popup/Popup'

// Mock queryActiveTab and sendTabsMessage functions
jest.mock('@/lib/messageUtils', () => ({
  queryActiveTab: jest.fn(),
  sendTabsMessage: jest.fn(),
}))

describe('Popup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly', () => {
    render(<Popup />)

    // Check if the logo is rendered
    const logoImage = screen.getByAltText('Web Monetization Logo')
    expect(logoImage).toBeInTheDocument()

    // Check if the close button is rendered
    const closeButton = screen.getByAltText('Close')
    expect(closeButton).toBeInTheDocument()

    // Check if the text content is rendered
    const contentText = screen.getByText("This site isn't Web Monetization ready")
    expect(contentText).toBeInTheDocument()
  })

  it('calls queryActiveTab and sendTabsMessage on mount', () => {
    // Mock queryActiveTab to simulate the behavior of a tab being found
    // eslint-disable-next-line
    ;(queryActiveTab as jest.Mock).mockImplementation(callback => {
      callback({ id: 123 }) // Simulate that an active tab is found
    })

    // Mock sendTabsMessage to simulate callback behavior
    ;(sendTabsMessage as jest.Mock).mockImplementation((message, tabId, callback) => {
      // Call the callback directly with the mock response
      callback(true) // Simulate that the site is Web Monetization ready
    })

    render(<Popup />)

    // Check if queryActiveTab is called
    expect(queryActiveTab).toHaveBeenCalled()

    // Check if sendTabsMessage is called with the correct arguments
    expect(sendTabsMessage).toHaveBeenCalledWith(
      { action: 'GET_MONETIZATION' },
      123, // Simulated tab ID
      expect.any(Function),
    )

    // Check if the content text changes based on the mock response
    const contentText = screen.getByText('This site is Web Monetization ready')
    expect(contentText).toBeInTheDocument()
  })
})
