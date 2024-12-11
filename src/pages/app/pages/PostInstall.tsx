import React from 'react';
import { Button } from '@/pages/shared/components/ui/Button';
import { getBrowserName, type BrowserName } from '@/shared/helpers';
import { useBrowser } from '@/app/lib/context';

export const Component = () => {
  const browser = useBrowser();
  const browserName = getBrowserName(browser, navigator.userAgent);

  return (
    <div
      className="flex h-full min-h-screen flex-col items-center landscape:justify-center"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        backgroundSize: '40vmax',
      }}
    >
      <div className="flex min-h-full w-full max-w-screen-2xl grid-flow-col-dense flex-col content-between items-center gap-6 p-8 landscape:grid landscape:p-4">
        <Header />
        <Main
          browserName={browserName}
          openPopup={() => browser.action.openPopup({})}
        />
      </div>
    </div>
  );
};

const Header = () => {
  return (
    <div className="text-center">
      <img
        src="/assets/images/logo.svg"
        className="mx-auto mb-4 w-16 text-center landscape:w-36 landscape:2xl:w-48"
        alt=""
      />
      <p className="text-xl font-bold text-secondary-dark landscape:mb-2 landscape:text-3xl landscape:2xl:mb-3 landscape:2xl:text-4xl">
        Support content you love
      </p>
      <p className="text-xl font-light text-secondary-dark landscape:text-3xl landscape:2xl:text-4xl">
        Pay as you browse
      </p>
    </div>
  );
};

const Main = ({
  browserName,
  openPopup,
}: {
  browserName: BrowserName;
  openPopup: () => Promise<void>;
}) => {
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-6 rounded-lg border border-gray-200 bg-gray-50/75 p-8 shadow-md backdrop-blur-0">
      <h2 className="rounded-2xl bg-gray-100 p-4 text-center text-lg font-medium">
        Welcome to the Web Monetization extension!
      </h2>

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
              className="group pr-1 text-primary outline-current"
            >
              <span className="sr-only">list of supported wallets</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={1.5}
                stroke="currentColor"
                className="inline-block size-4 align-baseline transition-transform hover:scale-125 group-focus:scale-125"
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

      <Step open title={<>Pin extension to the browser toolbar</>}>
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
  );
};

function Step({
  open = false,
  title,
  children,
}: {
  open?: boolean;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li>
      <details
        name="steps"
        open={open}
        className="group relative space-y-4 overflow-hidden rounded-md border border-slate-200 bg-white p-4 transition-colors open:shadow-sm focus-within:border-slate-300 focus-within:shadow-md hover:bg-slate-50 open:hover:bg-white"
      >
        <summary className="-mx-4 -my-4 flex cursor-pointer items-center gap-2 p-4 focus:outline-none">
          <svg
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            className="size-5 shrink-0 rounded-full bg-slate-100 p-1 text-slate-500 group-open:rotate-180"
          >
            <path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>

          <h3 className="text-lg text-weak group-open:text-strong">{title}</h3>
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
