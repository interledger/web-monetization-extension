import React from 'react'
import browser from 'webextension-polyfill'
import { WarningSign } from '@/popup/components/Icons'

export const SiteNotMonetized = () => {
  return (
    <div className="flex h-full items-center justify-center gap-2 p-4 text-lg">
      <div className="flex-shrink-0">
        <WarningSign className="size-6 text-medium" />
      </div>
      <h3 className="text-medium">
        {browser.i18n.getMessage('siteNotMonetized')}
      </h3>
    </div>
  )
}
