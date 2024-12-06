import React from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Button } from '@/pages/shared/components/ui/Button';
import { InputAmount } from '@/pages/shared/components/InputAmount';
import { roundWithPrecision } from '@/pages/shared/lib/utils';
import { cn, type ErrorWithKeyLike } from '@/shared/helpers';
import { useMessage, useTranslation } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';

type ErrorInfo = { message: string; info?: ErrorWithKeyLike };
type ErrorsParams = 'amount' | 'pay';
type Errors = Record<ErrorsParams, ErrorInfo | null>;

export const PayWebsiteForm = () => {
  const t = useTranslation();
  const message = useMessage();
  const { walletAddress, tab } = usePopupState();

  const toErrorInfo = React.useCallback(
    (err?: string | ErrorWithKeyLike | null): ErrorInfo | null => {
      if (!err) return null;
      if (typeof err === 'string') return { message: err };
      return { message: t(err), info: err };
    },
    [t],
  );

  const [amount, setAmount] = React.useState('');
  const [errors, setErrors] = React.useState<Errors>({
    amount: null,
    pay: null,
  });

  const form = React.useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [payStatus, setPayStatus] = React.useState<null | {
    type: 'full' | 'partial';
    message: string;
  }>(null);

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (isSubmitting) return;
    setErrors({ amount: null, pay: null });
    setPayStatus(null);

    setIsSubmitting(true);

    const response = await message.send('PAY_WEBSITE', { amount });

    if (!response.success) {
      setErrors((prev) => ({
        ...prev,
        pay: toErrorInfo(response.error || response.message),
      }));
    } else {
      setAmount('');
      const { type, sentAmountFormatted } = response.payload;
      const msg = t('pay_state_success', [sentAmountFormatted]);
      setPayStatus({ type, message: msg });
      form.current?.reset();
    }
    setIsSubmitting(false);
  };

  return (
    <form
      ref={form}
      className={cn(
        'space-y-2 rounded-md bg-gray-50 px-4 py-4',
        !errors.pay && 'pb-12',
      )}
      onSubmit={onSubmit}
    >
      <AnimatePresence mode="sync">
        {errors.pay || !!payStatus ? (
          <m.div
            transition={{ duration: 0.3, bounce: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'break-word flex items-center gap-2 rounded-xl border px-3 py-2',
                errors.pay
                  ? errors.pay?.info?.key.includes('_warn_')
                    ? 'border-orange-600 bg-orange-100 text-orange-800'
                    : 'border-red-300 bg-red-500/10'
                  : 'border-green-500 bg-green-500/10 text-secondary-dark',
              )}
              role="alert"
            >
              <div>{payStatus?.message || errors.pay?.message}</div>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>

      <InputAmount
        id="payAmount"
        label={
          <p className="overflow-hidden text-ellipsis whitespace-nowrap">
            Support{' '}
            <span className="text-ellipsis text-primary">{tab.url}</span>
          </p>
        }
        walletAddress={walletAddress}
        amount={amount}
        placeholder="0.00"
        min={roundWithPrecision(
          2 / 10 ** walletAddress.assetScale,
          walletAddress.assetScale,
        )}
        errorMessage={errors.amount?.message}
        onChange={(amountValue) => {
          setErrors({ pay: null, amount: null });
          setPayStatus(null);
          setAmount(amountValue);
        }}
        onError={(error) =>
          setErrors((prev) => ({ ...prev, amount: toErrorInfo(error) }))
        }
      />

      <Button
        type="submit"
        className={cn(
          'w-full',
          isSubmitting || !amount || !!errors.amount ? 'opacity-100' : null,
        )}
        disabled={isSubmitting || !amount || !!errors.amount}
        loading={isSubmitting}
        aria-label={t('pay_action_pay')}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 25 }}
          >
            {t('pay_action_pay')}
          </m.span>
        </AnimatePresence>
      </Button>
    </form>
  );
};
