import { sleep } from '@/shared/helpers';

export const getAuthToken = (): string => {
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

export const getWalletAddressId = async (): Promise<string> => {
  // A Firebase request will set this field eventually. We wait max 6s for that.
  let attemptToFindWalletAddressId = 0;
  while (++attemptToFindWalletAddressId < 12) {
    const walletAddressId = sessionStorage.getItem('walletAddressId');
    if (walletAddressId) return walletAddressId;
    await sleep(500);
  }
  throw new Error('No walletAddressId found in sessionStorage');
};
