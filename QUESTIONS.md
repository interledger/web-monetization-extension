1. What will the default amount be for wallets not using USD, such as BTC?

- BTC Scale - scale 8 -> 0.00000060BTC ~~ $0.04 <<< $0.60
- XRP Scale - scale 6 - 0.000060XRP ~~ $0.000039 <<<<<< $0.60
- Should users also have the option to define their rate of pay when setting up their wallet?
- Probably we need a rates service for correct conversion???

A: Rates Service

Talk with Beni: We need - ETC, FLR, SGB, GALA, WXRP, DSH, XAH in the rates service

BTC WALLET - $0.01 -> BTC & $1 -> BTC - for every non USD wallet

- on a interval
- if the currency conversion is between 0.8 & 1.5 we do not do currency conversion
  - ex: EUR, GBP -> we keep the original currency
- max asset scale of 4 truncated and show a little tooltip with all the decimals if the wallet has an asset scale greater than 4 for the rate of pay slider (hovering over the green dot or on the amount in the bottom left)

2. How do we handle scenarios where the wallet's asset scale is low (for example, 2)? Should we opt for sending the minimum amount, like 0.02, and avoid sending it every second? What is going to happen if the user reloads the page - will we send the minimum amount again?

A: Change the interval of payment to match the minimum based on the wallet asset scale. JUST IN V1

- keep track of the last time you made a payment and every time you are trying to make a payment
  - have a flag with the last payment for the current page
  - try making it work when a page is refreshed with a low asset scale

3. Do we need to handle multiple link tags for V1?

   3.1. We split the amount that needs to be sent every second?

   3.2. What should happen when the wallet address has a low asset scale (2 for example)?

   - If the sending wallet address has a low asset scale how are we splitting the amounts? For asset scale 2 it will need to send 4 units ($0.04) - $0.02 for each link tag
   - If the receiving wallet address has a low asset scale - we will need to ignore the WM user rate of pay and send the minimum amount x number links (two links, with the minimum amount of 2 units - $0.04)

A: Yes, if the wallet address has a low asset scale, times X the interval (the number of link tags that we have in the page)
We need to take iframes into consideration as well - only the first monetization link from the page (only the head element)

4. During the work week it was decided to have the exception list in the follwing format:

```json
{
  "exceptionList": {
    "https://example.com": {
      "amount": "60", // 60 units every hour
      "interval": "3600000" // in ms - the default for one
    },
    "https://example.com/path/to/article": {
      "amount": "1",
      "interval": "???"
    }
  }
}
```

Answer in snippet

5. Should we have another extension icon with an orange dot - the page has a monetization link (valid or not) but WM is disabled globally or for this URL?

A: Yes

6. For the recurring monthly amount - what should be the top-up date? If the user sets up the wallet on 15th of March, the next top-up should happen on 15th of April or should we always top up at start of the month?

A: From 15th of March to 15th of Aprile not at the start of the month.

7. For clarity, is this how the `load` and `error` events need to be triggered?

   7.1. User lands on page

   7.2. We check if WM is enabled for the current page

   7.2.1. If WM is disabled globally or for the current URL - noop
   7.2.2. If WM is enabled - continue to step 7.3

   7.3. We search for link tags in the document

   7.3.1. No link tags found - noop

   7.3.2. When a link tag is found - we fetch its information

   - valid JSON response - dispatch `load` event at link tag
   - not a valid JSON response - dispatch `error` event at link tag

   \*\* per link

8. How do we want to display error messages in the popup - the design that we have now does not take error messages into consideration - for form fields or a general form error.

- revalidate onBlur

9. When we disconnect a wallet, do we generate a new key pair or keep the old one?

- Keep key pair.

<iframe src="">
<link rel="monetization">
</iframe>
