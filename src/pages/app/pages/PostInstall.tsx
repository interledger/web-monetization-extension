import React from 'react';
import { Button } from '@/pages/shared/components/ui/Button';
import {
  CaretDownIcon,
  CheckIcon,
  ExternalIcon,
} from '@/pages/shared/components/Icons';
import { getBrowserName, type BrowserName } from '@/shared/helpers';
import { useBrowser, useTranslation } from '@/app/lib/context';

export const Component = () => {
  const browser = useBrowser();

  return (
    <div
      className="flex h-screen flex-col items-center overflow-hidden landscape:justify-center"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        backgroundSize: '40vmax',
      }}
    >
      <div className="flex max-h-full w-full max-w-screen-2xl grid-flow-col-dense flex-col content-between items-center gap-6 p-8 landscape:grid landscape:p-4">
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
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-6 overflow-hidden rounded-lg border border-gray-200 bg-gray-50/75 p-8 shadow-md backdrop-blur-0">
      <h2 className="rounded-2xl bg-gray-100 p-4 text-center text-lg font-medium">
        {t('postInstall_text_title')}
      </h2>

      <div className="h-full overflow-y-auto">
        <Steps />
      </div>

      <div className="ml-auto mt-auto">
        <Button onClick={openPopup}>{t('postInstall_action_submit')}</Button>
      </div>
    </div>
  );
};

const Steps = () => {
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

      <Step
        index={1}
        open={isOpen === 1}
        onClick={onClick}
        title={t('postInstall_text_stepWalletAddress_title')}
      >
        <img
          src="/assets/images/wallet-wallet-address.png"
          alt=""
          className="mx-auto w-full max-w-96"
        />
      </Step>

      <Step
        index={2}
        open={isOpen === 2}
        onClick={onClick}
        title={
          <React.Fragment>
            {t('postInstall_text_stepPin_title')}
            {isPinnedToToolbar && (
              <CheckIcon
                strokeWidth={2}
                className="float-right mt-1 inline-block size-5 text-secondary-dark"
              />
            )}
          </React.Fragment>
        }
      >
        <p>{t('postInstall_text_stepPin_desc')}</p>
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
        className="group relative space-y-4 overflow-hidden rounded-md border border-slate-200 bg-white p-4 transition-colors open:shadow-sm focus-within:border-slate-300 focus-within:shadow-md hover:bg-slate-50 open:hover:bg-white"
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
          <CaretDownIcon className="size-5 shrink-0 rounded-full bg-slate-100 p-1 text-slate-500 group-open:rotate-180" />
          <h3 className="w-full text-lg text-weak group-open:text-strong">
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
