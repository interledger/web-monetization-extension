import React from 'react';
import { Switch } from '@/popup/components/ui/Switch';
import { InputAmountMemoized as InputAmount } from '@/popup/components/InputAmount';
import { debounceAsync } from '@/shared/helpers';
import { formatNumber, roundWithPrecision } from '@/popup/lib/utils';
import {
  useMessage,
  usePopupState,
  useTranslation,
  type PopupState,
} from '@/popup/lib/context';

export const RateOfPayScreen = () => {
  const message = useMessage();
  const {
    dispatch,
    state: {
      continuousPaymentsEnabled,
      rateOfPay,
      minRateOfPay,
      maxRateOfPay,
      walletAddress,
    },
  } = usePopupState();

  const updateRateOfPay = React.useRef(
    debounceAsync(async (rateOfPay: string) => {
      const response = await message.send('UPDATE_RATE_OF_PAY', { rateOfPay });
      if (!response.success) {
        // TODO: Maybe reset to old state, but not while user is active (avoid
        // sluggishness in UI)
      }
    }, 1000),
  );

  const onRateChange = async (rateOfPay: string) => {
    dispatch({ type: 'UPDATE_RATE_OF_PAY', data: { rateOfPay } });
    void updateRateOfPay.current(rateOfPay);
  };

  const toggleWM = () => {
    message.send('TOGGLE_WM');
    dispatch({ type: 'TOGGLE_WM', data: {} });
  };

  return (
    <RateOfPayComponent
      continuousPaymentsEnabled={continuousPaymentsEnabled}
      rateOfPay={rateOfPay}
      minRateOfPay={minRateOfPay}
      maxRateOfPay={maxRateOfPay}
      walletAddress={walletAddress}
      onRateChange={onRateChange}
      toggleWM={toggleWM}
    />
  );
};

interface Props {
  continuousPaymentsEnabled: PopupState['continuousPaymentsEnabled'];
  rateOfPay: PopupState['rateOfPay'];
  minRateOfPay: PopupState['minRateOfPay'];
  maxRateOfPay: PopupState['maxRateOfPay'];
  walletAddress: PopupState['walletAddress'];
  onRateChange: (rate: string) => Promise<void>;
  toggleWM: () => void | Promise<void>;
}

export const RateOfPayComponent = ({
  continuousPaymentsEnabled,
  rateOfPay,
  minRateOfPay,
  maxRateOfPay,
  walletAddress,
  onRateChange,
  toggleWM,
}: Props) => {
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
          onChange={toggleWM}
          label="Continuous payment"
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
        label="Rate of pay per hour"
        walletAddress={walletAddress}
        onChange={(rate) => {
          setErrorMessage('');
          onRateChange(rate);
        }}
        onError={(error) => setErrorMessage(t(error))}
        errorMessage={errorMessage}
        min={Number(formatAmount(minRateOfPay))}
        max={Number(formatAmount(maxRateOfPay))}
        amount={rateOfPay}
        controls={true}
        readOnly={disabled}
      />
    </>
  );
};
