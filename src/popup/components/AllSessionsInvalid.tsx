import React from 'react'
import { WarningSign } from '@/popup/components/Icons'
import { useTranslation } from '@/popup/lib/context'

export const AllSessionsInvalid = () => {
  const t = useTranslation()
  return (
    <div className="flex flex-col h-full items-center justify-center gap-1 p-1 text-lg">
      <div className="flex-shrink-0">
        <WarningSign className="size-10 text-medium" />
      </div>
      <h3 className="text-medium">{t('allInvalidLinks_state_text')}</h3>
    </div>
  )
}
