import React from 'react';
import type { Runtime } from 'webextension-polyfill';
import { useBrowser } from '@/popup/lib/context';
import type {
  KeyAutoAddToBackgroundMessage,
  StepWithStatus,
} from '@/content/keyAutoAdd/lib/types';
import { CONNECTION_NAME } from '@/background/services/keyAutoAdd';

type State = {
  currentStep: StepWithStatus;
  steps: StepWithStatus[];
};

type OnPortMessageListener = Parameters<
  Runtime.Port['onMessage']['addListener']
>[0];

const DEFAULT_CURRENT_STEP: StepWithStatus = {
  name: '',
  status: 'pending',
  maxDuration: 0,
};

const StateContext = React.createContext<State>({
  currentStep: DEFAULT_CURRENT_STEP,
  steps: [],
});

export const StateContextProvider = ({ children }: React.PropsWithChildren) => {
  const browser = useBrowser();
  const [state, setState] = React.useState<State>({
    currentStep: DEFAULT_CURRENT_STEP,
    steps: [],
  });

  React.useEffect(() => {
    const onMessage: OnPortMessageListener = (
      message: KeyAutoAddToBackgroundMessage,
    ) => {
      if (message.action === 'PROGRESS') {
        const { steps } = message.payload;
        const currentStep = getCurrentStep(steps);
        setState({
          currentStep: currentStep || DEFAULT_CURRENT_STEP,
          steps: steps,
        });
      }
    };

    const port = browser.runtime.connect({ name: CONNECTION_NAME });
    port.onMessage.addListener(onMessage);
    return () => {
      port.disconnect();
    };
  }, [browser]);

  return (
    <StateContext.Provider value={state}>{children}</StateContext.Provider>
  );
};

function getCurrentStep(steps: Readonly<StepWithStatus[]>) {
  return steps
    .slice()
    .reverse()
    .find((step) => step.status !== 'pending');
}

export const useState = () => React.useContext(StateContext);

type UIMode = 'notification' | 'fullscreen';
const UIModeContext = React.createContext<UIMode>('notification');
export const UIModeProvider = ({ children }: React.PropsWithChildren) => {
  const [mode, setMode] = React.useState<UIMode>('notification');

  React.useEffect(() => {
    const onHashChange = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const mode = params.get('mode');
      if (mode === 'fullscreen' || mode === 'notification') {
        setMode(mode);
      }
    };
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return (
    <UIModeContext.Provider value={mode}>{children}</UIModeContext.Provider>
  );
};

export const useUIMode = () => React.useContext(UIModeContext);
