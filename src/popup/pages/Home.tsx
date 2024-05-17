import React from 'react'
import { PopupStateContext, ReducerActionType } from '@/popup/lib/context'
import { WarningSign } from '@/popup/components/Icons'
import { Slider } from '../components/ui/Slider'
import { updateRateOfPay as updateRateOfPay_ } from '../lib/messages'
import { Label } from '../components/ui/Label'
import { getCurrencySymbol, roundWithPrecision } from '../lib/utils'
import { debounceAsync } from '@/shared/helpers'
import { PayWebsiteForm } from '../components/PayWebsiteForm'

const updateRateOfPay = debounceAsync(updateRateOfPay_, 500);

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
      // TODO: Maybe reset to old state, but not while user is active (avoid jank)
    }
  }

  return (
    <div className="space-y-8">
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
          <div className="flex w-full items-center justify-between px-2">
            <span className="text-sm">
              {rate} {getCurrencySymbol(walletAddress.assetCode)} per hour test
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <WarningSign />
          <p className="text-base text-medium">
            Web Monetization has been turned off.
          </p>
        </div>
      )}

      <hr />

      {url ? <PayWebsiteForm /> : null}
    </div>
  )
}
