# Payment mechanism

1. The content script finds the valid `<link rel="monetization">` elements and sends a message to the background.
2. The background then sets up a payment session for this element - via `Monetization` (singleton for browser instance) → `PaymentManager` (for tab) → `PaymentStream` (for frame) → `PaymentSession` (for element).
3. Once a payment is made, the `PaymentSession` passes on an event to the website (via `polyfill.ts`), and in turn a `MonetizationEvent` is emitted.

## `minSendAmount`

When a `PaymentSession` is created, we find a `minSendAmount` before we try to make any payment. This value is used in figuring out the amounts and timings for the payments for given link element. The `minSendAmount` is obtained by creating a quote with particular amount and seeing if the quote is accepted at that amount.

The `minSendAmount` is a property of user's connected wallet (currency/assetScale), the wallet for the given link element and associated payment fees at that time. For a browsing session (which _resets_ on navigation), we typically find this amount only once. But if future payments fail, we may need to adjust the `minSendAmount` again.

We make payments only in multiples of `minSendAmount`. This ensures some fairness for the sender and receivers - as the amounts higher than in-multiple of `minSendAmount` are absorbed by ASEs to maintain cross-currency liquidity for other transactions when user may send an amount less than multiple of `minSendAmount`.

## Open-payments flow

To make a payment with Open Payments, following steps are taken (presuming we've the OutgoingPaymentGrant tokens available, i.e. user has connected the extension to their wallet):

1. Create incoming payment:
   1. Set up a non-interactive incoming payment grant for the receiving wallet address.
   1. Create an incoming payment using this grant for the receiving wallet address.
   1. Optionally, cancel the incoming payment grant, as we no longer need it (we already have the incoming payment). This prevents users wallet seeing _dangling_ grants in their wallet.
1. Find the `minSendAmount`:
   1. Find a possible amount for the receiving wallet using various heuristics (currency exchange rate, asset scales, asset codes etc.)
   2. Exponential probing: Try creating a quote with this amount until it doesn't fail with a "non-positive receive amount" error (i.e. the receiver has to receive at least one unit for a quote to succeed), increasing it in an exponential manner.
      - If the OpenPayments request with a "non-positive receive amount" error, error and includes a `minSendAmount` in error details (this is a relatively recent OpenPayments feature), stop the process to find the minimum sendable amount here.
   3. Binary search: Once a sendable amount is found, use binary search (between the sendable amount and previously attempted amount) to find the minimum sendable amount.
1. Create outgoing payment:
   1. Call the create outgoing payment OpenPayments API to create a fix-send outgoing payment. Include the following details:
      - `accessToken`: The access token for the outgoing payment grant (i.e. the one we get from connecting the wallet). This token needs to be rotated once in a while: if the token is expired, retry the payment with a refreshed token.
      - `incomingPayment`: The incoming payment ID/URL we got in step 1.
      - `debitAmount`: The amount we want to send.

## One-time payments

When a user wants to send one-time payment, we distribute the amount chosen by the user across the _payable_ payment sessions, while respecting the `minSendAmount` of each session.

We then create multiple payments as described the flow above, to each session that gets a non-zero amount following the above distribution.

The distribution logic is defined in [#1098](https://github.com/interledger/web-monetization-extension/pull/1098).

## Continuous payments

Continuous payments involve a timing component, managed by `PaymentManager`.

Depending on the user's chosen rate of pay, we find the interval at which we can increase a "pending amount" that can be paid out. Every "interval" ms, we increment the pending amount by some units.
The interval can't be lower than `MIN_PAYMENT_WAIT` - which defines a minimum time between consecutive payments, for performance reasons. We adjust the interval and increment accordingly.

From the multiple payment sessions, then we have to choose the session we want to pay next. How sessions are chosen is defined in [#1066](https://github.com/interledger/web-monetization-extension/pull/1066), but essentially we go sequentially in the order we loaded the link elements, while prioritizing the sessions on the "main frame" (host website over iframes).

<details>

- First, go through all payable link tags on the main website, one by one.
- Then, pay the first link in the first iframe, then the first link in the second iframe.
- Then, again go through all payable link tags on the main website.
- Then, pay the second link of the first iframe, then the second link (if it doesn't exist, then the first again) of the second iframe.
- Then, again go through all payable link tags on the main website.
- Then, again pay the first link in the first iframe, then the first link in the second iframe, and so on.

</details>

The "pending amount" acts like a bucket, and we empty the bucket by making a payment in a multiple of the chosen session's `minSendAmount` (the bucket isn't always emptied depending on the values of increments and min-send amounts). If there's not enough pending payment, we wait until there is (but still paying the same chosen payment session), and then move onto the next payment session.

We keep doing this indefinitely (until monetization is stopped by some user action or long inactivity), cycling through the payment sessions.
