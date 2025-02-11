export async function revokeKey(revokeInfo: {
  accountId: string;
  walletId: string;
  keyId: string;
  apiOrigin: string;
}) {
  const { apiOrigin, accountId, walletId, keyId } = revokeInfo;

  const url = `${apiOrigin}/accounts/${accountId}/wallet-addresses/${walletId}/${keyId}/revoke-key/`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    mode: 'cors',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to revoke key: ${await res.text()}`);
  }
}
