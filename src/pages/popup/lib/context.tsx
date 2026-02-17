import React from 'react';
import {
  BACKGROUND_TO_POPUP_CONNECTION_NAME as CONNECTION_NAME,
  MessageManager,
  type PopupToBackgroundMessage,
  type BackgroundToPopupMessage,
} from '@/shared/messages';
import {
  TelemetryContextProvider,
  useBrowser,
} from '@/pages/shared/lib/context';
import { dispatch } from './store';

export {
  useBrowser,
  useBrowserInfo,
  useTranslation,
  useTelemetry,
} from '@/pages/shared/lib/context';

export function WaitForStateLoad({ children }: React.PropsWithChildren) {
  const message = useMessage();
  const [isLoading, setIsLoading] = React.useState(true);
  const [telemetryConfig, setTelemetryConfig] = React.useState<{
    uid: string;
    continuousPaymentsEnabled: boolean;
    isOptedIn?: boolean;
  }>({ uid: '', continuousPaymentsEnabled: false });

  React.useEffect(() => {
    async function get() {
      const response = await message.send('GET_DATA_POPUP');

      if (response.success) {
        const data = response.payload;
        dispatch({ type: 'SET_DATA_POPUP', data });
        setTelemetryConfig({
          uid: data.uid,
          isOptedIn: data.consentTelemetry,
          continuousPaymentsEnabled: data.continuousPaymentsEnabled,
        });
        setIsLoading(false);
      }
    }

    void get();
  }, [message]);

  if (isLoading) {
    return 'Loading';
  }

  return (
    <TelemetryContextProvider {...telemetryConfig}>
      {children}
    </TelemetryContextProvider>
  );
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
        case 'CLOSE_POPUP':
          return window.close();
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
