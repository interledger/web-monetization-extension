import React from 'react';
import { cn } from '@/shared/helpers';

type ElementType = keyof React.JSX.IntrinsicElements;
const defaultElem: ElementType = 'div';

type Props<T extends ElementType> = {
  visible: boolean;
  as?: T;
} & React.HTMLAttributes<T>;

export const FadeInOut = <T extends ElementType = typeof defaultElem>({
  as: El = defaultElem as T,
  visible: visibleInitial,
  children,
  className = '',
  ...restProps
}: Props<T>) => {
  const [visible, setVisible] = React.useState<null | boolean>(null);
  React.useEffect(() => {
    setTimeout(() => setVisible(visibleInitial), 0);
  }, [visibleInitial]);

  return (
    // @ts-expect-error idk anymore
    <El
      className={cn(
        'duration-300',
        className,
        'transition-opacity',
        visible ? 'opacity-100' : 'opacity-0 sr-only',
      )}
      {...restProps}
    >
      {visible && children}
    </El>
  );
};
