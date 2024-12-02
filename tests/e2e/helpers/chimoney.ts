import type { Page } from '@playwright/test';

export const URLS = {
  get login() {
    return `${process.env.CHIMONEY_WALLET_URL}/auth/signin`;
  },
  get keyPage() {
    return `${process.env.CHIMONEY_WALLET_URL}/interledger`;
  },
};

export const DEFAULT_CONTINUE_WAIT_MS = 1000;

type GetWalletAddressKeysResponse = {
  status: string;
  data: {
    node: {
      id: string;
      jwk: { kid: string };
      revoked: boolean;
      createdAt: string;
    };
  }[];
};

export async function revokeKey(page: Page, jwkKeyId: string) {
  await page.goto(URLS.keyPage);

  // The auth token changes on each page load?!
  const authToken = await page.evaluate(() => {
    // Same as from src/content/keyAutoAdd/chimoney.ts
    const getAuthToken = (): string => {
      const getFirebaseAuthKey = () => {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith('firebase:authUser:')) {
            return key;
          }
        }
      };

      const key = getFirebaseAuthKey();
      if (!key) {
        throw new Error('No Firebase auth key found');
      }
      const firebaseDataStr = sessionStorage.getItem(key);
      if (!firebaseDataStr) {
        throw new Error('No Firebase auth data found');
      }
      const firebaseData: {
        stsTokenManager: {
          accessToken: string;
          refreshToken: string;
          expirationTime: number;
        };
      } = JSON.parse(firebaseDataStr);
      const token = firebaseData?.stsTokenManager?.accessToken;
      if (!token) {
        throw new Error('No Firebase auth token found');
      }
      const JWT_REGEX =
        /^([A-Za-z0-9-_=]{2,})\.([A-Za-z0-9-_=]{2,})\.([A-Za-z0-9-_=]{2,})$/;
      if (!JWT_REGEX.test(token)) {
        throw new Error('Invalid Firebase auth token');
      }
      return token;
    };
    return getAuthToken();
  });

  const walletAddressId = await page.evaluate(async () => {
    // Same as from src/content/keyAutoAdd/chimoney.ts
    // A Firebase request will set this field eventually. We wait max 6s for that.
    let attemptToFindWalletAddressId = 0;
    while (++attemptToFindWalletAddressId < 12) {
      const walletAddressId = sessionStorage.getItem('walletAddressId');
      if (walletAddressId) return walletAddressId;
      await new Promise((res) => setTimeout(res, 500));
    }
    throw new Error('No walletAddressId found in sessionStorage');
  });

  const keyId = await page.evaluate(
    async ({ walletAddressId, authToken, jwkKeyId }) => {
      const url = `/api/interledger/get-user-wallet-address-keys?walletAddressId=${walletAddressId}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data: GetWalletAddressKeysResponse = await res.json();

      return data.data.find((e) => e.node.jwk.kid === jwkKeyId)?.node.id;
    },
    { walletAddressId, authToken, jwkKeyId },
  );
  if (!keyId) {
    throw new Error(`Key corresponding to JWK kid="${jwkKeyId}" not found`);
  }

  const revokeInfo = { keyId, authToken };

  return await page.evaluate(async (revokeInfo) => {
    const res = await fetch('/api/interledger/revoke-user-wallet-address-key', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${revokeInfo.authToken}`,
        'content-type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ keyId: revokeInfo.keyId }),
    });
    const data: { status: string } = await res.json();
    return data;
  }, revokeInfo);
}

export async function waitForGrantConsentPage(page: Page) {
  await page.waitForURL((url) => {
    return (
      url.pathname.startsWith('/consent') &&
      url.searchParams.has('interactId') &&
      url.searchParams.has('nonce') &&
      url.searchParams.has('clientUri')
    );
  });
}

export async function login(
  page: Page,
  { username, password }: { username: string; password: string },
) {
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
