import React from 'react';
import { Button } from '@/pages/shared/components/ui/Button';
import { getBrowserName, type BrowserName } from '@/shared/helpers';
import { useBrowser } from '@/app/lib/context';

export const Component = () => {
  const browser = useBrowser();
  const browserName = getBrowserName(browser, navigator.userAgent);

  return (
    <div
      className="min-h-screen w-full space-y-6 bg-gray-50 p-8 landscape:p-4"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        backgroundSize: '40vmax',
      }}
    >
      <Header />
      <RightCol
        browserName={browserName}
        openPopup={() => browser.action.openPopup({})}
      />
    </div>
  );
};

const Header = () => {
  return (
    <div className="left-6 top-6 flex flex-col items-center landscape:absolute">
      <div className="mb-2">
        <img src="/assets/images/logo.svg" className="w-16" alt="" />
      </div>
      <p className="text-xl font-bold text-secondary-dark">
        Support content you love
      </p>
      <p className="text-xl font-light text-secondary-dark">
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
    <div className="mx-auto flex h-full max-w-lg flex-col gap-6 rounded-lg border border-gray-200 bg-white/75 p-6 shadow-md backdrop-blur-0">
      <header className="rounded-2xl bg-gray-100 p-4 text-center text-lg font-medium">
        Welcome to the Web Monetization extension!
      </header>

      <div className="h-full">
        <Steps browserName={browserName} />
      </div>

      <div className="ml-auto mt-auto">
        <Button onClick={openPopup}>{"Let's Go!"}</Button>
      </div>
    </div>
  );
};

const Steps = ({ browserName }: { browserName: BrowserName }) => {
  return (
    <div>
      <ol className="flex flex-col gap-4">
        <Step
          title={
            <>
              Get a wallet compatible with Web Monetization{' '}
              <a
                href="https://webmonetization.org/docs/resources/op-wallets/"
                title="Web Monetization-enabled wallets"
                target="_blank"
                rel="noreferrer"
                className="pr-1 text-primary"
              >
                <span className="sr-only">list of supported wallets</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="inline-block size-4 align-baseline transition-transform hover:scale-125 focus:scale-125"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
              </a>
            </>
          }
        >
          <img
            src={imgSrc(browserName, {
              chrome: '/assets/images/wallet-signup-1-chrome.png',
              firefox: '/assets/images/wallet-signup-1-firefox.png',
              edge: '/assets/images/wallet-signup-1-edge.png',
            })}
            className="mx-auto w-full max-w-96"
            alt=""
          />
        </Step>

        <Step title={<>Find your wallet address or payment pointer</>}>
          <img
            src="/assets/images/wallet-wallet-address.png"
            alt=""
            className="mx-auto w-full max-w-96"
          />
        </Step>

        <Step title={<>Pin extension to the browser toolbar</>}>
          <img
            src={imgSrc(browserName, {
              chrome: '/assets/images/pin-extension-chrome.png',
              firefox: '/assets/images/pin-extension-firefox.png',
              edge: '/assets/images/pin-extension-edge.png',
            })}
            className="mx-auto w-full max-w-96"
            alt=""
          />
        </Step>
      </ol>
    </div>
  );
};

function Step({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="">
      <details
        name="steps"
        open
        className="group relative space-y-4 overflow-hidden rounded-md border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 open:hover:bg-transparent"
      >
        <summary className="-mx-4 -my-4 flex cursor-pointer items-center gap-2 p-4">
          <svg
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            className="size-5 shrink-0 rounded-full bg-gray-100 p-1 text-gray-500 group-open:rotate-180"
          >
            <path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>

          <h3 className="font-medium text-weak group-open:text-strong">
            {title}
          </h3>
        </summary>

        {children}
      </details>
    </li>
  );
}

function imgSrc(
  browser: BrowserName,
  srcMap: Partial<Record<BrowserName, string>>,
) {
  return srcMap[browser] || srcMap['chrome'] || Object.values(srcMap)[0];
}
