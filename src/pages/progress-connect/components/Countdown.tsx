import React from 'react';
import { cn } from '@/pages/shared/lib/utils';

export function Countdown({
  expiresAt,
  className,
}: {
  expiresAt: number;
  className?: string;
}) {
  const timer = useCountdown(expiresAt);

  return (
    <span className={cn('tabular-nums', className)} role="timer">
      {timer[0]}:{timer[1]}
    </span>
  );
}

export function useCountdown(expiresAt: number) {
  const getMinuteAndSecond = React.useCallback((deadline: number) => {
    const distance = deadline - Date.now();
    if (distance < 0) {
      return ['00', '00'] as const;
    }
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    return [
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ] as const;
  }, []);

  const [value, setValue] = React.useState(getMinuteAndSecond(expiresAt));

  React.useEffect(() => {
    let requestId: ReturnType<typeof requestAnimationFrame>;

    const tick = () => {
      const val = getMinuteAndSecond(expiresAt);
      setValue(val);
      requestId = requestAnimationFrame(tick);
      if (val[0] === '00' && val[1] === '00') {
        cancelAnimationFrame(requestId);
      }
    };

    requestId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(requestId);
    };
  }, [expiresAt, getMinuteAndSecond]);

  return value;
}
