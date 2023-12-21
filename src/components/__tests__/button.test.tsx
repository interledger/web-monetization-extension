import { render, screen } from '@testing-library/react'
import React from 'react'

import { Button } from '@/components/button'

describe('Rendering', () => {
  describe('Button', () => {
    it('should render a button', async () => {
      render(<Button aria-label="test button">My Button</Button>)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should default to `type="button"`', async () => {
      render(<Button aria-label="test-button">My Button</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })
  })
})
