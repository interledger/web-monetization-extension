import { fireEvent, render } from '@testing-library/react'
import React from 'react'

import { Radio, RadioGroup } from '../RadioGroup'

describe('RadioGroup', () => {
  const radioItems = [
    { label: 'Option 1', value: 'option1', checked: true },
    { label: 'Option 2', value: 'option2' },
  ]

  it('should have the `flex-row` class when the `inline` variant is passed', () => {
    const { queryByRole } = render(
      <RadioGroup variant="inline" items={radioItems} name="radioName" />,
    )

    expect(queryByRole('radiogroup')).toBeInTheDocument()
    expect(queryByRole('radiogroup')).toHaveClass('flex-row')
  })

  it('renders radio group correctly with items', () => {
    const { getByRole } = render(<RadioGroup items={radioItems} name="radioGroup" />)

    const radioGroup = getByRole('radiogroup')
    expect(radioGroup).toBeInTheDocument()
    expect(radioGroup.childNodes.length).toBe(2) // Ensure two radio buttons are rendered
  })

  it('renders radio group with no element checked by default', () => {
    const radioItemsNotChecked = [
      { label: 'Option 1', value: 'option1' },
      { label: 'Option 2', value: 'option2' },
    ]
    const { getByLabelText } = render(<RadioGroup items={radioItemsNotChecked} name="radioGroup" />)

    const firstRadioButton = getByLabelText('Option 1')
    const secondRadioButton = getByLabelText('Option 2')

    expect(firstRadioButton).not.toBeChecked()
    expect(secondRadioButton).not.toBeChecked()
  })

  it('handles keyboard navigation', () => {
    const { getByLabelText } = render(<RadioGroup items={radioItems} name="radioGroup" />)

    const radioGroup = getByLabelText('Option 1')
    fireEvent.keyDown(radioGroup, { key: 'ArrowRight', code: 'ArrowRight' })
    let secondRadioButton = getByLabelText('Option 2')
    expect(secondRadioButton).toBeChecked()

    fireEvent.keyDown(radioGroup, { key: 'ArrowLeft', code: 'ArrowLeft' })
    let firstRadioButton = getByLabelText('Option 1')
    expect(firstRadioButton).toBeChecked()

    fireEvent.keyDown(radioGroup, { key: 'ArrowUp', code: 'ArrowUp' })
    secondRadioButton = getByLabelText('Option 2')
    expect(secondRadioButton).toBeChecked()

    fireEvent.keyDown(radioGroup, { key: 'ArrowDown', code: 'ArrowDown' })
    firstRadioButton = getByLabelText('Option 1')
    expect(firstRadioButton).toBeChecked()
  })

  it('changes selection on arrow keys', () => {
    const { getByLabelText } = render(<RadioGroup items={radioItems} name="radioGroup" />)

    const radioGroup = getByLabelText('Option 1')
    fireEvent.keyDown(radioGroup, { key: 'ArrowRight', code: 'ArrowRight' })
    fireEvent.keyDown(radioGroup, { key: 'Enter', code: 'Enter' })
    const secondRadioButton = getByLabelText('Option 2')
    expect(secondRadioButton).toBeChecked()
  })

  it('changes selection on clicking radio buttons', () => {
    const { getByLabelText } = render(<RadioGroup items={radioItems} name="radioGroup" />)

    const secondRadioButton = getByLabelText('Option 2')
    fireEvent.click(secondRadioButton)
    expect(secondRadioButton).toBeChecked()
  })
})

describe('Radio', () => {
  it('renders radio button correctly with label', () => {
    const { getByLabelText } = render(<Radio label="Option 1" value="option1" name="radioGroup" />)

    const radioButton = getByLabelText('Option 1')
    expect(radioButton).toBeInTheDocument()
    expect(radioButton).toHaveAttribute('type', 'radio')
    expect(radioButton).not.toBeChecked()

    fireEvent.click(radioButton)
    expect(radioButton).toBeChecked()
  })

  it('renders disabled radio button', () => {
    const { getByLabelText } = render(
      <Radio label="Option 1" value="option1" name="radioGroup" disabled />,
    )

    const radioButton = getByLabelText('Option 1')
    expect(radioButton).toBeDisabled()
  })
})
