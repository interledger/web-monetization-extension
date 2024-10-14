import React from 'react';
import { useLocation } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { WalletInformation } from '@/popup/components/Settings/WalletInformation';
import { BudgetScreen } from '@/popup/components/Settings/Budget';
import { RateOfPayScreen } from '@/popup/components/Settings/RateOfPay';
import { cn } from '@/shared/helpers';
import { usePopupState } from '@/popup/lib/context';
import { useLocalStorage } from '@/popup/lib/hooks';

const TABS = [
  { id: 'wallet', title: 'Wallet' },
  { id: 'budget', title: 'Budget' },
  { id: 'wmRate', title: 'Rate' },
];

const isValidTabId = (id: string) => {
  return TABS.some((e) => e.id === id);
};

export const Component = () => {
  const {
    state: { balance, grants, publicKey, walletAddress },
  } = usePopupState();
  const location = useLocation();
  const [storedTabId, setStoredTabId] = useLocalStorage(
    'settings.tabId',
    TABS[0].id,
    { maxAge: 10 * 60 * 1000, validate: isValidTabId },
  );
  const tabIdFromState =
    location.state?.tabId && isValidTabId(location.state?.tabId)
      ? (location.state.tabId as string)
      : null;
  const [currentTabId, setCurrentTabId] = React.useState(
    tabIdFromState ?? storedTabId ?? TABS[0].id,
  );

  return (
    <Tabs.Root
      className="flex flex-1 flex-col"
      defaultValue={currentTabId}
      onValueChange={(id) => {
        setCurrentTabId(id);
        setStoredTabId(id);
      }}
    >
      <Tabs.List className="mb-8 flex border-b border-gray-200">
        {TABS.map(({ id, title }) => (
          <Tabs.TabsTrigger
            key={id}
            value={id}
            className={cn(
              currentTabId === id
                ? 'border-current text-secondary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              'cursor-pointer whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium focus:outline-none focus-visible:outline',
            )}
          >
            {title}
          </Tabs.TabsTrigger>
        ))}
      </Tabs.List>

      <Tabs.TabsContent value={TABS[0].id} className="h-full">
        <WalletInformation
          publicKey={publicKey}
          walletAddress={walletAddress}
        />
      </Tabs.TabsContent>

      <Tabs.TabsContent value={TABS[1].id} className="h-full">
        <BudgetScreen
          walletAddress={walletAddress}
          balance={balance}
          grants={grants}
        />
      </Tabs.TabsContent>

      <Tabs.TabsContent value={TABS[2].id} className="h-full">
        <RateOfPayScreen />
      </Tabs.TabsContent>
    </Tabs.Root>
  );
};
