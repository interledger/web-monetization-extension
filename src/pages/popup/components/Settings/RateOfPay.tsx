import React from 'react';
import { Switch } from '@/pages/shared/components/ui/Switch';
import { InputAmountMemoized as InputAmount } from '@/pages/shared/components/InputAmount';
import { debounceAsync } from '@/shared/helpers';
import { formatNumber, roundWithPrecision } from '@/pages/shared/lib/utils';
import { useMessage, useTranslation } from '@/popup/lib/context';
import { dispatch, usePopupState, type PopupState } from '@/popup/lib/store';

export const RateOfPayScreen = () => {
  const message = useMessage();

  const updateRateOfPay = React.useRef(
    debounceAsync(async (rateOfPay: string) => {
      const response = await message.send('UPDATE_RATE_OF_PAY', { rateOfPay });
      if (!response.success) {
        // TODO: Maybe reset to old state, but not while user is active (avoid
        // sluggishness in UI)
      }
    }, 1000),
  );

  const onRateChange = (rateOfPay: string) => {
    dispatch({ type: 'UPDATE_RATE_OF_PAY', data: { rateOfPay } });
    void updateRateOfPay.current(rateOfPay);
  };

  const toggleContinuousPayments = () => {
    message.send('TOGGLE_CONTINUOUS_PAYMENTS');
    dispatch({ type: 'TOGGLE_CONTINUOUS_PAYMENTS' });
  };

  return (
    <RateOfPayComponent
      onRateChange={onRateChange}
      toggle={toggleContinuousPayments}
    />
  );
};

interface Props {
  onRateChange: (rate: string) => void;
  toggle: () => void | Promise<void>;
}

export const RateOfPayComponent = ({ onRateChange, toggle }: Props) => {
  const {
    continuousPaymentsEnabled,
    rateOfPay,
    minRateOfPay,
    maxRateOfPay,
    walletAddress,
  } = usePopupState();
  return (
    <div className="space-y-8">
      <RateOfPayInput
        onRateChange={onRateChange}
        rateOfPay={rateOfPay}
        minRateOfPay={minRateOfPay}
        maxRateOfPay={maxRateOfPay}
        walletAddress={walletAddress}
        disabled={!continuousPaymentsEnabled}
      />

      <div className="space-y-2">
        <Switch
          checked={continuousPaymentsEnabled}
          onChange={toggle}
          label="Continuous payment"
          data-testid="continuous-payments-toggle"
        />

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
  minRateOfPay: PopupState['minRateOfPay'];
  maxRateOfPay: PopupState['maxRateOfPay'];
  disabled?: boolean;
};

const RateOfPayInput = ({
  onRateChange,
  walletAddress,
  rateOfPay,
  minRateOfPay,
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
    <>
      <InputAmount
        id="rateOfPay"
        className="max-w-56"
        wrapperClassName="w-fit"
        label="Rate of pay per hour"
        walletAddress={walletAddress}
        onChange={(value) => {
          setErrorMessage('');
          const rate = Number(value) * 10 ** walletAddress.assetScale;
          onRateChange(rate.toString());
        }}
        onError={(error) => setErrorMessage(t(error))}
        errorMessage={errorMessage}
        min={Number(formatAmount(minRateOfPay))}
        max={Number(formatAmount(maxRateOfPay))}
        amount={formatAmount(rateOfPay)}
        controls={true}
        readOnly={disabled}
      />
    </>
  );
};
