import { fireEvent, render } from '@testing-library/react'
import React from 'react'

import { Code } from '../code'

describe('Code', () => {
  it('should render the code component', () => {
    const { queryByRole, container } = render(<Code value="test" />)
    const code = container.querySelector('code')

    expect(code).toBeInTheDocument()
    expect(code).toHaveTextContent('test')
    expect(queryByRole('button')).toHaveAttribute('aria-label', 'copy')
  })

  it('calls clipboard.writeText with the correct value', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(),
      },
    })

    const { getByRole } = render(<Code value="test" />)
    const copyButton = getByRole('button')
    expect(copyButton).toBeInTheDocument()

    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test')
  })
})
