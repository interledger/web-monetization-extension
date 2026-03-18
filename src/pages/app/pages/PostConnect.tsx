import { cva } from 'class-variance-authority';
import React from 'react';
import { navigate } from 'wouter/use-hash-location';
import { useMessage, useTranslation } from '@/app/lib/context';
import { useAppState } from '@/app/lib/store';
import type {
  WalletStatus,
  WalletStatusCancel,
  WalletStatusFailure,
} from '@/shared/types';

export default function PostConnect() {
  const t = useTranslation();
  const message = useMessage();
  const { transientState } = useAppState();

  if (!transientState.connect || transientState.connect.type === 'progress') {
    return <p>Nothing to see here</p>;
  }

  const params = mapStatusToMessage(transientState.connect as WalletStatus, t);
  if (!params) {
    return <p>No mapping from status to messages!!</p>;
  }

  return (
    <div className="bg-white md:bg-gray-50 flex h-screen w-screen flex-col items-center justify-center gap-6 md:gap-14 p-3 md:p-4">
      <header className="flex gap-2 items-center w-fit mx-auto mt-8 md:mt-16 md:mb-14 text-center">
        <img
          src="/assets/images/logo.svg"
          alt="Web Monetization"
          className="h-6 md:h-16"
        />
        <h1 className="text-base md:text-4xl font-bold text-secondary-dark">
          Web Monetization extension
        </h1>
      </header>

      <div className="md:p-8 md:border rounded-lg bg-white bg-opacity-75 border-gray-100 mb-auto flex flex-col items-center gap-6 text-center w-full md:w-[42rem]">
        <img
          className="h-8 w-8 md:w-32 md:h-32"
          src={params.image.src}
          alt={params.image.alt}
        />

        <h2 className="text-3xl md:text-4xl font-bold">{params.heading}</h2>

        <p className="text-lg">{params.info}</p>

        <div className="flex flex-col gap-3">
          {params.retryPossible === 'auto' && params.retryMessage && (
            <button
              type="button"
              className={ButtonVariants({ variant: 'solid' })}
              onClick={() => {
                const { action, payload } = params.retryMessage!;
                return message.send(action, payload);
              }}
            >
              Try again
            </button>
          )}

          {params.retryPossible && params.intent === 'connect' && (
            // biome-ignore lint/a11y/useValidAnchor: link is used for handling behaviors like right-click to open in new tab, copying link address, etc.
            <a
              href="/pages/app/index.html#post-install"
              onClick={(ev) => {
                ev.preventDefault();
                navigate('#post-install', { state: { focusConnect: true } });
              }}
              className={ButtonVariants({
                variant: params.retryPossible === 'auto' ? 'outline' : 'solid',
              })}
            >
              Change the wallet address or budget amount
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const ButtonVariants = cva(
  'border border-popup px-6 py-3 rounded-xl w-full md:w-96 text-base',
  {
    variants: {
      variant: {
        solid: 'bg-button-base text-white',
        outline: 'bg-white text-secondary-dark',
      },
    },
  },
);

// Most of following will be removed soon as we look into better message passing
// instead of being limited by URL parameters.
function mapStatusToMessage(
  status: WalletStatus,
  t: ReturnType<typeof useTranslation>,
): MessageParams | null {
  if (status.type === 'progress') {
    throw new Error('Invalid state to show on this page');
  }

  type Intent = WalletStatus['intent'];

  const DEFAULT_ERROR_MESSAGE = (intent: Intent) => {
    if (intent === 'add_funds') {
      return 'Something went wrong. Please try adding funds again.';
    }
    if (intent === 'update_budget') {
      return 'Something went wrong. Please try updating your budget again.';
    }
    return 'Something went wrong. Please try reconnecting your wallet.';
  };
  const CLOSE_TAB_MESSAGE = 'You may safely close this tab.';

  const ERROR_MESSAGES: Record<
    WalletStatusFailure['code'],
    (intent: Intent) => string
  > = {
    grant_continuation_failed(intent: Intent): string {
      if (intent === 'add_funds') {
        return 'An error occurred. Please try adding funds again.';
      }
      if (intent === 'update_budget') {
        return 'An error occurred. Please try updating your budget again.';
      }
      return 'An error occurred. Please try reconnecting the wallet.';
    },
    grant_hash_failed(intent: Intent): string {
      if (intent === 'add_funds') {
        return 'An error occurred. Please try adding funds again.';
      }
      if (intent === 'update_budget') {
        return 'An error occurred. Please try updating your budget again.';
      }
      return 'An error occurred. Please try reconnecting the wallet.';
    },
    key_add_failed(): string {
      return 'Something went wrong with your request. Please try reconnecting your wallet.';
    },
    grant_invalid(intent: Intent): string {
      if (intent === 'add_funds') {
        return 'Something went wrong with your request. Please try adding funds again.';
      }
      if (intent === 'update_budget') {
        return 'Something went wrong with your request. Please try updating your budget again.';
      }
      return 'Something went wrong with your request. Please try reconnecting your wallet.';
    },
    timeout(_intent: Intent): string {
      return t('connectWallet_error_timeout');
    },
    unknown(_intent: Intent): string {
      return t('connectWallet_error_grantInvalid'); // TODO
    },
  };

  const CANCEL_MESSAGES: Record<
    WalletStatusCancel['code'],
    (intent: Intent) => string
  > = {
    grant_rejected(intent) {
      if (intent === 'add_funds') {
        return 'No funds were added.';
      }
      if (intent === 'update_budget') {
        return 'Your budget was not updated.';
      }
      return 'Your request was successfully rejected.';
    },
    tab_closed() {
      return 'The tab was closed.';
    },
  };

  const MESSAGES = {
    grant_success(intent: Intent): string {
      if (intent === 'add_funds') {
        return 'You have successfully added more funds.';
      }
      if (intent === 'update_budget') {
        return 'You have successfully updated your budget.';
      }
      return 'Your wallet is now successfully connected to the extension.';
    },
    key_add_success(): string {
      return 'Your wallet is now successfully reconnected to the extension.';
    },
    grant_rejected(intent: Intent): string {
      if (intent === 'add_funds') {
        return 'No funds were added.';
      }
      if (intent === 'update_budget') {
        return 'Your budget was not updated.';
      }
      return 'Your request was successfully rejected.';
    },
  };

  if (status.type === 'success') {
    return {
      heading: 'Success',
      info: MESSAGES.grant_success(status.intent),
      image: getImage('success'),
      retryPossible: false,
      intent: status.intent,
    };
  }

  if (status.type === 'cancel') {
    return {
      heading: CANCEL_MESSAGES[status.code](status.intent),
      info: CLOSE_TAB_MESSAGE,
      image: getImage('warning'),
      intent: status.intent,
      retryPossible: status.intent === 'connect' ? status.retryPossible : false,
      retryMessage: status.retryMessage,
    };
  }

  return {
    heading: ERROR_MESSAGES[status.code](status.intent),
    info: status.code,
    image: getImage('error'),
    intent: status.intent,
    retryPossible: status.retryPossible,
    retryMessage: status.retryMessage,
  };

  function getImage(type: 'success' | 'error' | 'warning') {
    return { src: `/assets/images/icons/${type}.svg`, alt: type };
  }
}

type MessageParams = {
  image: { src: string; alt: string };
  heading: string;
  info: string;
  intent: WalletStatus['intent'];
  retryPossible: false | 'auto' | 'manual';
  retryMessage?: (WalletStatusCancel | WalletStatusFailure)['retryMessage'];
};
