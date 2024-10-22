import React from 'react';
import { Input } from '@/popup/components/ui/Input';
import { Switch } from '@/popup/components/ui/Switch';
import { Button } from '@/popup/components/ui/Button';
import { InputAmount } from '@/popup/components/InputAmount';
import { ErrorMessage } from '@/popup/components/ErrorMessage';
import { ErrorWithKeyLike, getNextOccurrence } from '@/shared/helpers';
import { getCurrencySymbol, transformBalance } from '@/popup/lib/utils';
import {
  useMessage,
  useTranslation,
  type PopupState,
} from '@/popup/lib/context';
import type { Response, UpdateBudgetPayload } from '@/shared/messages';

type Props = Pick<PopupState, 'balance' | 'grants' | 'walletAddress'>;

export const BudgetScreen = ({ grants, walletAddress, balance }: Props) => {
  const message = useMessage();
  return (
    <div className="space-y-8">
      <RemainingBalance walletAddress={walletAddress} balance={balance} />
      <BudgetAmount
        walletAddress={walletAddress}
        grants={grants}
        handleChange={(payload) => message.send('UPDATE_BUDGET', payload)}
        onBudgetChanged={() => {
          // TODO: send user to the settings/budget page, but with new data
          window.location.reload();
        }}
      />
    </div>
  );
};

type BudgetAmountProps = {
  grants: PopupState['grants'];
  walletAddress: PopupState['walletAddress'];
  handleChange: (payload: UpdateBudgetPayload) => Promise<Response>;
  onBudgetChanged: () => void;
};

type ErrorInfo = { message: string; info?: ErrorWithKeyLike };
type ErrorsParams = 'amount' | 'root';
type Errors = Record<ErrorsParams, ErrorInfo | null>;

const BudgetAmount = ({
  grants,
  walletAddress,
  handleChange,
  onBudgetChanged,
}: BudgetAmountProps) => {
  const t = useTranslation();

  const toErrorInfo = React.useCallback(
    (err?: string | ErrorWithKeyLike | null): ErrorInfo | null => {
      if (!err) return null;
      if (typeof err === 'string') return { message: err };
      return { message: t(err), info: err };
    },
    [t],
  );

  const originalValues = {
    walletAddressUrl: walletAddress.id,
    amount: transformBalance(
      grants.recurring?.value ?? grants.oneTime!.value,
      walletAddress.assetScale,
    ),
    recurring: !!grants.recurring?.interval,
  };

  const [amount, setAmount] = React.useState(originalValues.amount);
  const [recurring, setRecurring] = React.useState(originalValues.recurring);
  const [errors, setErrors] = React.useState<Errors>({
    amount: null,
    root: null,
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [changed, setChanged] = React.useState({
    amount: false,
    recurring: false,
  });

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setErrors({ amount: null, root: null });
    setIsSubmitting(true);
    try {
      const res = await handleChange({
        walletAddressUrl: walletAddress.id,
        amount,
        recurring,
      });
      if (!res.success) {
        setErrors((prev) => ({
          ...prev,
          root: toErrorInfo(res.error || res.message),
        }));
      } else {
        setChanged({ amount: false, recurring: false });
      }
      onBudgetChanged();
    } catch (error) {
      setErrors((prev) => ({ ...prev, root: toErrorInfo(error) }));
    }
    setIsSubmitting(false);
  };

  const renewDate = React.useMemo(() => {
    let interval;
    if (!changed.amount && !changed.recurring) {
      interval = grants.recurring?.interval;
    }
    if (!interval) {
      if (changed.recurring && !recurring) {
        interval = undefined;
      } else if ((changed.recurring && recurring) || changed.amount) {
        interval = `R/${new Date().toISOString()}/P1M`;
      } else if (grants.recurring?.interval) {
        interval = grants.recurring.interval;
      }
    }
    return interval ? getNextOccurrence(interval) : null;
  }, [changed.amount, changed.recurring, grants.recurring, recurring]);

  return (
    <form className="space-y-2" onSubmit={onSubmit}>
      <div className="flex items-center gap-4">
        <InputAmount
          id="budgetAmount"
          label="Budget amount"
          walletAddress={walletAddress}
          className="max-w-56"
          amount={amount}
          onChange={(amount) => {
            setErrors((prev) => ({ ...prev, amount: null }));
            setAmount(amount);
            setChanged((prev) => ({
              ...prev,
              amount: amount !== originalValues.amount,
            }));
          }}
          onError={(err) => {
            setErrors((prev) => ({ ...prev, amount: toErrorInfo(err) }));
          }}
          errorMessage={errors.amount?.message}
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
            checked={recurring}
            onChange={(ev) => {
              const checked = ev.currentTarget.checked;
              setRecurring(checked);
              setChanged((prev) => ({
                ...prev,
                recurring: originalValues.recurring !== checked,
              }));
            }}
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

      <div className="space-y-1">
        {errors.root?.message && <ErrorMessage error={errors.root.message} />}

        <Button
          type="submit"
          className="w-full"
          disabled={(!changed.amount && !changed.recurring) || isSubmitting}
          loading={isSubmitting}
        >
          Submit changes
        </Button>
      </div>
    </form>
  );
};

type RemainingBalanceProps = Pick<PopupState, 'balance' | 'walletAddress'>;

const RemainingBalance = ({
  balance,
  walletAddress,
}: RemainingBalanceProps) => {
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
