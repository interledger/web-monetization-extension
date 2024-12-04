import React from 'react';
import type { RecurringGrant, OneTimeGrant, AmountValue } from '@/shared/types';
import type { AddFundsPayload, Response } from '@/shared/messages';
import type { WalletAddress } from '@interledger/open-payments';
import { getCurrencySymbol } from '@/pages/shared/lib/utils';
import { useTranslation } from '@/pages/shared/lib/context';
import { getNextOccurrence, transformBalance } from '@/shared/helpers';
import { ErrorMessage } from '@/pages/shared/components/ErrorMessage';
import { InputAmount } from '@/pages/shared/components/InputAmount';
import { Button } from '@/pages/shared/components/ui/Button';
import { Input } from '@/pages/shared/components/ui/Input';

interface OutOfFundsProps {
  info: Pick<WalletAddress, 'id' | 'assetCode' | 'assetScale'>;
  grantRecurring?: RecurringGrant['amount'];
  grantOneTime?: OneTimeGrant['amount'];
  onChooseOption: (recurring: boolean) => void;
}

export const OutOfFunds = ({
  info,
  grantOneTime,
  grantRecurring,
  onChooseOption,
}: OutOfFundsProps) => {
  if (!grantOneTime && !grantRecurring) {
    throw new Error('Provide at least one of grantOneTime and grantRecurring');
  }
  const t = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <ErrorMessage
        error={t('outOfFunds_error_title')}
        className="mb-0 text-error"
      />
      <div className="px-2 text-xs text-medium">
        <p>{t('outOfFunds_error_text')}</p>
        <p>{t('outOfFunds_error_textHint')}</p>
        {grantRecurring?.value && (
          <p className="mt-1">
            <RecurringAutoRenewInfo
              info={info}
              grantRecurring={grantRecurring}
            />
          </p>
        )}
      </div>

      <div className="w-100 h-0.5 bg-disabled" />

      <Button onClick={() => onChooseOption(true)}>
        {t('outOfFunds_action_optionRecurring')}
      </Button>
      <Button onClick={() => onChooseOption(false)}>
        {t('outOfFunds_action_optionOneTime')}
      </Button>
    </div>
  );
};

interface AddFundsProps {
  info: Pick<WalletAddress, 'id' | 'assetCode' | 'assetScale'>;
  recurring: boolean;
  defaultAmount: AmountValue;
  requestAddFunds: (details: AddFundsPayload) => Promise<Response>;
}

export function AddFunds({
  info,
  defaultAmount,
  recurring,
  requestAddFunds,
}: AddFundsProps) {
  type Errors = Record<'amount' | 'root', { message: string } | null>;

  const t = useTranslation();

  const [amount, setAmount] = React.useState(
    transformBalance(defaultAmount, info.assetScale),
  );

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({
    amount: null,
    root: null,
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (ev) => {
        ev.preventDefault();
        setErrors({ root: null, amount: null });

        setIsSubmitting(true);
        const response = await requestAddFunds({
          amount: amount,
          recurring: !!recurring,
        });
        setIsSubmitting(false);

        if (!response.success) {
          setErrors((prev) => ({
            ...prev,
            root: { message: response.message },
          }));
        }
      }}
    >
      <Input
        type="url"
        label={t('outOfFundsAddFunds_label_walletAddress')}
        value={info.id}
        readOnly
        disabled
      />

      <InputAmount
        id="amount_outOfFunds"
        walletAddress={info}
        label={t('outOfFundsAddFunds_label_amount')}
        description={
          recurring
            ? t('outOfFundsAddFunds_label_amountDescriptionRecurring', [
                getNextOccurrenceDate('P1M'),
              ])
            : t('outOfFundsAddFunds_label_amountDescriptionOneTime')
        }
        amount={amount}
        placeholder="5.00"
        onChange={(amount) => {
          setAmount(amount);
          setErrors({ amount: null, root: null });
        }}
        onError={(error) => {
          setErrors((prev) => ({ ...prev, amount: { message: t(error) } }));
        }}
        errorMessage={errors.amount?.message}
      />

      {errors.root && (
        <ErrorMessage
          error={errors.root.message}
          className="mb-0 py-1 text-xs text-error"
        />
      )}

      <Button
        type="submit"
        disabled={isSubmitting || !!errors.amount}
        loading={isSubmitting}
      >
        {recurring
          ? t('outOfFundsAddFunds_action_addRecurring')
          : t('outOfFundsAddFunds_action_addOneTime')}
      </Button>
    </form>
  );
}

function RecurringAutoRenewInfo({
  grantRecurring,
  info,
}: Pick<OutOfFundsProps, 'grantRecurring' | 'info'>) {
  const t = useTranslation();

  if (!grantRecurring) return null;

  const currencySymbol = getCurrencySymbol(info.assetCode);
  const amount = transformBalance(grantRecurring.value, info.assetScale);
  const renewDate = getNextOccurrence(grantRecurring.interval, new Date());
  const renewDateLocalized = renewDate.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return t('outOfFunds_error_textDoNothing', [
    `${currencySymbol}${amount}`,
    renewDateLocalized,
  ]);
}

function getNextOccurrenceDate(period: 'P1M', baseDate = new Date()) {
  const date = getNextOccurrence(
    `R/${baseDate.toISOString()}/${period}`,
    baseDate,
  );
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}
