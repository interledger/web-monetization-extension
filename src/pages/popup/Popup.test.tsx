import { render, screen } from '@testing-library/react'

import Popup from '@/pages/popup/Popup'

describe('PopupTest', () => {
  test('render text', () => {
    const text = 'Web Monetization'

    render(<Popup />)

    screen.getByText(text)
  })
})
