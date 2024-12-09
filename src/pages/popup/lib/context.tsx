import React from 'react';
import {
  BACKGROUND_TO_POPUP_CONNECTION_NAME as CONNECTION_NAME,
  MessageManager,
  type PopupToBackgroundMessage,
  type BackgroundToPopupMessage,
} from '@/shared/messages';
import { useBrowser } from '@/pages/shared/lib/context';
import { dispatch } from './store';

export { useBrowser, useTranslation } from '@/pages/shared/lib/context';

export function WaitForStateLoad({ children }: React.PropsWithChildren) {
  const message = useMessage();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function get() {
      const response = await message.send('GET_DATA_POPUP');

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
  MessageManager<PopupToBackgroundMessage>
>({} as MessageManager<PopupToBackgroundMessage>);

export const useMessage = () => React.useContext(MessageContext);

export const MessageContextProvider = ({
  children,
}: React.PropsWithChildren) => {
  const browser = useBrowser();
  const message = new MessageManager<PopupToBackgroundMessage>({ browser });

  React.useEffect(() => {
    const port = browser.runtime.connect({ name: CONNECTION_NAME });
    port.onMessage.addListener((message: BackgroundToPopupMessage) => {
      switch (message.type) {
        case 'SET_BALANCE':
        case 'SET_STATE':
        case 'SET_TAB_DATA':
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
