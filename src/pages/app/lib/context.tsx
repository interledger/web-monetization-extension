import React from 'react';
import {
  type BackgroundToAppMessage,
  BACKGROUND_TO_APP_CONNECTION_NAME as CONNECTION_NAME,
  MessageManager,
  type AppToBackgroundMessage,
} from '@/shared/messages';
import {
  TelemetryContextProvider,
  useBrowser,
} from '@/pages/shared/lib/context';
import { dispatch } from './store';

export { useBrowser, useTranslation } from '@/pages/shared/lib/context';

export function WaitForStateLoad({ children }: React.PropsWithChildren) {
  const message = useMessage();
  const [isLoading, setIsLoading] = React.useState(true);
  const [telemetryConfig, setTelemetryConfig] = React.useState<{
    uid: string;
    isOptedIn?: boolean;
  }>({ uid: '' });

  React.useEffect(() => {
    async function get() {
      const response = await message.send('GET_DATA_APP');

      if (response.success) {
        const data = response.payload;
        dispatch({ type: 'SET_DATA_APP', data });
        setTelemetryConfig({ uid: data.uid, isOptedIn: data.consentTelemetry });
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
