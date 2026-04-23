import React from 'react';
import { SwitchButton } from '@/pages/shared/components/ui/Switch';
import { InputAmountMemoized as InputAmount } from '@/pages/shared/components/InputAmount';
import { debounceAsync } from '@/shared/helpers';
import { formatNumber, roundWithPrecision } from '@/pages/shared/lib/utils';
import { useMessage, useTelemetry, useTranslation } from '@/popup/lib/context';
import { dispatch, usePopupState, type PopupState } from '@/popup/lib/store';
import type { AmountValue } from '@/shared/types';

export const RateOfPayScreen = () => {
  const message = useMessage();
  const telemetry = useTelemetry();

  const updateRateOfPay = React.useRef(
    debounceAsync(async (rateOfPay: AmountValue) => {
      const response = await message.send('UPDATE_RATE_OF_PAY', { rateOfPay });
      if (!response.success) {
        // TODO: Maybe reset to old state, but not while user is active (avoid
        // sluggishness in UI)
      }
      telemetry.capture('rate_of_pay_change');
    }, 1000),
  );

  const onRateChange = async (rateOfPay: AmountValue) => {
    dispatch({ type: 'UPDATE_RATE_OF_PAY', data: { rateOfPay } });
    void updateRateOfPay.current(rateOfPay);
  };

  const toggleContinuousPayments = (continuousPaymentsEnabled: boolean) => {
    message.send('TOGGLE_CONTINUOUS_PAYMENTS');
    dispatch({ type: 'TOGGLE_CONTINUOUS_PAYMENTS' });
    telemetry.register({ continuousPaymentsEnabled });
    telemetry.capture('toggle_continuous_payments', {
      enabled: continuousPaymentsEnabled,
    });
  };

  return (
    <RateOfPayComponent
      onRateChange={onRateChange}
      toggle={toggleContinuousPayments}
    />
  );
};

interface Props {
  onRateChange: (rate: AmountValue) => Promise<void>;
  toggle: (nowEnabled: boolean) => void | Promise<void>;
}

export const RateOfPayComponent = ({ onRateChange, toggle }: Props) => {
  const { continuousPaymentsEnabled, rateOfPay, maxRateOfPay, walletAddress } =
    usePopupState();
  return (
    <div className="space-y-8">
      <RateOfPayInput
        onRateChange={onRateChange}
        rateOfPay={rateOfPay}
        maxRateOfPay={maxRateOfPay}
        walletAddress={walletAddress}
        disabled={!continuousPaymentsEnabled}
      />

      <div className="space-y-2">
        <label
          htmlFor="continuous-payments-toggle"
          className="flex items-center gap-x-4 px-2 @sm:mt-7"
        >
          <span className="font-medium text-medium @sm:font-normal flex-grow @sm:flex-grow-0 @sm:order-last">
            Continuous payment
          </span>
          <SwitchButton
            id="continuous-payments-toggle"
            data-testid="continuous-payments-toggle"
            size="small"
            checked={continuousPaymentsEnabled}
            onChange={(e) => toggle(e.currentTarget.checked)}
          />
        </label>

        {!continuousPaymentsEnabled ? (
          <p className="text-weak">
            Ongoing payments are now disabled. You can still make one time
            payments.
          </p>
        ) : (
          <p className="text-weak" />
        )}
      </div>
    </div>
  );
};

type RateOfPayInputProps = {
  onRateChange: Props['onRateChange'];
  walletAddress: PopupState['walletAddress'];
  rateOfPay: PopupState['rateOfPay'];
  maxRateOfPay: PopupState['maxRateOfPay'];
  disabled?: boolean;
};

const RateOfPayInput = ({
  onRateChange,
  walletAddress,
  rateOfPay,
  maxRateOfPay,
  disabled,
}: RateOfPayInputProps) => {
  const t = useTranslation();
  const [errorMessage, setErrorMessage] = React.useState('');

  const formatAmount = React.useMemo(
    () => (value: number | string) => {
      const r = Number(value) / 10 ** walletAddress.assetScale;
      const roundedR = roundWithPrecision(r, walletAddress.assetScale);

      return formatNumber(roundedR, walletAddress.assetScale, true);
    },
    [walletAddress.assetScale],
  );

  return (
    <InputAmount
      id="rateOfPay"
      className="@sm:max-w-48"
      label="Rate of pay per hour"
      walletAddress={walletAddress}
      onChange={(value) => {
        setErrorMessage('');
        const rate = Number(value) * 10 ** walletAddress.assetScale;
        onRateChange(Math.round(rate).toString());
      }}
      onError={(error) => setErrorMessage(t(error))}
      errorMessage={errorMessage}
      min={Number(formatAmount(1))}
      max={Number(formatAmount(maxRateOfPay))}
      amount={formatAmount(rateOfPay)}
      controls={true}
      readOnly={disabled}
    />
  );
};
