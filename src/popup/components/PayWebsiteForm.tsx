import React from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Button } from '@/popup/components/ui/Button';
import { Spinner } from '@/popup/components/Icons';
import { ErrorMessage } from '@/popup/components/ErrorMessage';
import { InputAmount } from '@/popup/components/InputAmount';
import { cn, ErrorWithKeyLike } from '@/shared/helpers';
import { useMessage, usePopupState, useTranslation } from '@/popup/lib/context';

type ErrorInfo = { message: string; info?: ErrorWithKeyLike };
type ErrorsParams = 'amount' | 'pay';
type Errors = Record<ErrorsParams, ErrorInfo | null>;

const BUTTON_STATE = {
  idle: 'Send now',
  loading: <Spinner className="w-6 animate-spin" />,
  success: 'Payment successful',
};

export const PayWebsiteForm = () => {
  const t = useTranslation();
  const message = useMessage();
  const {
    state: { walletAddress, tab },
  } = usePopupState();

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
  const [buttonState, setButtonState] =
    React.useState<keyof typeof BUTTON_STATE>('idle');
  const isIdle = React.useMemo(() => buttonState === 'idle', [buttonState]);

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (buttonState !== 'idle') return;
    setErrors({ amount: null, pay: null });

    setButtonState('loading');
    setIsSubmitting(true);

    const response = await message.send('PAY_WEBSITE', { amount });

    if (!response.success) {
      setButtonState('idle');
      setErrors((prev) => ({ ...prev, pay: toErrorInfo(response.message) }));
    } else {
      setButtonState('success');
      setAmount('');
      form.current?.reset();
      setTimeout(() => {
        setButtonState('idle');
      }, 3000);
    }
    setIsSubmitting(false);
  };

  return (
    <form
      ref={form}
      className="space-y-4 rounded-md bg-gray-50 px-4 py-4 pb-12"
      onSubmit={onSubmit}
    >
      <AnimatePresence mode="sync">
        {errors.pay ? (
          <m.div
            transition={{
              duration: 0.3,
              bounce: 0,
            }}
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
            key="form-error"
          >
            <ErrorMessage error={errors.pay.message} />
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
        errorMessage={errors.amount?.message}
        onChange={(amountValue) => {
          setErrors({ pay: null, amount: null });
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
          !isIdle ? 'cursor-not-allowed' : null,
          !isIdle && !isSubmitting ? 'disabled:opacity-100' : null,
        )}
        disabled={isSubmitting || !isIdle || !amount || !!errors.amount}
        aria-label="Send now"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 25 }}
            key={buttonState}
          >
            {BUTTON_STATE[buttonState]}
          </m.span>
        </AnimatePresence>
      </Button>
    </form>
  );
};
