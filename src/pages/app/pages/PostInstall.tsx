import React from 'react';
import { Button } from '@/pages/shared/components/ui/Button';
import {
  ArrowBack,
  CaretDownIcon,
  ExternalIcon,
} from '@/pages/shared/components/Icons';
import { getBrowserName, type BrowserName } from '@/shared/helpers';
import { useBrowser, useTranslation } from '@/app/lib/context';

export const Component = () => {
  const browser = useBrowser();

  return (
    <div
      className="flex min-h-screen flex-col items-center sm:overflow-hidden landscape:justify-center"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        backgroundSize: '40vmax',
      }}
    >
      <div className="flex max-h-full w-full max-w-screen-2xl grid-flow-col-dense flex-col content-between items-center gap-6 p-3 sm:p-8 landscape:grid landscape:p-4">
        <Header />
        <Main openPopup={() => browser.action.openPopup({})} />
      </div>
    </div>
  );
};

const Header = () => {
  const t = useTranslation();
  return (
    <div className="text-center">
      <img
        src="/assets/images/logo.svg"
        className="mx-auto mb-4 w-16 text-center landscape:w-36 landscape:2xl:w-48"
        alt=""
      />
      <p className="text-xl font-bold text-secondary-dark landscape:mb-2 landscape:text-3xl landscape:2xl:mb-3 landscape:2xl:text-4xl">
        {t('tagline_text_1')}
      </p>
      <p className="text-xl font-light text-secondary-dark landscape:text-3xl landscape:2xl:text-4xl">
        {t('tagline_text_2')}
      </p>
    </div>
  );
};

const Main = ({ openPopup }: { openPopup: () => Promise<void> }) => {
  const t = useTranslation();
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-6 rounded-lg border border-gray-200 bg-gray-50/75 p-3 shadow-md backdrop-blur-0 sm:overflow-y-auto sm:p-8">
      <h2 className="rounded-sm bg-gray-100 p-2 text-center text-base font-medium sm:rounded-2xl sm:p-4 sm:text-lg">
        {t('postInstall_text_title')}
      </h2>

      <Steps openPopup={openPopup} />
    </div>
  );
};

const Steps = ({ openPopup }: { openPopup: () => Promise<void> }) => {
  const browser = useBrowser();
  const t = useTranslation();
  const isPinnedToToolbar = usePinnedStatus();
  const [isOpen, setIsOpen] = React.useState(0);
  const browserName = getBrowserName(browser, navigator.userAgent);

  const onClick = React.useCallback((index: number, open: boolean) => {
    setIsOpen((prev) => (!open ? index : prev + 1));
  }, []);

  return (
    <ol className="flex flex-col gap-4">
      <Step
        index={0}
        open={isOpen === 0}
        onClick={onClick}
        title={
          <React.Fragment>
            {t('postInstall_text_stepGetWallet_title')}{' '}
            <a
              href="https://webmonetization.org/docs/resources/op-wallets/"
              title="Web Monetization-enabled wallets"
              target="_blank"
              rel="noreferrer"
              className="group pr-1 text-primary outline-current"
              onClick={(ev) => ev.stopPropagation()}
            >
              <span className="sr-only">list of supported wallets</span>
              <ExternalIcon className="inline-block size-4 align-baseline transition-transform hover:scale-125 group-focus:scale-125" />
            </a>
          </React.Fragment>
        }
      >
        <a
          href="https://interledger.app/signup"
          target="_blank"
          rel="noreferrer"
        >
          <img
            src="/assets/images/wallet-signup.png"
            className="mx-auto"
            alt=""
          />
        </a>
      </Step>

      <Step
        index={1}
        open={isOpen === 1}
        onClick={onClick}
        title={t('postInstall_text_stepWalletAddress_title')}
      >
        <img
          src="/assets/images/wallet-wallet-address.png"
          alt=""
          className="mx-auto max-w-[90%] shadow-2xl p-4"
        />
      </Step>

      <Step
        index={2}
        open={isOpen === 2}
        onClick={onClick}
        title={t('postInstall_text_stepPin_title')}
      >
        <p>
          {t('postInstall_text_stepPin_desc')}
          {isPinnedToToolbar && (
            <span> {t('postInstall_text_stepPin_descComplete')}</span>
          )}
        </p>
        <img
          src={imgSrc(browserName, {
            chrome: '/assets/images/pin-extension-chrome.png',
            firefox: '/assets/images/pin-extension-firefox.png',
            edge: '/assets/images/pin-extension-edge.png',
          })}
          className="mx-auto max-w-sm"
          style={{ maxHeight: 'max(35vh, 18rem)' }}
          alt=""
        />
      </Step>

      <li>
        <div>
          <Button
            className="flex w-full justify-start gap-2 rounded-md p-2 text-base text-white sm:p-4 sm:text-lg"
            onClick={() => {
              setIsOpen(-1);
              return openPopup();
            }}
          >
            <StepNumber number={4} />
            {t('postInstall_action_submit')}
            <ArrowBack className="ml-auto size-5 shrink-0 rotate-180 rounded-full bg-white/5 p-1 text-white" />
          </Button>
        </div>
      </li>
    </ol>
  );
};

function usePinnedStatus() {
  const browser = useBrowser();
  const [isPinnedToToolbar, setIsPinnedToToolbar] = React.useState(false);

  React.useEffect(() => {
    const check = async () => {
      const settings = await browser.action.getUserSettings();
      setIsPinnedToToolbar(settings.isOnToolbar ?? false);
    };

    void check();
    const timer = setInterval(check, 500);

    return () => clearInterval(timer);
  }, [browser]);

  return isPinnedToToolbar;
}

function Step({
  index,
  title,
  children,
  onClick,
  open,
}: {
  index: number;
  title: React.ReactNode;
  children: React.ReactNode;
  onClick: (index: number, open: boolean) => void;
  open: boolean;
}) {
  return (
    <li>
      <details
        open={open}
        className="group relative space-y-4 overflow-hidden rounded-md border border-slate-200 bg-white p-2 transition-colors open:shadow-sm focus-within:border-slate-300 focus-within:shadow-md hover:bg-slate-50 open:hover:bg-white sm:p-4"
      >
        <summary
          className="-mx-4 -my-4 flex cursor-pointer items-center gap-2 p-4 focus:outline-none"
          onClick={(ev) => {
            // onToggle gets fired when `open` is set (even from prop set on
            // mount). So, we use onClick to catch only user interaction.
            ev.preventDefault(); // parent will set `open` state.
            onClick(index, open);
          }}
        >
          <StepNumber number={index + 1} />
          <h3 className="w-full text-base text-weak group-open:text-strong sm:text-lg">
            {title}
          </h3>
          <CaretDownIcon className="size-5 shrink-0 rounded-full bg-slate-100 p-1 text-slate-500 group-open:rotate-180" />
        </summary>

        {children}
      </details>
    </li>
  );
}

function StepNumber({ number }: { number: number }) {
  return (
    <span className="inline-block shrink-0 rounded-lg bg-black/5 p-1 align-middle text-sm outline outline-1 outline-gray-800/10">
      <span className="sr-only">Step </span>
      {number}.
    </span>
  );
}

function imgSrc(
  browser: BrowserName,
  srcMap: Partial<Record<BrowserName, string>>,
) {
  return srcMap[browser] || srcMap['chrome'] || Object.values(srcMap)[0];
}
