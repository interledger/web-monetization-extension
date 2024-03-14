import React from 'react'
import { PopupStateContext } from '@/popup/lib/context'
import { WarningSign } from '@/popup/components/Icons'
import { PayWebsiteForm } from '@/popup/components/PayWebsiteForm'

export const Component = () => {
  const {
    state: { enabled, website }
  } = React.useContext(PopupStateContext)

  if (!enabled) {
    return (
      <div className="flex items-center gap-2">
        <WarningSign />
        <p className="text-base text-medium">
          Web Monetization has been turned off.
        </p>
      </div>
    )
  }

  if (website.url === '') {
    return (
      <div className="flex items-center gap-2">
        <WarningSign />
        <p className="text-base text-medium">
          This website does not support Web Monetization.
        </p>
      </div>
    )
  }

  return <PayWebsiteForm />
  // const {
  //   data: { wmEnabled, rateOfPay, amount, amountType },
  //   setData,
  // } = usePopup()
  // const [tipAmount, setTipAmount] = useState('')
  // const updateRateOfPay = async (event: any) => {
  //   setData(prevState => ({ ...prevState, rateOfPay: event.target.value }))
  // }
  // const updateStreamType = async (event: any) => {
  //   setData(prevState => ({
  //     ...prevState,
  //     amountType: { ...prevState.amountType, recurring: event.target.checked },
  //   }))
  // }
  // if (!wmEnabled) {
  //   return (
  //     <div className="flex items-center gap-2">
  //       <WarningSign />
  //       <p className="text-base text-medium">Web Monetization has been turned off.</p>
  //     </div>
  //   )
  // }
  // return (
  //   <div className="flex flex-col gap-8 basis-auto justify-center">
  //     <div className="grid gap-4 w-full">
  //       <div className="px-2 text-base font-medium text-medium">Current rate of pay</div>
  //       <Slider
  //         min={0}
  //         max={1}
  //         step={0.01}
  //         value={rateOfPay}
  //         onChange={updateRateOfPay}
  //         disabled={!amountType.recurring}
  //       />
  //       <div className="px-2 flex items-center justify-between w-full">
  //         <span>{!amountType.recurring ? '0c' : formatCurrency(rateOfPay)} per hour</span>
  //         <span>Remaining balance: ${amount}</span>
  //       </div>
  //     </div>
  //     <div className="flex items-center gap-4 h-7">
  //       <Switch size="small" checked={amountType.recurring} onChange={updateStreamType} />
  //       <span className="text-medium text-base">Continuous payments stream</span>
  //     </div>
  //     <div className="h-px bg-nav-active" />
  //     <div className="flex flex-col gap-4">
  //       <Label className="text-base font-medium	text-medium">
  //         Pay <span className="text-primary">https://alexlakatos.com/</span>
  //       </Label>
  //       <Input
  //         value={tipAmount}
  //         type="number"
  //         id="amount"
  //         name="amount"
  //         placeholder="0.00"
  //         onChange={event => setTipAmount(event.target.value)}
  //         icon={<DollarSign />}
  //       />
  //     </div>
  //     <Button aria-label="Send now" className="text-base font-medium">
  //       Send now
  //     </Button>
  //   </div>
  // )
}
