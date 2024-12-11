import React from 'react';
import { Button } from '@/pages/shared/components/ui/Button';
import { getBrowserName, type BrowserName } from '@/shared/helpers';
import { useBrowser } from '@/app/lib/context';

export const Component = () => {
  const browser = useBrowser();
  const browserName = getBrowserName(browser, navigator.userAgent);

  return (
    <div
      className="grid h-screen w-full grid-cols-2 p-12"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        backgroundSize: '50rem',
      }}
    >
      <LeftCol />
      <RightCol
        browserName={browserName}
        openPopup={() => browser.action.openPopup({})}
      />
    </div>
  );
};

const LeftCol = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <div className="mb-6">
        <img src="/assets/images/logo.svg" className="w-60" alt="" />
      </div>
      <p className="text-5xl font-bold text-secondary-dark">
        Support content you love
      </p>
      <p className="text-5xl font-light text-secondary-dark">
        Pay as you browse
      </p>
    </div>
  );
};

const RightCol = ({
  browserName,
  openPopup,
}: {
  browserName: BrowserName;
  openPopup: () => Promise<void>;
}) => {
  return (
    <div className="flex h-full flex-col gap-6 bg-gray-50 px-10 py-6">
      <header className="rounded-2xl bg-gray-100 p-6 text-xl">
        Welcome to your Web Monetization extension!
      </header>

      <p className="bg-gray-100 p-6">
        Get ready to start using Web Monetization! Don’t worry we’ve got helpful{' '}
        <a href="https://webmonetization.org" target="_blank" rel="noreferrer">
          links and resources
        </a>{' '}
        to guide you. Here are few things you’ll need before setting up your
        extension:
      </p>

      <div className="h-full bg-white p-4 outline outline-gray-100">
        <Steps browserName={browserName} />
      </div>

      <div className="ml-auto mt-auto px-6">
        <Button onClick={openPopup}>{"Let's Go!"}</Button>
      </div>
    </div>
  );
};

const Steps = ({ browserName }: { browserName: BrowserName }) => {
  return (
    <div>
      <ol className="grid grid-cols-2 gap-6">
        <li>
          <span className="text-xs text-weak" aria-hidden="true">
            Step 1
          </span>
          <p className="">
            Get a digital wallet compatible with Web Monetization from{' '}
            <a href="https://webmonetization.org/docs/resources/op-wallets/">
              here
            </a>
          </p>
        </li>

        <li>
          <span className="text-xs text-weak" aria-hidden="true">
            Step 2
          </span>
          <p className="">Find your wallet address or payment pointer</p>
        </li>

        <li>
          <span className="text-xs text-weak" aria-hidden="true">
            Step 3
          </span>

          <p className="">Pin your extension</p>

          <img
            src={imgSrc(browserName, {
              chrome: '/assets/images/pin-extension-chrome.png',
              firefox: '/assets/images/pin-extension-firefox.png',
              edge: '/assets/images/pin-extension-edge.png',
            })}
            className="mx-auto w-full max-w-96"
            alt=""
          />
        </li>

        <li>
          <span className="text-xs text-weak" aria-hidden="true">
            Step 4
          </span>
          <p className="">
            You’re all ready! Go ahead and set up your extension
          </p>
        </li>
      </ol>
    </div>
  );
};

function imgSrc(
  browser: BrowserName,
  srcMap: Partial<Record<BrowserName, string>>,
) {
  return srcMap[browser] || srcMap['chrome'] || Object.values(srcMap)[0];
}
