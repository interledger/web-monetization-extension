import { cva } from 'class-variance-authority';
import React from 'react';
import { navigate } from 'wouter/use-hash-location';
import { isErrorWithKey } from '@/shared/helpers';
import { useTranslation } from '@/app/lib/context';
import { useAppState } from '@/app/lib/store';
import type {
  WalletStatus,
  WalletStatusCancel,
  WalletStatusFailure,
} from '@/shared/types';

export default function PostConnect() {
  const t = useTranslation();
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

        <p className="text-lg whitespace-pre-wrap">{params.info}</p>

        <div className="flex flex-col gap-3">
          {params.retryPossible === 'auto' && params.retryMessage && (
            <button
              type="button"
              className={ButtonVariants({ variant: 'solid' })}
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

function mapStatusToMessage(
  status: WalletStatus,
  t: ReturnType<typeof useTranslation>,
): MessageParams | null {
  if (status.type === 'progress') {
    throw new Error('Invalid state to show on this page');
  }

  if (status.type === 'success') {
    const { heading, info } = mapSuccessMessage(status);
    return {
      heading,
      info,
      image: getImage('success'),
      retryPossible: false,
      intent: status.intent,
    };
  }

  if (status.type === 'cancel') {
    if (status.code === 'tab_closed') return null;
    const { heading, info } = mapCancelMessage(status);
    return {
      heading,
      info,
      image: getImage('warning'),
      intent: status.intent,
      retryPossible: status.retryPossible,
      retryMessage: status.retryMessage,
    };
  }

  const { heading, info } = mapFailureMessage(status, t);
  return {
    heading,
    info,
    image: getImage('error'),
    intent: status.intent,
    retryPossible: status.retryPossible,
    retryMessage: status.retryMessage,
  };
}

function mapSuccessMessage(
  status: Extract<WalletStatus, { type: 'success' }>,
): MessageContent {
  const SUCCESS_MSGS: Record<WalletStatus['intent'], MessageContent> = {
    connect: {
      heading: 'Wallet Connected!',
      info: 'You’re all set to start using the extension.',
    },
    add_funds: {
      heading: 'Funds Added',
      info: 'Funds were successfully added to your budget.',
    },
    update_budget: {
      heading: 'Budget Updated',
      info: 'Your new spending limits are now active.',
    },
    reconnect: {
      heading: 'Reconnected!',
      info: 'Your wallet is reconnected.',
    },
  };
  return SUCCESS_MSGS[status.intent];
}

function mapCancelMessage(
  status: Extract<WalletStatus, { type: 'cancel' }>,
): MessageContent {
  if (status.code === 'tab_closed') {
    throw new Error('Unexpected status code');
  }

  const CANCEL_MSGS: Record<
    WalletStatus['intent'],
    Record<Exclude<WalletStatusCancel['code'], 'tab_closed'>, MessageContent>
  > = {
    connect: {
      grant_rejected: {
        heading: 'Connection cancelled',
        info: 'Wallet connection was cancelled. Please accept the request next time.',
      },
    },
    add_funds: {
      grant_rejected: {
        heading: 'Fund addition cancelled',
        info: 'No funds were added to your budget.',
      },
    },
    update_budget: {
      grant_rejected: {
        heading: 'Budget update cancelled',
        info: 'Your budget settings were not changed.',
      },
    },
    reconnect: {
      grant_rejected: {
        heading: 'Wallet reconnection cancelled',
        info: 'We couldn’t verify your wallet.',
      },
    },
  };
  return CANCEL_MSGS[status.intent][status.code];
}

function mapFailureMessage(
  status: Extract<WalletStatus, { type: 'failure' }>,
  t: ReturnType<typeof useTranslation>,
): MessageContent {
  const FAILURE_MSGS: Record<
    WalletStatus['intent'],
    (
      code: WalletStatusFailure['code'],
      details: WalletStatusFailure['details'],
    ) => MessageContent
  > = {
    connect(code, details) {
      if (code === 'timeout') {
        return {
          heading: 'Wallet connection timed-out',
          info: 'We couldn’t connect to your wallet provider, as it took longer than expected. Please check your connection and try again.',
        };
      }
      if (code === 'key_add_failed') {
        const infoPlus = isErrorWithKey(details)
          ? t(details.key, [...details.substitutions])
          : details?.message;
        return {
          heading: 'Key addition failed',
          info:
            'We couldn’t add the public key to your wallet.' +
            (infoPlus ? `\n${infoPlus}` : ''),
        };
      }
      return {
        heading: 'Wallet connection failed',
        info: 'Something went wrong while connecting. Please try again.',
      };
    },
    add_funds(code, details) {
      if (code === 'timeout') {
        return {
          heading: 'Funds addition timed-out',
          info: 'We couldn’t add funds to your wallet, as it took longer than expected. Please check your connection and try again.',
        };
      }
      const infoPlus = isErrorWithKey(details)
        ? t(details.key, [...details.substitutions])
        : details?.message;
      return {
        heading: 'Funds addition failed',
        info:
          'Something went wrong while adding funds. Please try again.' +
          (infoPlus ? `\n${infoPlus}` : ''),
      };
    },
    reconnect(code, details) {
      if (code === 'key_add_failed') {
        const infoPlus = isErrorWithKey(details)
          ? t(details.key, [...details.substitutions])
          : details?.message;
        return {
          heading: 'Wallet reconnection failed',
          info:
            'We couldn’t add the public key to your wallet.' +
            (infoPlus ? `\n${infoPlus}` : ''),
        };
      }
      return {
        heading: 'Wallet reconnection failed',
        info: 'We couldn’t verify your wallet. Please ensure the public key is added to your wallet.',
      };
    },
    update_budget(code, details) {
      if (code === 'timeout') {
        return {
          heading: 'Timed-out',
          info: 'We couldn’t update your budget, as it took longer than expected. Please check your connection and try again.',
        };
      }
      const infoPlus = isErrorWithKey(details)
        ? t(details.key, details.substitutions)
        : details?.message;
      return {
        heading: 'Budget update failed',
        info:
          'Something went wrong while updating your budget. Please try again.' +
          (infoPlus ? `\n${infoPlus}` : ''),
      };
    },
  };
  return FAILURE_MSGS[status.intent](status.code, status.details);
}

function getImage(type: 'success' | 'warning' | 'error') {
  return { src: `/assets/images/icons/${type}.svg`, alt: type };
}

type MessageContent = { heading: string; info: string };

type MessageParams = MessageContent & {
  image: { src: string; alt: string };
  intent: WalletStatus['intent'];
  retryPossible: false | 'auto' | 'manual';
  retryMessage?: (WalletStatusCancel | WalletStatusFailure)['retryMessage'];
};
