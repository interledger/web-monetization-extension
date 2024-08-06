Before working with the Web Monetization Extension, we recommend creating a wallet account on [rafiki.money], a test wallet provider that's part of the Interledger test network.

[rafiki.money] lets you create or upload developer keys and create wallet accounts, funded with test/play money, for making Interledger transactions via the Open Payments APIs.

## Create an account on Rafiki.Money

1. Go to [rafiki.money].
1. Click **Create an account** at the bottom right of the screen.
1. Enter your e-mail address, a password, confirm the password and click the arrowhead.
1. Go to your inbox and look for an e-mail sent by `tech@interledger.org` with the subject `[Rafiki.Money] Verify your account` and click **Confirm my email address.**

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step4.png" alt="Confirm email address" width="350" />

1. Click **Login to your account** at the email verification screen.

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step5.png" alt="Log in with new account at rafiki.money" width="350" />

1. Log in with your credentials.
1. Enter any First and Last name on the Complete KYC screen and click **Get Wallet Account.** Note that since this is a test environment, the country, city and address fields will already be filled in

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step8.png" alt="Get wallet account at rafiki.money" width="350" />

1. Click **Verify your identity** on the pop-up window.

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step9.png" alt="Identity verification at rafiki.money" width="350" />

1. Click **Verify Account** at the Complete KYC screen. Note that since this is a test environment "Passport" will be selected as the verification method and images will be uploaded by default.

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step10.png" alt="Verify account at rafiki.money" width="350" />

1. Click **Go to your account overview** on the pop-up window.

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step11.png" alt="Account overview dashboard on rafiki.money" width="350" />

You're now ready to create a Rafiki.Money test wallet and add money to it!

## Create a wallet account

The first time you access [rafiki.money], you'll be guided through creating a new wallet account.

1. If you've completed or skipped the onboarding guide, you can create a wallet account by clicking **New Account.**

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step13.png" alt="Set up new account at rafiki.money" width="300" />

1. Enter a name for the account, choose an asset code from the drop-down menu and click **Create account.**

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step15.png" alt="Enter name and create account on rafiki.money" width="300" />

1. Click **View Account.**

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step16.png" alt="Click to view account created on rafiki.money" width="350" />

1. Click **Add money.**

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step20.png" alt="Add money to payment pointer on rafiki.money" width="400" />

1. Fund your wallet by entering an amount, then click **Add money.**

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step21.png" alt="Enter amount and add money to the payment pointer on rafiki.money" width="400" />

Congratulations, you now have a funded [rafiki.money] wallet!

### Set up a payment pointer

1. Go to the **Web Monetization** tab in selected account.
1. Click **Add WM payment pointer.** NEEDS IMG

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step17.png" alt="Add a payment pointer for the new account on rafiki.money" width="400" />

1. Enter a Payment Pointer name and a Public name and then click **Create.** NEEDS IMG

   <img src="https://openpayments.dev/img/snippets/rafiki-money-step19.png" alt="Create payment pointer on rafiki.money" width="400" />

## Obtain a public-private key pair and key ID

Before you connect your wallet to the extension, you need to upload the public key from the extension's popup into the test wallet.

1. Open the extension popup by clicking the icon in browser toolbar and copy the public key.
1. On [rafiki.money], Select **Settings > Developer Keys**.
1. Expand the drop-down menu for your wallet account, and then expand the desired wallet address. NEEDS IMG

   <img src="https://openpayments.dev/img/snippets/generate-keys.png" alt="Expanded account showing payment pointer and upload key" width="600" />

1. Click the **Upload key** button.
1. Paste the copied public key to the input field, add a nickname for the key and click **Upload key**. NEEDS IMG

   <img src="https://openpayments.dev/img/snippets/view-keys.png" alt="Expanded account showing key ID, option to show public key, and button to revoke public/private keys" height="300" />

You can now open the extension popup again and connect your wallet.

## Testing the extension

Test out the extension in the [playground].

[rafiki.money]: https://rafiki.money
[playground]: https://example.com/todo
