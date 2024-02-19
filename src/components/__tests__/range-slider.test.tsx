import { render, screen } from '@testing-library/react'
import React from 'react'

import RangeSlider from '../range-slider'

describe('RangeSlider Component', () => {
  it('renders with a title when provided', () => {
    render(<RangeSlider title="Test Slider" onChange={jest.fn()} />)
    expect(screen.getByText('Test Slider')).toBeInTheDocument()
  })

  it('does not render a title when none is provided', () => {
    render(<RangeSlider onChange={jest.fn()} />)

    expect(screen.queryByText('Test Slider')).toBeNull()
  })

  it('renders with correct default value', () => {
    render(<RangeSlider value={50} onChange={jest.fn()} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuenow', '50')
  })

  it('renders correctly with min and max values', () => {
    render(<RangeSlider min={10} max={90} onChange={jest.fn()} />)

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuemin', '10')
    expect(slider).toHaveAttribute('aria-valuemax', '90')
  })
})
