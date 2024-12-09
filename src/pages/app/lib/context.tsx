import React from 'react';

import { MessageManager, type AppToBackgroundMessage } from '@/shared/messages';
import { useBrowser } from '@/pages/shared/lib/context';
import { dispatch } from './store';

export { useBrowser, useTranslation } from '@/pages/shared/lib/context';

export function WaitForStateLoad({ children }: React.PropsWithChildren) {
  const message = useMessage();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function get() {
      const response = await message.send('GET_DATA_APP');

      if (response.success) {
        dispatch({ type: 'SET_DATA', data: response.payload });
        setIsLoading(false);
      }
    }

    get();
  }, [message]);

  if (isLoading) {
    return <>Loading</>;
  }

  return <>{children}</>;
}

// #region Message
const MessageContext = React.createContext<
  MessageManager<AppToBackgroundMessage>
>({} as MessageManager<AppToBackgroundMessage>);

export const useMessage = () => React.useContext(MessageContext);

export const MessageContextProvider = ({
  children,
}: React.PropsWithChildren) => {
  const browser = useBrowser();
  const message = new MessageManager<AppToBackgroundMessage>({ browser });

  return (
    <MessageContext.Provider value={message}>
      {children}
    </MessageContext.Provider>
  );
};
// #endregion
