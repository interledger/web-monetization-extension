import React from 'react';
import { Input } from '@/popup/components/ui/Input';
import { Switch } from '@/popup/components/ui/Switch';
import { getNextOccurrence } from '@/shared/helpers';
import { getCurrencySymbol, transformBalance } from '@/popup/lib/utils';
import type { PopupState } from '@/popup/lib/context';

export const BudgetScreen: React.FC<
  Pick<PopupState, 'balance' | 'grants' | 'walletAddress'>
> = ({ grants, walletAddress, balance }) => {
  return (
    <div className="space-y-8">
      <BudgetAmount walletAddress={walletAddress} grants={grants} />
      <RemainingBalance walletAddress={walletAddress} balance={balance} />
    </div>
  );
};

const BudgetAmount: React.FC<Pick<PopupState, 'grants' | 'walletAddress'>> = ({
  grants,
  walletAddress,
}) => {
  const budget = transformBalance(
    grants.recurring?.value ?? grants.oneTime!.value,
    walletAddress.assetScale,
  );

  const renewDate = grants.recurring?.interval
    ? getNextOccurrence(grants.recurring.interval)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <Input
          label="Budget amount"
          className="max-w-56"
          addOn={
            <span className="text-weak">
              {getCurrencySymbol(walletAddress.assetCode)}
            </span>
          }
          value={budget}
          disabled={true}
        />
        <div>
          <span
            className="font-medium leading-6 text-medium"
            aria-hidden="true"
          >
            &nbsp;
          </span>
          <Switch
            label="Monthly"
            checked={!!grants.recurring?.interval}
            disabled={true}
          />
        </div>
      </div>
      {renewDate && (
        <p className="px-2 text-xs">
          Your budget will renew on{' '}
          <time
            dateTime={renewDate.toISOString()}
            title={renewDate.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          >
            {renewDate.toLocaleString(undefined, {
              dateStyle: 'medium',
            })}
          </time>
          .
        </p>
      )}
    </div>
  );
};

const RemainingBalance: React.FC<
  Pick<PopupState, 'balance' | 'walletAddress'>
> = ({ balance, walletAddress }) => {
  const amount = transformBalance(balance, walletAddress.assetScale);
  return (
    <div className="space-y-2">
      <Input
        label="Remaining balance"
        className="max-w-56"
        addOn={
          <span className="text-weak">
            {getCurrencySymbol(walletAddress.assetCode)}
          </span>
        }
        value={amount}
        disabled={true}
      />
    </div>
  );
};
