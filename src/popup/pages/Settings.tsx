import React from 'react';
import { useLocation } from 'react-router-dom';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { WalletInformation } from '@/popup/components/Settings/WalletInformation';
import { BudgetScreen } from '@/popup/components/Settings/Budget';
import { RateOfPayScreen } from '@/popup/components/Settings/RateOfPay';
import { cn } from '@/shared/helpers';
import { usePopupState } from '@/popup/lib/context';
import { useLocalStorage } from '../lib/hooks';

const TABS = ['Wallet', 'Budget', 'Rate'];

export const Component = () => {
  const {
    state: { balance, grants, publicKey, walletAddress },
  } = usePopupState();
  const location = useLocation();
  const [storedTabIndex, setStoredTabIndex] = useLocalStorage(
    'settings.tabIndex',
    0,
    { maxAge: 10 * 60 * 1000, validate: (n) => n >= 0 && n < TABS.length },
  );
  const [tabIndex, setTabIndex] = React.useState(
    location.state?.tabIndex ?? storedTabIndex ?? 0,
  );

  return (
    <Tabs
      className="flex flex-1 flex-col"
      selectedIndex={tabIndex}
      onSelect={(index) => {
        setTabIndex(index);
        setStoredTabIndex(index);
      }}
    >
      <TabList className="mb-8 flex border-b border-gray-200">
        {TABS.map((name, i) => (
          <Tab
            key={name}
            className={cn(
              tabIndex === i
                ? 'text-secondary border-current'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              'cursor-pointer whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium focus:outline-none focus-visible:outline',
            )}
          >
            {name}
          </Tab>
        ))}
      </TabList>

      <TabPanel selectedClassName="h-full">
        <WalletInformation
          publicKey={publicKey}
          walletAddress={walletAddress}
        />
      </TabPanel>
      <TabPanel selectedClassName="h-full">
        <BudgetScreen
          walletAddress={walletAddress}
          balance={balance}
          grants={grants}
        />
      </TabPanel>
      <TabPanel selectedClassName="h-full">
        <RateOfPayScreen />
      </TabPanel>
    </Tabs>
  );
};
