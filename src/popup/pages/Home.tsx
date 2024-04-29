import React from 'react'
import { PopupStateContext, ReducerActionType } from '@/popup/lib/context'
import { WarningSign } from '@/popup/components/Icons'
import { Slider } from '../components/ui/Slider'
import { updateRateOfPay } from '../lib/messages'
import { Label } from '../components/ui/Label'
import { getCurrencySymbol, roundWithPrecision } from '../lib/utils'
import { PayWebsiteForm } from '../components/PayWebsiteForm'

export const Component = () => {
  const {
    state: {
      enabled,
      rateOfPay,
      minRateOfPay,
      maxRateOfPay,
      walletAddress,
      url
    },
    dispatch
  } = React.useContext(PopupStateContext)

  const rate = React.useMemo(() => {
    const r = Number(rateOfPay) / 10 ** walletAddress.assetScale
    if (roundWithPrecision(r, 2) > 0) {
      return r.toFixed(2)
    }

    return r.toExponential()
  }, [rateOfPay, walletAddress.assetScale])

  // TODO: Use a debounce
  const onRateChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rateOfPay = event.currentTarget.value
    const response = await updateRateOfPay({
      rateOfPay
    })
    if (!response.success) return
    dispatch({
      type: ReducerActionType.UPDATE_RATE_OF_PAY,
      data: {
        rateOfPay
      }
    })
  }

  return (
    <div className="space-y-4">
      {!enabled ? (
        <div className="flex items-center gap-2">
          <WarningSign />
          <p className="text-base text-medium">
            Web Monetization has been turned off.
          </p>
        </div>
      ) : (
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
          <div className="flex w-full items-center justify-between px-2">
            <span className="text-sm">
              {rate} {getCurrencySymbol(walletAddress.assetCode)} per hour test
            </span>
          </div>
        </div>
      )}
      {url ? <PayWebsiteForm /> : null}
    </div>
  )
}
