import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { useMessage, usePopupState } from '@/popup/lib/context';
import {
  getCurrencySymbol,
  charIsNumber,
  formatNumber,
} from '@/popup/lib/utils';
import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { AnimatePresence, m } from 'framer-motion';
import { Spinner } from './Icons';
import { cn } from '@/shared/helpers';
import { ErrorMessage } from './ErrorMessage';

interface PayWebsiteFormProps {
  amount: string;
}

const BUTTON_STATE = {
  idle: 'Send now',
  loading: <Spinner className="w-6 animate-spin" />,
  success: 'Payment successful',
};

export const PayWebsiteForm = () => {
  const message = useMessage();
  const {
    state: { walletAddress, url },
  } = usePopupState();
  const [buttonState, setButtonState] =
    React.useState<keyof typeof BUTTON_STATE>('idle');
  const isIdle = useMemo(() => buttonState === 'idle', [buttonState]);

  const {
    register,
    formState: { errors, isSubmitting },
    setValue,
    handleSubmit,
    ...form
  } = useForm<PayWebsiteFormProps>();

  const onSubmit = handleSubmit(async (data) => {
    if (buttonState !== 'idle') return;

    setButtonState('loading');

    const response = await message.send('PAY_WEBSITE', { amount: data.amount });

    if (!response.success) {
      setButtonState('idle');
      form.setError('root', { message: response.message });
    } else {
      setButtonState('success');
      form.reset();
      setTimeout(() => {
        setButtonState('idle');
      }, 2000);
    }
  });

  return (
    <form onSubmit={onSubmit}>
      <AnimatePresence mode="sync">
        {errors.root ? (
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
            <ErrorMessage error={errors.root.message} />
          </m.div>
        ) : null}
      </AnimatePresence>
      <Input
        type="text"
        inputMode="numeric"
        addOn={getCurrencySymbol(walletAddress.assetCode)}
        label={
          <p className="overflow-hidden text-ellipsis whitespace-nowrap">
            Pay <span className="text-ellipsis text-primary">{url}</span>
          </p>
        }
        placeholder="0.00"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
            onSubmit();
          } else if (
            !charIsNumber(e.key) &&
            e.key !== 'Backspace' &&
            e.key !== 'Delete' &&
            e.key !== 'Tab'
          ) {
            e.preventDefault();
          }
        }}
        errorMessage={errors.amount?.message}
        {...register('amount', {
          required: { value: true, message: 'Amount is required.' },
          valueAsNumber: true,
          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
            setValue(
              'amount',
              formatNumber(+e.currentTarget.value, walletAddress.assetScale),
            );
          },
        })}
      />
      <Button
        type="submit"
        className={cn(
          'mt-8 w-full',
          !isIdle ? 'cursor-not-allowed' : null,
          !isIdle && !isSubmitting ? 'disabled:opacity-100' : null,
        )}
        disabled={isSubmitting || !isIdle}
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
