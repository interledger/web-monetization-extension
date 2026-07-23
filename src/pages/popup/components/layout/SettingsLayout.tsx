import React from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/pages/shared/lib/utils';
import { useLocalStorage } from '@/pages/shared/lib/hooks';
import { useTranslation } from '@/popup/lib/context';

export const SETTINGS_TABS = [
  { id: 'wallet', titleKey: 'settings_tabs_wallet_text' },
  { id: 'budget', titleKey: 'settings_tabs_budget_text' },
  { id: 'rate', titleKey: 'settings_tabs_rate_text' },
  { id: 'other', titleKey: 'settings_tabs_other_text' },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

export const isValidSettingsTabId = (
  id: string | undefined,
): id is SettingsTabId => SETTINGS_TABS.some((t) => t.id === id);

export const SETTINGS_TAB_STORAGE_KEY = 'settings.tabId';

export const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  const t = useTranslation();
  const [pathname, navigate] = useLocation();
  const tabId = pathname === '/' ? undefined : pathname.slice(1);

  const [storedTabId, setStoredTabId] = useLocalStorage<SettingsTabId>(
    SETTINGS_TAB_STORAGE_KEY,
    SETTINGS_TABS[0].id,
    { maxAge: 10 * 60 * 1000, validate: isValidSettingsTabId },
  );

  const [currentTab, setCurrentTab] = React.useState<SettingsTabId>(
    isValidSettingsTabId(tabId) ? tabId : storedTabId,
  );

  React.useEffect(() => {
    if (!isValidSettingsTabId(tabId)) {
      navigate(`/${storedTabId}`, { replace: true });
    } else {
      setCurrentTab(tabId);
      setStoredTabId(tabId);
    }
  }, [tabId, storedTabId, navigate, setStoredTabId]);

  return (
    <div className="flex flex-1 flex-col">
      <div role="tablist" className="mb-8 flex border-b border-gray-200">
        {SETTINGS_TABS.map(({ id, titleKey }) => (
          <Link
            key={id}
            id={`settings-tab-${id}`}
            to={`/${id}`}
            role="tab"
            aria-selected={currentTab === id}
            aria-controls="settings-tabpanel"
            className={cn(
              currentTab === id
                ? 'border-current text-secondary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              'cursor-pointer whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium focus:outline-hidden focus-visible:outline',
            )}
          >
            {t(titleKey)}
          </Link>
        ))}
      </div>

      <div
        id="settings-tabpanel"
        role="tabpanel"
        aria-labelledby={`settings-tab-${currentTab}`}
        className="h-full"
      >
        {children}
      </div>
    </div>
  );
};
