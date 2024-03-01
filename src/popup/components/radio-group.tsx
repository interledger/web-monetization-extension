import { type VariantProps, cva } from 'class-variance-authority'
import React, { useEffect, useMemo, useState } from 'react'

import { cn } from '@/utils/helpers'

export interface RadioProps {
  checked?: boolean
  label?: string
  value: string
  name: string
  id?: string
  disabled?: boolean
  onChange?: any
  noSelected?: boolean
}

export const Radio = ({
  label,
  id,
  name,
  value,
  disabled,
  onChange,
  checked,
  noSelected,
}: RadioProps): JSX.Element => {
  const inputId = id || `id-${name}-${value}`
  const divId = `div-${inputId}`

  useEffect(() => {
    if (checked) document.getElementById(divId)?.focus()
  }, [checked, divId])

  return (
    <div
      id={divId}
      className="flex items-center"
      tabIndex={noSelected ? 0 : checked ? 0 : -1}
      aria-checked={checked}
      role="radio">
      <input
        id={inputId}
        type="radio"
        disabled={disabled}
        value={value}
        name={name}
        className="hidden peer"
        onChange={onChange}
        checked={checked}
        aria-checked={checked}
      />

      <label htmlFor={inputId} className="group flex items-center">
        <span
          className={`w-6 h-6 inline-block rounded-full border-2 border-base
          peer-checked:group-[]:bg-primary
          peer-checked:group-[]:border-blue-500
          peer-checked:group-[]:ring-white
          peer-checked:group-[]:ring-inset
          peer-checked:group-[]:ring-4`}
        />
        {label ? <p className="text-base text-medium leading-6 ms-2">{label}</p> : ''}
      </label>
    </div>
  )
}

const radioGroupVariants = cva(['flex gap-3'], {
  variants: {
    variant: {
      default: 'flex-col',
      inline: 'flex-row',
    },
    fullWidth: {
      true: 'w-full',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface RadioGroupProps
  extends VariantProps<typeof radioGroupVariants>,
    React.InputHTMLAttributes<HTMLInputElement> {
  disabled?: boolean
  items: Omit<RadioProps, 'name'>[]
  name: string
  handleChange?: (value: string) => void
}

export const RadioGroup = ({
  items,
  variant,
  name,
  fullWidth,
  disabled,
  className,
  handleChange,
  value,
}: RadioGroupProps) => {
  const checkedItem = useMemo(
    () => items.findIndex(item => item.checked || item.value === value),
    [items, value],
  )
  const [selected, setSelected] = useState(checkedItem)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.code === 'ArrowRight' || event.code === 'ArrowDown') {
      event.preventDefault()

      const nextIndex = (selected >= 0 ? selected + 1 : 1) % items.length
      setSelected(nextIndex)
    } else if (event.code === 'ArrowLeft' || event.code === 'ArrowUp') {
      event.preventDefault()

      const prevIndex = selected > 0 ? selected - 1 : items.length - 1
      setSelected(prevIndex)
    }
  }

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (selected === -1 && (event.code === 'Enter' || event.code === 'Space')) {
        setSelected(0)
      }
    }

    document.addEventListener('keypress', handleKeyPress)
    return () => {
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [selected])

  return (
    <div
      tabIndex={-1}
      className={cn(radioGroupVariants({ variant, fullWidth }), className)}
      onKeyDown={handleKeyDown}
      role="radiogroup">
      {items.map((item, index) => (
        <Radio
          key={`key-${name}-${item.value}`}
          {...item}
          name={name}
          disabled={disabled}
          checked={selected === index}
          noSelected={selected === -1 && index === 0}
          onChange={() => {
            setSelected(index)
            if (handleChange) handleChange(item.value)
          }}
        />
      ))}
    </div>
  )
}
