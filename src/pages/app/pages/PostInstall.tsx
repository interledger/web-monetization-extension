import React from 'react';
import {
  ArrowBack,
  CaretDownIcon,
  ExternalIcon,
} from '@/pages/shared/components/Icons';
import {
  cn,
  getBrowserName,
  getWalletInformation,
  type BrowserName,
} from '@/shared/helpers';
import { useBrowser, useTranslation } from '@/app/lib/context';
import { ConnectWalletForm } from '@/popup/components/ConnectWalletForm';
import { useMessage } from '@/app/lib/context';
import { useAppState } from '@/app/lib/store';

export const Component = () => {
  return (
    <div
      className="flex min-h-screen flex-col items-center bg-fixed sm:overflow-hidden landscape:justify-center"
      style={{
        backgroundImage: `url("/assets/images/bg-tile.svg")`,
        backgroundSize: '40vmax',
      }}
    >
      <div className="flex min-h-screen w-full max-w-screen-2xl flex-1 grid-cols-2 flex-col items-stretch gap-6 p-3 sm:p-8 landscape:grid landscape:p-4">
        <Header />
        <div className="flex items-center">
          <Main />
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  const t = useTranslation();
  return (
    <div className="text-center landscape:mt-[33vh]">
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

const Main = () => {
  const t = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-lg border border-gray-200 bg-gray-50/75 p-3 shadow-md backdrop-blur-0 sm:p-8">
      <h2 className="rounded-sm bg-gray-100 p-2 text-center text-base font-medium sm:rounded-2xl sm:p-4 sm:text-lg">
        {t('postInstall_text_title')}
      </h2>

      <Steps />
    </div>
  );
};

type WalletOption = {
  id: string;
  name: string;
  url: string;
  logo: { path: string; width: number; height: number };
  keyScreenshot: { path: string; width: number; height: number };
  walletAddressPlaceholder: string;
};

const WALLETS: Array<WalletOption> = [
  {
    id: 'interledger.app',
    name: 'Interledger Wallet',
    url: 'https://interledger.app/signup',
    logo: {
      path: '/assets/images/logos/interledger-app-logo.svg',
      width: 300,
      height: 74,
    },
    keyScreenshot: {
      path: '/assets/images/wallet-address-interledger.png',
      width: 1500,
      height: 836,
    },
    walletAddressPlaceholder: 'https://fynbos.me/my-wallet',
  },
  {
    id: 'gatehub',
    name: 'GateHub Wallet',
    url: '', // empty URL to ignore it from listing
    logo: {
      path: '/assets/images/logos/gatehub-logo.svg',
      width: 300,
      height: 85,
    },
    keyScreenshot: {
      path: '/assets/images/wallet-address-gatehub.png',
      width: 1829,
      height: 984,
    },
    walletAddressPlaceholder: '$ilp.gatehub.net/150012570/USD',
  },
  {
    id: 'chimoney',
    name: 'Chimoney Wallet',
    url: '', // empty URL to ignore it from listing
    logo: {
      path: '/assets/images/logos/chimoney-logo.svg',
      width: 300,
      height: 75,
    },
    keyScreenshot: {
      path: '/assets/images/wallet-address-chimoney.png',
      width: 1500,
      height: 938,
    },
    walletAddressPlaceholder: 'https://ilp.chimoney.com/37294745',
  },
];

const Steps = () => {
  const browser = useBrowser();
  const t = useTranslation();
  const isPinnedToToolbar = usePinnedStatus();
  const browserName = getBrowserName(browser, navigator.userAgent);

  const [selectedWallet, setSelectedWallet] =
    React.useState<WalletOption | null>(null);
  const keyScreenshot = selectedWallet?.keyScreenshot?.path
    ? selectedWallet.keyScreenshot
    : WALLETS[0].keyScreenshot;
  const [isOpen, setIsOpen] = React.useState(0);
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
            <a
              href="https://webmonetization.org/docs/resources/op-wallets/"
              target="_blank"
              rel="noreferrer"
              className="group pr-1 text-primary outline-current hover:underline"
              onClick={(ev) => ev.stopPropagation()}
            >
              {t('postInstall_text_stepGetWallet_title')}{' '}
              <ExternalIcon className="inline-block size-4 align-baseline transition-transform hover:scale-125 group-focus:scale-125" />
            </a>
          </React.Fragment>
        }
      >
        <p>{t('postInstall_text_stepGetWallet_desc')}</p>
        <div
          className={cn(
            'grid gap-4 justify-center mt-4 mx-auto group/wallet',
            WALLETS.filter((w) => !!w.url).length < 2 && 'w-fit',
          )}
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, min-content))',
          }}
        >
          {WALLETS.map((wallet) => (
            <a
              key={wallet.id}
              href={wallet.url}
              target="_blank"
              title={wallet.name}
              rel="noreferrer"
              className={cn(
                { hidden: !wallet.url },
                'sm:p-2 p-4 shadow max-w-72 rounded-md',
                'hover:shadow-lg hover:scale-105 transition-[transform,box-shadow] duration-300 ease-in-out',
                'group-hover/wallet:opacity-25 group-focus-within/wallet:hover:opacity-25 group-focus-within/wallet:opacity-25',
                'group-hover/wallet:hover:opacity-100',
                'group-focus-within/wallet:focus:opacity-100 focus:hover:opacity-100',
              )}
              onClick={() => setSelectedWallet(wallet)}
            >
              <img
                src={wallet.logo.path}
                width={wallet.logo.width}
                height={wallet.logo.height}
                alt={wallet.name}
                className="mx-auto"
              />
            </a>
          ))}
        </div>
        <p className="text-slate-400 text-sm text-right">
          {t('postInstall_text_stepGetWallet_comingSoon')}
        </p>
      </Step>

      <Step
        index={1}
        open={isOpen === 1}
        onClick={onClick}
        title={t('postInstall_text_stepWalletAddress_title')}
      >
        <img
          src={keyScreenshot.path}
          width={keyScreenshot.width}
          height={keyScreenshot.height}
          alt=""
          className="mx-auto p-4 shadow-2xl"
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
          className="mx-auto max-w-[90%]"
          style={{ maxHeight: 'max(35vh, 18rem)' }}
          alt=""
        />
      </Step>

      <Step
        isPrimaryButton={true}
        index={3}
        open={isOpen === 3}
        onClick={onClick}
        title={t('postInstall_action_submit')}
      >
        <StepConnectWallet selectedWallet={selectedWallet} />
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
  isPrimaryButton = false,
}: {
  index: number;
  title: React.ReactNode;
  children: React.ReactNode;
  onClick: (index: number, open: boolean) => void;
  open: boolean;
  isPrimaryButton?: boolean;
}) {
  const iconDefaultClass = 'size-5 shrink-0 rounded-full p-1';
  return (
    <li>
      <details
        open={open}
        className={cn(
          'group relative gap-2 space-y-4 overflow-hidden rounded-md border border-slate-200 p-2 text-base transition-colors open:shadow-sm focus-within:border-slate-300 focus-within:shadow-md open:hover:bg-white sm:p-4 sm:text-lg',
          isPrimaryButton && 'duration-0',
          isPrimaryButton && !open
            ? 'bg-button-base text-white hover:bg-button-base-hover'
            : 'bg-white text-weak hover:bg-slate-50',
        )}
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Not needed here */}
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
          <h3 className="w-full text-base group-open:text-strong sm:text-lg">
            {title}
          </h3>
          {!isPrimaryButton ? (
            <CaretDownIcon
              className={cn(
                iconDefaultClass,
                'bg-slate-100 text-slate-500 group-open:rotate-180',
              )}
            />
          ) : (
            <ArrowBack
              className={cn(
                iconDefaultClass,
                'rotate-180 bg-white/5 text-white',
              )}
            />
          )}
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

function StepConnectWallet({
  selectedWallet,
}: { selectedWallet: WalletOption | null }) {
  const message = useMessage();
  const t = useTranslation();
  const {
    transientState: { connect: connectState },
    connected,
    publicKey,
  } = useAppState();

  if (connected) {
    return (
      <div className="text-center pt-4 pb-8">
        <p className="font-medium text-secondary-dark landscape:mb-2 landscape:text-xl landscape:2xl:mb-3 landscape:2xl:text-xl">
          {t('postInstall_text_wallet_connected_1')}
        </p>
        <p className="text-secondary-dark landscape:text-xl landscape:2xl:text-xl">
          {t('postInstall_text_wallet_connected_2')}
        </p>
      </div>
    );
  }

  return (
    <div className="h-popup mx-auto w-popup pt-4 overflow-hidden">
      <ConnectWalletForm
        publicKey={publicKey}
        state={connectState}
        defaultValues={{
          recurring:
            localStorage?.getItem('connect.recurring') === 'true' || false,
          amount: localStorage?.getItem('connect.amount') || undefined,
          walletAddressUrl:
            localStorage?.getItem('connect.walletAddressUrl') || undefined,
          autoKeyAddConsent:
            localStorage?.getItem('connect.autoKeyAddConsent') === 'true',
        }}
        saveValue={(key, val) => {
          localStorage?.setItem(`connect.${key}`, val.toString());
        }}
        getWalletInfo={getWalletInformation}
        walletAddressPlaceholder={selectedWallet?.walletAddressPlaceholder}
        connectWallet={(data) => message.send('CONNECT_WALLET', data)}
        clearConnectState={() => message.send('CONNECT_WALLET', null)}
      />
    </div>
  );
}

function imgSrc(
  browser: BrowserName,
  srcMap: Partial<Record<BrowserName, string>>,
) {
  return srcMap[browser] || srcMap.chrome || Object.values(srcMap)[0];
}
