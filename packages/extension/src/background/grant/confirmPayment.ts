import { tabs } from 'webextension-polyfill';

const getCurrentActiveTabId = async () => {
  const activeTabs = await tabs.query({ active: true, currentWindow: true });
  return activeTabs[0].id;
};

export const confirmPayment = async (url: string) => {
  const currentTabId = await getCurrentActiveTabId();

  return await new Promise<string>(resolve => {
    if (url) {
      tabs.create({ url }).then(tab => {
        if (tab.id) {
          tabs.onUpdated.addListener((tabId, changeInfo) => {
            try {
              const tabUrl = new URL(changeInfo.url || '');
              const interactRef = tabUrl.searchParams.get('interact_ref');

              if (tabId === tab.id && interactRef) {
                tabs.update(currentTabId, { active: true });
                tabs.remove(tab.id);
                resolve(interactRef);
              }
            } catch (e) {
              throw new Error('Invalid interact ref url.');
            }
          });
        }
      });
    }
  });
};
