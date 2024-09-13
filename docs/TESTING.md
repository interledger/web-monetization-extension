# Automated Testing

## Unit tests

Run `pnpm test` to run unit tests locally. These tests are run automatically on every pull request.

## End-to-end Tests

To run end-to-end tests with chromium, run `pnpm test:e2e` in terminal.

**Before you begin**, you need to setup some environment variables/secrets in `tests/.env`.

1. Copy `tests/.env.example` to `tests/.env`
2. Update `tests/.env` with your secrets.

| Environment Variable         | Description                                                 | Is secret? |
| ---------------------------- | ----------------------------------------------------------- | ---------- |
| `WALLET_URL_ORIGIN`          | URL of the wallet (e.g. https://rafiki.money)               | No         |
| `WALLET_USERNAME`            | Login email for the wallet                                  | No         |
| `WALLET_PASSWORD`            | Login password for the wallet                               | Yes        |
| `CONNECT_WALLET_ADDRESS_URL` | Your wallet address that will be connected to extension     | No         |
| `CONNECT_KEY_ID`             | ID of the key that will be connected to extension (UUID v4) | No         |
| `CONNECT_PRIVATE_KEY`        | Private key (hex-encoded Ed25519 private key)               | Yes        |
| `CONNECT_PUBLIC_KEY`         | Public key (base64-encoded Ed25519 public key)              | No         |

To get the `CONNECT_KEY_ID`, `CONNECT_PRIVATE_KEY` and `CONNECT_PUBLIC_KEY`:

1. Load the extension in browser (via `chrome://extensions/`)
   - Once the extension is loaded, it'll generate a key-pair that we will need to connect with our wallet.
1. Inspect service worker with "Inspect views service worker"
1. Run following in devtools console to copy keys to your clipboard, and paste it in `tests/.env`:
   ```js
   // 1. Gets generated keys from extension storage.
   // 2. Converts result to `CONNECT_{X}="VAL"` format for use in .env file.
   // 3. Copies result to clipboard.
   copy(
     Object.entries(
       await chrome.storage.local.get(['privateKey', 'publicKey', 'keyId']),
     )
       .map(
         ([k, v]) =>
           `CONNECT_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}="${v}"`,
       )
       .join('\n'),
   );
   ```
1. Then copy `CONNECT_PUBLIC_KEY` key to https://rafiki.money/settings/developer-keys under your wallet address.
1. Now you're ready to run the tests.

### How to run in end-to-end tests in GitHub

As these tests are expensive/time-consuming, these need to be triggered manually when needed, instead of on every pull request/commit.

For a pull request, users with write access to repository can trigger the workflow to run end-to-end tests by adding a review-comment (from PR Files tab) with body `test-e2e` (exactly).

End-to-end tests run automatically daily before creating the Nightly release. You can also trigger that workflow manually from [Actions Dashboard](https://github.com/interledger/web-monetization-extension/actions/workflows/nightly-build.yaml).
