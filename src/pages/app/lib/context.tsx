import React from 'react';

import { MessageManager, type AppToBackgroundMessage } from '@/shared/messages';
import { useBrowser } from '@/pages/shared/lib/context';

export { useBrowser, useTranslation } from '@/pages/shared/lib/context';

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
