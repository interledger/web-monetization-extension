import { render } from '@testing-library/react'
import React from 'react'

import { Input } from '@/components/input'

describe('Input', () => {
  it('should render an input with the `aria-label` attribute', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" />)

    expect(queryByLabelText('test input')).toBeInTheDocument()
    expect(queryByLabelText('test input')).toHaveAttribute('aria-label', 'test input')
  })

  it('should default to `type="text"`', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" />)

    expect(queryByLabelText('test input')).toBeInTheDocument()
    expect(queryByLabelText('test input')).toHaveAttribute('type', 'text')
  })

  it('should not have the `disabled` attribute and `aria-disabled="false"` if `loading` is false', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" />)

    expect(queryByLabelText('test input')).toBeInTheDocument()
    expect(queryByLabelText('test input')).not.toHaveAttribute('disabled')
    expect(queryByLabelText('test input')).toHaveAttribute('aria-disabled', 'false')
    expect(queryByLabelText('test input')).not.toBeDisabled()
  })

  it('should have the `disabled` and `aria-disabled="true"` attributes if `loading` is true', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" loading />)

    expect(queryByLabelText('test input')).toBeInTheDocument()
    expect(queryByLabelText('test input')).toHaveAttribute('disabled')
    expect(queryByLabelText('test input')).toHaveAttribute('aria-disabled', 'true')
    expect(queryByLabelText('test input')).toBeDisabled()
  })

  it('should have the `border-base` class by default', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" />)

    expect(queryByLabelText('test input')).toBeInTheDocument()
    expect(queryByLabelText('test input')).toHaveClass('border-base')
  })

  it('should have the `border-error` class when an error message is passed', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" error />)

    expect(queryByLabelText('test input')).toBeInTheDocument()
    expect(queryByLabelText('test input')).toHaveClass('border-error')
  })

  it('should have the `text-transparent` class when the `loading` variant is passed', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" loading />)

    expect(queryByLabelText('test input')).toBeInTheDocument()
    expect(queryByLabelText('test input')).toHaveClass('text-transparent')
  })

  it('should have the `pl-12` class when the `icon` variant is passed', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" icon={<div />} />)

    expect(queryByLabelText('test input')).toBeInTheDocument()
    expect(queryByLabelText('test input')).toHaveClass('pl-12')
  })

  it('should have the `bg-disabled` and `border-transparent` classes when the `disabled` variant is passed', () => {
    const { queryByLabelText } = render(<Input aria-label="test input" disabled />)

    expect(queryByLabelText('test input')).toBeInTheDocument()
    expect(queryByLabelText('test input')).toHaveClass('bg-disabled')
    expect(queryByLabelText('test input')).toHaveClass('border-transparent')
  })
})
