import React from 'react';
import {
  type BackgroundToAppMessage,
  BACKGROUND_TO_APP_CONNECTION_NAME as CONNECTION_NAME,
  MessageManager,
  type AppToBackgroundMessage,
} from '@/shared/messages';
import { useBrowser } from '@/pages/shared/lib/context';
import { dispatch } from './store';

export { useBrowser, useTranslation } from '@/pages/shared/lib/context';

export function WaitForStateLoad({ children }: React.PropsWithChildren) {
  const message = useMessage();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function get() {
      const response = await message.send('GET_CONTEXT_DATA');

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

const MessageContext = React.createContext<
  MessageManager<AppToBackgroundMessage>
>({} as MessageManager<AppToBackgroundMessage>);

export const useMessage = () => React.useContext(MessageContext);

export const MessageContextProvider = ({
  children,
}: React.PropsWithChildren) => {
  const browser = useBrowser();
  const message = new MessageManager<AppToBackgroundMessage>({ browser });

  React.useEffect(() => {
    const port = browser.runtime.connect({ name: CONNECTION_NAME });
    port.onMessage.addListener((message: BackgroundToAppMessage) => {
      switch (message.type) {
        case 'SET_TRANSIENT_STATE':
          return dispatch(message);
      }
    });
    port.onDisconnect.addListener(() => {
      // nothing to do
    });
    return () => {
      port.disconnect();
    };
  }, [browser]);

  return (
    <MessageContext.Provider value={message}>
      {children}
    </MessageContext.Provider>
  );
};
