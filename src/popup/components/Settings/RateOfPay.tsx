import React from 'react';
import { Switch } from '@/popup/components/ui/Switch';
import { Label } from '@/popup/components/ui/Label';
import { Slider } from '@/popup/components/ui/Slider';
import { debounceAsync } from '@/shared/helpers';
import {
  formatNumber,
  getCurrencySymbol,
  roundWithPrecision,
} from '@/popup/lib/utils';
import {
  useMessage,
  usePopupState,
  type PopupState,
} from '@/popup/lib/context';

export const RateOfPayScreen = () => {
  const message = useMessage();
  const {
    dispatch,
    state: { enabled, rateOfPay, minRateOfPay, maxRateOfPay, walletAddress },
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
      continuousPaymentsEnabled={enabled}
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
  continuousPaymentsEnabled: PopupState['enabled'];
  rateOfPay: PopupState['rateOfPay'];
  minRateOfPay: PopupState['minRateOfPay'];
  maxRateOfPay: PopupState['maxRateOfPay'];
  walletAddress: PopupState['walletAddress'];
  onRateChange: (rate: string) => Promise<void>;
  toggleWM: () => void | Promise<void>;
}

export const RateOfPayComponent: React.FC<Props> = ({
  continuousPaymentsEnabled,
  rateOfPay,
  minRateOfPay,
  maxRateOfPay,
  walletAddress,
  onRateChange,
  toggleWM,
}) => {
  return (
    <div className="space-y-8">
      <Switch
        checked={continuousPaymentsEnabled}
        onChange={toggleWM}
        label="Continuous payment stream"
      />

      <RateOfPayInput
        onRateChange={(ev) => onRateChange(ev.currentTarget.value)}
        rateOfPay={rateOfPay}
        minRateOfPay={minRateOfPay}
        maxRateOfPay={maxRateOfPay}
        walletAddress={walletAddress}
        disabled={!continuousPaymentsEnabled}
      />
    </div>
  );
};

const RateOfPayInput: React.FC<{
  onRateChange: React.ChangeEventHandler<HTMLInputElement>;
  walletAddress: PopupState['walletAddress'];
  rateOfPay: PopupState['rateOfPay'];
  minRateOfPay: PopupState['minRateOfPay'];
  maxRateOfPay: PopupState['maxRateOfPay'];
  disabled?: boolean;
}> = ({
  onRateChange,
  walletAddress,
  rateOfPay,
  minRateOfPay,
  maxRateOfPay,
  disabled,
}) => {
  const rate = React.useMemo(() => {
    const r = Number(rateOfPay) / 10 ** walletAddress.assetScale;
    const roundedR = roundWithPrecision(r, walletAddress.assetScale);

    return formatNumber(roundedR, walletAddress.assetScale, true);
  }, [rateOfPay, walletAddress.assetScale]);

  return (
    <div className="space-y-2">
      <Label className="px-2 text-base font-medium text-medium">
        Rate of pay per hour
      </Label>
      <Slider
        onChange={onRateChange}
        min={Number(minRateOfPay)}
        max={Number(maxRateOfPay)}
        step={Number(minRateOfPay)}
        value={Number(rateOfPay)}
        disabled={disabled}
      />
      <div className="flex w-full items-center justify-between px-2 tabular-nums">
        <span className="text-sm">
          {rate} {getCurrencySymbol(walletAddress.assetCode)} per hour
        </span>
      </div>
    </div>
  );
};
