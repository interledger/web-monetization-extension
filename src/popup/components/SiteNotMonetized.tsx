import React from 'react'
import { WarningSign } from '@/popup/components/Icons'
import { useTranslation } from '@/popup/lib/context'

export const SiteNotMonetized = () => {
  const t = useTranslation()
  return (
    <div className="flex h-full items-center justify-center gap-2 p-4 text-lg">
      <div className="flex-shrink-0">
        <WarningSign className="size-6 text-medium" />
      </div>
      <h3 className="text-medium">{t('siteNotMonetized_state_text')}</h3>
    </div>
  )
}
