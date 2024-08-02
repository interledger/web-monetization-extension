import React from 'react'
import {
  PopupStateContext,
  ReducerActionType,
  useTranslation
} from '@/popup/lib/context'
import { WarningSign } from '@/popup/components/Icons'
import { Slider } from '../components/ui/Slider'
import { toggleWM, updateRateOfPay as updateRateOfPay_ } from '../lib/messages'
import { Label } from '../components/ui/Label'
import {
  formatNumber,
  getCurrencySymbol,
  roundWithPrecision
} from '../lib/utils'
import { PayWebsiteForm } from '../components/PayWebsiteForm'
import { SiteNotMonetized } from '@/popup/components/SiteNotMonetized'
import { debounceAsync } from '@/shared/helpers'
import { Switch } from '../components/ui/Switch'
import { WarningMessage } from '../components/WarningMessage'

const updateRateOfPay = debounceAsync(updateRateOfPay_, 1000)

export const Component = () => {
  const t = useTranslation()
  const {
    state: {
      enabled,
      isSiteMonetized,
      rateOfPay,
      minRateOfPay,
      maxRateOfPay,
      balance,
      walletAddress,
      url,
      hasAllSessionsInvalid
    },
    dispatch
  } = React.useContext(PopupStateContext)

  const rate = React.useMemo(() => {
    const r = Number(rateOfPay) / 10 ** walletAddress.assetScale
    const roundedR = roundWithPrecision(r, walletAddress.assetScale)

    return formatNumber(roundedR, walletAddress.assetScale, true)
  }, [rateOfPay, walletAddress.assetScale])

  const remainingBalance = React.useMemo(() => {
    const val = Number(balance) / 10 ** walletAddress.assetScale
    const rounded = roundWithPrecision(val, walletAddress.assetScale)
    return formatNumber(rounded, walletAddress.assetScale, true)
  }, [balance, walletAddress.assetScale])

  const onRateChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rateOfPay = event.currentTarget.value
    dispatch({
      type: ReducerActionType.UPDATE_RATE_OF_PAY,
      data: {
        rateOfPay
      }
    })
    const response = await updateRateOfPay({ rateOfPay })
    if (!response.success) {
      // TODO: Maybe reset to old state, but not while user is active (avoid
      // sluggishness in UI)
    }
  }

  const onChangeWM = () => {
    toggleWM()
    dispatch({ type: ReducerActionType.TOGGLE_WM, data: {} })
  }

  if (!isSiteMonetized) {
    return <SiteNotMonetized />
  }

  return (
    <div className="space-y-8">
      {hasAllSessionsInvalid && (
        <WarningMessage warning={t('home_warn_invalidLinks')} />
      )}
      {enabled ? (
        <div className="space-y-2">
          <Label className="px-2 text-base font-medium text-medium">
            Current rate of pay
          </Label>
          <Slider
            onChange={onRateChange}
            min={Number(minRateOfPay)}
            max={Number(maxRateOfPay)}
            step={Number(minRateOfPay)}
            value={Number(rateOfPay)}
          />
          <div className="flex w-full items-center justify-between px-2 tabular-nums">
            <span className="text-sm">
              {rate} {getCurrencySymbol(walletAddress.assetCode)} per hour
            </span>
            <span className="text-sm">
              Remaining balance: {getCurrencySymbol(walletAddress.assetCode)}
              {remainingBalance}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <WarningSign className="text-error" />
          <p className="text-base text-medium">
            Web Monetization has been turned off.
          </p>
        </div>
      )}
      <Switch
        checked={enabled}
        onChange={onChangeWM}
        label="Continuous payment stream"
      />

      <hr />

      {url ? <PayWebsiteForm /> : null}
    </div>
  )
}
