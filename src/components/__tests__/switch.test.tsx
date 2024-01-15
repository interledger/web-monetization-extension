import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { Switch } from '@/components/switch'

describe('Switch', () => {
  it('renders without crashing', () => {
    render(<Switch />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('applies default classes', () => {
    render(<Switch />)
    const switchElement = screen.getByRole('checkbox').nextSibling
    expect(switchElement).toHaveClass('w-[42px] h-[26px] before:h-5 before:w-5')
  })

  it('applies small size classes when size prop is small', () => {
    render(<Switch size="small" />)
    const switchElement = screen.getByRole('checkbox').nextSibling
    expect(switchElement).toHaveClass('w-9 h-[22px] before:h-4 before:w-4 before:left-[3px]')
  })

  it('forwards ref to input element', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<Switch ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('forwards checked prop to input element', () => {
    render(<Switch checked />)
    const inputElement = screen.getByRole('checkbox')
    expect(inputElement).toBeChecked()
  })

  it('handles additional props', () => {
    render(<Switch aria-label="Custom Switch" />)
    const inputElement = screen.getByRole('checkbox')
    expect(inputElement).toHaveAttribute('aria-label', 'Custom Switch')
  })

  it('applies custom class names', () => {
    const customClass = 'custom-class'
    render(<Switch className={customClass} />)
    const switchElement = screen.getByRole('checkbox').nextSibling
    expect(switchElement).toHaveClass(customClass)
  })

  it('toggles switch state when clicked', () => {
    render(<Switch />)
    const inputElement = screen.getByRole('checkbox')
    expect(inputElement).not.toBeChecked()

    fireEvent.click(inputElement)
    expect(inputElement).toBeChecked()

    fireEvent.click(inputElement)
    expect(inputElement).not.toBeChecked()
  })

  it('handles additional HTML attributes', () => {
    const testId = 'switch-test'
    render(<Switch data-testid={testId} />)
    const switchElement = screen.getByTestId(testId)
    expect(switchElement).toBeInTheDocument()
  })
})
