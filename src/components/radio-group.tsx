import { type VariantProps, cva } from 'class-variance-authority'
import React, { useEffect, useMemo, useState } from 'react'

import { cn } from '@/utils/cn'

export interface RadioProps {
  checked?: boolean
  label?: string
  value: string
  name: string
  id?: string
  disabled?: boolean
  onChange?: any
}

export const Radio = ({
  label,
  id,
  name,
  value,
  disabled,
  onChange,
  checked,
}: RadioProps): JSX.Element => {
  const inputId = id || `id-${name}-${value}`

  return (
    <div className="flex items-center">
      <input
        id={inputId}
        type="radio"
        disabled={disabled}
        value={value}
        name={name}
        className="hidden"
        onChange={onChange}
        checked={checked}
      />

      <label htmlFor={inputId} className="flex items-center">
        <span className="w-6 h-6 inline-block rounded-full border-2 border-base" />
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
}

export const RadioGroup = ({
  items,
  variant,
  name,
  fullWidth,
  disabled,
  className,
}: RadioGroupProps) => {
  const checkedItem = useMemo(() => items.findIndex(item => item.checked), [items])
  const [selected, setSelected] = useState(checkedItem)

  const handleKeyDown = (event: any) => {
    if (event.code === 'ArrowRight' || event.code === 'ArrowDown') {
      event.preventDefault()

      const nextIndex = (selected + 1) % items.length
      setSelected(nextIndex)
    } else if (event.code === 'ArrowLeft' || event.code === 'ArrowUp') {
      event.preventDefault()

      const prevIndex = selected > 0 ? selected - 1 : items.length - 1
      setSelected(prevIndex)
    }
  }

  useEffect(() => {
    const handleKeyPress = (event: any) => {
      if (event.target.type === 'radio' && event.key === 'Enter') {
        setSelected(Number(event.target.value))
      }
    }

    document.addEventListener('keypress', handleKeyPress)
    return () => {
      document.removeEventListener('keypress', handleKeyPress)
    }
  }, [])

  return (
    //eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      tabIndex={0}
      className={cn(radioGroupVariants({ variant, fullWidth }), className, 'outline-none')}
      onKeyDown={handleKeyDown}
      role="tabpanel">
      {items.map((item, index) => (
        <Radio
          key={`key-${name}-${item.value}`}
          {...item}
          name={name}
          disabled={disabled}
          checked={selected === index}
          onChange={() => setSelected(index)}
        />
      ))}
    </div>
  )
}
