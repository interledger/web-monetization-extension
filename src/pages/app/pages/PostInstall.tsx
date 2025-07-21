import React from 'react';
import {
  ArrowBack,
  CaretDownIcon,
  ExternalIcon,
} from '@/pages/shared/components/Icons';
import { getBrowserName, type BrowserName } from '@/shared/helpers';
import { getResponseOrThrow } from '@/shared/messages';
import { useBrowser, useTranslation } from '@/app/lib/context';
import { ConnectWalletForm } from '@/popup/components/ConnectWalletForm';
import { cn } from '@/pages/shared/lib/utils';
import { useMessage } from '@/app/lib/context';
import { useAppState } from '@/app/lib/store';

export default () => {
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
  logo: { src: string; width: number; height: number };
  walletAddressScreenshot: { src: string; width: number; height: number };
  walletAddressPlaceholder: string;
};

const WALLETS: Array<WalletOption> = [
  {
    id: 'interledger.app',
    name: 'Interledger Wallet',
    url: 'https://interledger.app/',
    logo: {
      src: '/assets/images/logos/interledger-app-logo.svg',
      width: 300,
      height: 74,
    },
    walletAddressScreenshot: {
      src: '/assets/images/wallet-address-interledger.png',
      width: 1500,
      height: 836,
    },
    walletAddressPlaceholder: 'https://ilp.link/my-wallet',
  },
  {
    id: 'gatehub',
    name: 'GateHub Wallet',
    url: 'https://gatehub.net/',
    logo: {
      src: '/assets/images/logos/gatehub-logo.svg',
      width: 300,
      height: 85,
    },
    walletAddressScreenshot: {
      src: '/assets/images/wallet-address-gatehub.png',
      width: 1829,
      height: 984,
    },
    walletAddressPlaceholder: '$ilp.gatehub.net/150012570/usd',
  },
  {
    id: 'chimoney',
    name: 'Chimoney Wallet',
    url: '', // empty URL to ignore it from listing
    logo: {
      src: '/assets/images/logos/chimoney-logo.svg',
      width: 300,
      height: 75,
    },
    walletAddressScreenshot: {
      src: '/assets/images/wallet-address-chimoney.png',
      width: 1500,
      height: 938,
    },
    walletAddressPlaceholder: 'https://ilp.chimoney.com/37294745',
  },
];

const STEP_ID = [
  'get_wallet',
  'get_wallet_address',
  'pin_to_toolbar',
  'give_permissions',
  'connect_wallet',
] as const;
type StepId = (typeof STEP_ID)[number];

const Steps = () => {
  const browser = useBrowser();
  const t = useTranslation();
  const isPinnedToToolbar = usePinnedStatus();
  const browserName = getBrowserName(browser, navigator.userAgent);
  const hasAllHostsPermission = useHasAllHostsPermission();

  const [selectedWallet, setSelectedWallet] = React.useState<WalletOption>(
    WALLETS[0],
  );
  const [isOpen, setIsOpen] = React.useState<StepId>(STEP_ID[0]);
  const onClick = React.useCallback((id: StepId, open: boolean) => {
    setIsOpen((prev) => {
      if (!open) {
        return id;
      }
      const idx = STEP_ID.indexOf(prev);
      return STEP_ID[idx + 1];
    });
  }, []);

  return (
    <ol className="flex flex-col gap-4">
      <Step
        id={STEP_ID[0]}
        index={0}
        open={isOpen === STEP_ID[0]}
        onClick={onClick}
        title={
          <React.Fragment>
            {/*  */}
            <a
              href="https://webmonetization.org/wallets/"
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
              <img {...wallet.logo} alt={wallet.name} className="mx-auto" />
            </a>
          ))}
        </div>
        <p className="text-slate-400 text-sm text-right">
          {t('postInstall_text_stepGetWallet_comingSoon')}
        </p>
      </Step>

      <Step
        id={STEP_ID[1]}
        index={1}
        open={isOpen === STEP_ID[1]}
        onClick={onClick}
        title={t('postInstall_text_stepWalletAddress_title')}
      >
        <img
          {...selectedWallet.walletAddressScreenshot}
          alt={`Screenshot of wallet address for ${selectedWallet.name}`}
          className="mx-auto p-4 shadow-2xl"
        />
      </Step>

      <Step
        id={STEP_ID[2]}
        index={2}
        open={isOpen === STEP_ID[2]}
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
            safari: '/assets/images/pin-extension-safari.mp4',
            edge: '/assets/images/pin-extension-edge.png',
          })}
          className="mx-auto max-w-[90%]"
          style={{ maxHeight: 'max(35vh, 18rem)' }}
          alt=""
        />
      </Step>

      {/* Add this special step for Safari as without this permission beforehand, Safari requires pages being reloaded for extension to work. This can help with other browsers as well (conditioning on whether we've the permissions, instead of just the browserName), but let's do only for Safari for now. */}
      {browserName === 'safari' && (
        <Step
          id={STEP_ID[3]}
          index={3}
          open={isOpen === STEP_ID[3]}
          onClick={onClick}
          title={t('postInstall_text_stepPermissions_title')}
        >
          <p>
            {t('missingHostPermission_state_text')}{' '}
            {hasAllHostsPermission ? (
              <span className="text-secondary-dark">
                {t('postInstall_text_stepPermissions_descComplete')}
              </span>
            ) : (
              <button
                type="button"
                className="block w-fit rounded-md bg-orange-100 px-2 py-1.5 mt-1 font-medium text-orange-800 hover:bg-orange-200 focus:bg-orange-200 focus:outline-none hover:shadow-md focus:shadow-md"
                onClick={() => requestAllHostsPermission(browser)}
              >
                {t('postInstall_action_stepPermissions_grant')}
              </button>
            )}
          </p>
        </Step>
      )}

      <Step
        isPrimaryButton={true}
        id={STEP_ID[4]}
        index={browserName === 'safari' ? 4 : 3}
        open={isOpen === STEP_ID[4]}
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
      if (!('getUserSettings' in browser.action)) {
        // https://bugs.webkit.org/show_bug.cgi?id=294444
        setIsPinnedToToolbar(false);
        return;
      }
      const settings = await browser.action.getUserSettings();
      setIsPinnedToToolbar(settings.isOnToolbar ?? false);
    };

    void check();
    const timer = setInterval(check, 500);

    return () => clearInterval(timer);
  }, [browser]);

  return isPinnedToToolbar;
}

function useHasAllHostsPermission() {
  const browser = useBrowser();
  const [hasAllHostsPermission, setHasAllHostsPermission] =
    React.useState(false);

  React.useEffect(() => {
    const check = async () => {
      const hasPermissions = await browser.permissions.contains({
        origins: browser.runtime.getManifest().host_permissions,
      });
      setHasAllHostsPermission(hasPermissions);
    };

    void check();
    const timer = setInterval(check, 500);

    return () => clearInterval(timer);
  }, [browser]);

  return hasAllHostsPermission;
}

function requestAllHostsPermission(browser: ReturnType<typeof useBrowser>) {
  const origins = browser.runtime.getManifest().host_permissions!;
  return browser.permissions.request({ origins });
}

function Step({
  id,
  index,
  title,
  children,
  onClick,
  open,
  isPrimaryButton = false,
}: {
  id: StepId;
  index: number;
  title: React.ReactNode;
  children: React.ReactNode;
  onClick: (id: StepId, open: boolean) => void;
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
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Not needed here */}
        <summary
          className="-mx-4 -my-4 flex cursor-pointer items-center gap-2 p-4 focus:outline-none"
          onClick={(ev) => {
            // onToggle gets fired when `open` is set (even from prop set on
            // mount). So, we use onClick to catch only user interaction.
            ev.preventDefault(); // parent will set `open` state.
            onClick(id, open);
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
}: {
  selectedWallet: WalletOption;
}) {
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
        getWalletInfo={(walletAddressUrl) =>
          message
            .send('GET_CONNECT_WALLET_ADDRESS_INFO', walletAddressUrl)
            .then(getResponseOrThrow)
        }
        walletAddressPlaceholder={selectedWallet.walletAddressPlaceholder}
        connectWallet={(data) => message.send('CONNECT_WALLET', data)}
        clearConnectState={() => message.send('RESET_CONNECT_STATE')}
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
