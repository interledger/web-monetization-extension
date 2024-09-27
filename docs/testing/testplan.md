# Web Monetization Extension Test Plan

## Introduction

The purpose of this document is to guide end-user testing of the Web Monetization browser extension.
We focus on functional test cases. The goal is to report bugs, issues or differences observed from the expected behaviour.

## Audience

Any person interested in testing the beta release of the Web Monetization extension.

## Objectives

1. Validating that, once installed, users can configure Web Monetization settings on the extension.
2. Validating that once the extension is successfully connected to a digital wallet, a user is able to configure payments or disconnect from the wallet.
3. When the extension facilitates paying a monetized web page, check how payments get distributed between the receiving wallets on the page.

## Dependencies

### Digital Wallets

The main prerequisite for sending or receiving Web Monetization payments is to have a Web Monetization-enabled digital wallet. Web Monetization-enabled digital wallets are provided by licensed service providers. A wallet allows a user to send or receive Web Monetization payments. The wallet providers are regulated by the laws of the countries in which they operate.

Below is a list of the available wallet providers:

- [Fynbos](https://wallet.fynbos.app/wallet)
- [GateHub](https://gatehub.net/mobile)

Wallet availability in a specific country, or availability in particular currency depends on the wallet provider. Learn more about the providers for [Web Monetization compatible wallets here](https://webmonetization.org/docs/resources/op-wallets/#fynbos).

## Testing

### Environment and Software

The resources and tools that you will need to test Web Monetization depend on your desired role, and what you want to test.

We’ve identified three roles you can play when using Web Monetization:

- Website visitor: Wants to pay websites that are web monetized
- Website owner: Wants to receive Web Monetization payments
- Web developer: Wants to explore Web Monetization functionality.

This test plan only focuses on the perspective of a website visitor.

| Role              | Hardware                    | Digital wallet                                                             | Environment & software                                                                                                    |
| :---------------- | :-------------------------- | :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| A website visitor | Any PC with internet access | A Web Monetization enabled digital wallet from which payments will be made | <ul><li>Any operating system (OS)</li> <li>A chromium-based Web browser (e.g. Chrome, Edge, Brave) or Firefox </li> </ul> |

### Reporting Issues

1. Use any screen recording application to record the steps and results of your testing.
2. Log bugs or issues, and monitor their status and resolution on GitHub [link](https://github.com/interledger/web-monetization-extension/issues).

### Prerequisites

Before you start testing, sign-up for a wallet:

1. The sign-up process depends on your digital wallet provider. Learn more from the [Dependencies](#Dependencies) section.
2. Your wallet provider will likely need to verify your identity (info: this is mandated by the laws of each country, or jurisdiction).
3. The identity verification process depends on your wallet provider, and your location (info: this can be within hours or days).
4. Once your wallet provider completes all sign-up and verification processes, you should be able to:  
   a. Setup and manage your wallet accounts, currencies, balances etc.  
   b. Obtain the wallet address or payment pointer for your digital wallet.

### Test Data

This table describes the different ways that you can set up a website that is monetized, and a website that isn’t monetized, so that you can test the Web Monetization extension.

| Web monetized websites                                                                                                                                                                                                                      | Non monetized websites    |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------ |
| One valid monetization link tag                                                                                                                                                                                                             | No monetization link tags |
| Multiple valid monetization link tags with wallet addresses: <ul><li>from the same wallet providers</li><li>from different wallet providers</li><li>with different currencies</li><li>with some link tags enabled & some disabled</li></ul> | All disabled link tags    |

### Test Playground

Use the [Web Monetization playground](https://webmonetization.org/play/) to quickly and seamlessly create the conditions of a monetized website, to use only for testing. When you add wallet addresses or payment pointers to the playground, the playground becomes a monetized website that you can use the Web Monetization extension to pay

On the playground, you can use real money from a real wallet, or you can use “play” money from a “play wallet”. The play wallet is an Interledger Test Wallet application that can be used to set up an account that is enabled for Web Monetization, and other Interledger functionality. You can learn more about the [Interledger Test Wallet here](https://rafiki.dev/integration/playground/testnet/).

**Important**

1. The playground itself is not web monetized.
2. The playground becomes monetized when you add one or more receiving wallet addresses to it.
3. If your Web Monetization extension is connected to a real wallet, then your extension will facilitate payments from your real wallet (i.e. real money).
4. Similarly, if your extension is connected to a play wallet (i.e. rafiki.money), then the extension facilitates payments using play money.
5. If you add your own wallet address to the playground, and then use the extension to pay the playground, you are paying yourself.

### Functional Test Cases

These test cases are defined from the point of view of a website visitor that wants to use Web Monetization to pay.

#### Risk Areas

**Goal**: To lower the barriers to Web Monetization adoption.
**Approach**: Identify and prioritise risks to the adoption of the WM extension.
Based on these risks, the sections that follow will detail the actual test cases.

<!-- prettier-ignore-start -->
We use 4 risk priorities: `critical` | `high` | `medium` | `low`

| Ref. | Risk                                                       | Priority | How to mitigate the risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :--- | :--------------------------------------------------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | Product not easily accessible                              | high     | The extension is: <ul><li>Readily accessible where the majority of people are, on the Web</li><li>Easy to find</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R2   | Onboarding is long or complicated                          | critical | <ul><li>Installation is simple</li><li>Onboarding is simple and clear</li><li>Support a reasonably quick start</li><li>Provide good quality support to simplify obtaining a wallet for sending or receiving WM payments (i.e. easy to contact, responsive, proactive support)</li></ul>                                                                                                                                                                                                                                                                                                              |
| R3   | Lack of trust about the security of funds                  | critical | <ul><li>Uncertainty about the security of my funds:<ul><li>Is my money safe?</li><li>Can I easily see how much I have used?</li><li>Can I easily query issues about WM funds?</li></ul></li><li>Provide assurance and clarity about the security of funds</li><li>Allow users to view the balance of funds available to the extension from their wallet, in real-time</li><li>Build confidence by providing resources to empower software architects, developers or testers to test the technology, either using real money, or in a playground environment using “play” money</li></ul>          |
| R4   | Lack of understanding about the standard or the technology | high     | <ul><li>Provide accessible, good quality resources to simplify understanding:<ul><li>Web Monetization</li><li>The extension</li><li>How to start using the extension</li></ul></li><li>Provide good quality of docs (accurate, comprehensive, complete)</li><ul><li>How Web Monetization works & what to expect</li><li>Understanding the technology</li><li>Access to the [proposed Web Monetization standard specification](https://webmonetization.org/specification/) & the working group [WICG](https://github.com/WICG/webmonetization) GitHub repository</li></ul></ul> |
| R5   | UX that is poor                                            | critical | <ul><li>BuilProvide user experience (UX) that supports ease of use</li><li>Provide fast and responsive help desk support to resolve issues</li><li>Gather user feedback, and continuously improve UX and features</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                  |
| R6   | Unable to control payments                                 | critical | <ul><li>Ability to control when, who & how much to pay</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
<!-- prettier-ignore-end -->

#### Basic Test Cases

##### Connect to a wallet

**Test ID**: 1  
**Description**: Connect the extension to a Web Monetization enabled digital wallet
**Risk**: R2 (onboarding) and R5 (UX)  
**Preconditions**:

1. You have already downloaded and installed the Web Monetization extension.
2. Your digital wallet sign-up and account activation is complete (learn more from the [Prerequisites](#Prerequisites) section)

**Steps**:

1. Open the WM extension and copy the extension’s key.
2. Open the digital wallet, and load the extension’s key into the wallet.
3. From the digital wallet, find and copy the wallet address or payment pointer.
4. Open the WM extension, and enter the wallet address or payment pointer.
5. Enter the amount you want to make available to the extension from your wallet (the amount must be a positive value).
6. Keep the option to renew monthly disabled.

**Expected results**:

1. The wallet owner receives an interaction prompt from their wallet to authorise the connection and access to the amount.

##### Make continuous payments

**Test ID**: 2  
**Description**: Send continuous WM payments to a monetized website  
**Risk**: R3 (security of funds)  
**Preconditions**:

1. The extension is connected to your wallet.
2. The extension has a positive remaining balance.
3. Your wallet balance is equal to or greater than the extension’s remaining balance.

**Steps**:

1. Visit a monetized website. Refer to the [Test Data](#Test-Data) section to explore different WM conditions for websites.
2. Visit a non-monetized website. Open the extension to observe its available options.

**Expected results**:

| Web monetized websites                                                                                                                                                                                                                                                          | Non monetized websites                                                          |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------ |
| Extension icon: active (full color), with a green tick                                                                                                                                                                                                                          | Extension icon: active (full color), but with a red X                           |
| Opening the extension displays a **rate of pay** slider:<ul><li>On the left, the current hourly rate in the currency of the wallet.</li><li>The default is equivalent to 0.60 USD.</li><li>The remaining balance, updated in near real-time (i.e. every few seconds).</li></ul> | Opening the extension displays <ul><li>This website is not monetized.</li></ul> |

##### Pay one-time when extension and wallet have enough funds

**Test ID**: 3  
 **Description**: Send a one-time payment to a monetized website when the remaining balance for the extension is sufficient for the payment, and the wallet has sufficient funds  
 **Risk**: R3 (security of funds) and R6 (control my payments)  
 **Preconditions**:

1.  The extension is connected to your wallet.
2.  The extension has a positive remaining balance.
3.  Your wallet balance is equal to or greater than the extension’s remaining balance.

**Steps**:

1. Visit a monetized website. Refer to the [Test Data](#Test-Data) section to explore different WM conditions for websites.
2. Open the extension and make a one-time payment of an amount that falls within your remaining balance shown in the extension.
3. Visit a non-monetized website. Open the extension to observe its available options.

**Expected results**:  
 | Web monetized websites | Non monetized websites |
| :---------------------------- | :--------------------------------------------------- |
| Extension icon: active (full color), with a green tick | Extension icon: active (full color), but with a red X |
| Opening the extension displays: <ul><li>**Rate of pay slider**: rate of pay and currency on the left, the remaining balance of the extension is on the right side, and it decreased by the value of the one-time payment</li><li>**Amount**: the one-time payment amount field resets to zero</li><li>**“Send now” button**: clicking the button to send a one-time payment changes the text to “Payment successful” for a few seconds, then the text defaults back to “Send now” </li></ul> | Opening the extension displays: <ul><li>This website is not monetized</li></ul> |

##### Pay one-time when wallet is out of funds

**Test ID**: 4  
**Description**: Send a one-time payment to a monetized website when the extension has a sufficient remaining balance but the wallet has insufficient funds  
**Info**: This can happen when, for example, other unrelated transactions reduce the funds available in your wallet after you connect the extension  
**Risk**: R3 (security of funds) and R6 (control my payments)  
**Preconditions**:

1. The extension is connected to your wallet.
2. The extension’s remaining balance is greater than the one-time payment you are going to make.
3. There are insufficient funds in your wallet for the one-time payment you want to make.

**Steps**:

1. Visit a monetized website. Refer to the [Test Data](#Test-Data) section to explore different WM conditions for websites.
2. Open the extension and make a one-time payment where the amount: <ol><li>Falls within your remaining balance shown in the extension.</li><li>Is higher than your wallet’s available balance.</li></ol>
3. Visit a non-monetized website. Open the extension to observe its available options.

**Expected results**:  
 | Web monetized websites | Non monetized websites |
| :------------------------------------------------------- | :------------------------------------------------------ |
| Extension icon: active (full color), with a green tick | Extension icon: active (full color), but with a red X |
| Opening the extension displays: <ul><li>**A slider**: with the hourly rate of pay and currency on the left, and the remaining balance of the extension’s authorised amount on the right side.</li><li>**The “Send now” button**: clicking the button to send a one-time payment results in the extension displaying the message "Could not facilitate payment for current website"</li></ul> | Opening the extension displays: <ul><li>This website is not monetized.</li></ul> |

##### Pay one-time when extension funds are insufficient

**Test ID**: 5  
**Description**: Send a one-time payment to a monetized website that is greater than the remaining balance of the extension, while the wallet has sufficient funds  
**Risk**: R3 (security of funds) and R6 (control my payments)  
**Preconditions**:

1. The extension is connected to your wallet.
2. The extension’s remaining balance is lower than the one-time payment you will make.
3. Your wallet balance is greater or equal to the one-time payment you will make.

**Steps**:

1. Visit a monetized website. Refer to the [Test Data](#Test-Data) section to explore different WM conditions for websites.
2. Open the extension and make a one-time payment of an amount that falls within your remaining balance shown in the extension.
3. Visit a non-monetized website. Open the extension to observe its available options.

**Expected results**:  
| Web monetized websites | Non monetized websites |
| :------------------------------------------------------- | :------------------------------------------------------ |
| Extension icon: active (full color), with a green tick | Extension icon: active (full color), but with a red X |
| Opening the extension displays: <ul><li>**A slider**: with the hourly rate of pay and currency on the left, and the remaining balance of the extension’s authorised amount on the right side.</li><li>**The “Send now” button**: attempting to make a one-time payment that is greater than the remaining balance fails with an error: `Not enough funds to facilitate payment`</li></ul> | Opening the extension displays: <ul><li>This website is not monetized.</li></ul> |

##### Disable continuous payments

**Test ID**: 6  
**Description**: Disable the extension’s ability to make any continuous Web Monetization payments  
**Risk**: R3 (security of funds) and R6 (control my payments)  
**Preconditions**:

1. The extension is connected to your wallet.

**Steps**:

1. Visit a monetized website. Refer to the [Test Data](#Test-Data) section to explore different WM conditions for websites.
2. Open the extension, and view of the **remaining balance** available to the extension.
3. Disable “**Continuous payment stream**”.
4. Observe the extension's icon when you visit a web monetized and non-monetized website.

**Expected results**:  
 | Web monetized websites | Non monetized websites |
| :------------------------------------------------------- | :------------------------------------------------------ |
| The extension icon appears inactive (i.e. grey in color), with a green tick | The extension icon appears inactive (i.e. grey), but with a red X |
| Opening the extension shows that: <ul><li>The rate of pay slider is replaced with text “Web Monetization has been turned off”</li><li>Making a one-time payment remains available.</li><li>Enabling “Continuous payment stream” is available.</li><li>**Action**: Re-enable the “Continuous payment stream” toggle, and confirm that:<ul><li>The hourly rate of pay slider appears.</li><li>Remaining balance is displayed and is unchanged from what it was prior to disabling continuous payments.</li><li>The “Web Monetization has been turned off” text is no longer visible.</li></ul></li></ul> | Opening the extension displays: <ul><li>This website is not monetized.</li></ul> |

##### Change rate of pay **and** View available balance

**Test ID**: 7  
**Description**: Adjust the hourly rate at which the extension makes continuous payments  
**Risk**: R3 (security of funds) and R6 (control my payments)  
**Preconditions**:

1. The extension is connected to your wallet.
2. The extension has a positive remaining balance.
3. Your wallet balance is greater or equal to your extension's balance.

**Steps**:

1. Open the extension: <ol><li>Ensure that “Continuous payment stream” is enabled.</li><li>Use the slider to change the hourly rate for continuous WM payments.</li><li>Take note of the remaining balance available to the extension.</li></ol>
2. Spend some time, perhaps 3 to 5 minutes each, on a web monetized website and on a non-monetized website. On each site or page that you visit, open the extension to view the remaining balance on the extension.

**Expected results**:  
 | Web monetized websites | Non monetized websites |
| :------------------------------------------------------- | :------------------------------------------------------ |
| Extension icon: active (full color), with a green tick | Extension icon: active (full color), but with a red X |
| Opening the extension shows that the remaining balance of the extension has decreased by the correct amount, based on your hourly rate of pay. | Opening the extension displays: <ul><li>This website is not monetized.</li></ul> |

##### Disconnect extension

**Test ID**: 8  
**Description**: Disconnect the extension from the connected wallet.  
**Risk**: R5 (user experience)  
**Preconditions**:

1. The extension is connected to your wallet

**Steps**:

1. Open the browser where the extension is installed.
2. Open the extension, and open the settings of the extension.
3. On the settings page, **Disconnect** the wallet.

**Expected results**:  
Once disconnected, the settings page gets replaced by the landing page of the extension, with the following fields displayed:

1. The read-only public key of the extension.
2. The wallet address or payment pointer that had been used for the most recent wallet connection.
3. The currency and value that had been authorised for the most recent wallet connection.

#### Edge Test Cases

##### Partial one-time payment success due to some un-peered wallets

**Test ID**: 9  
**Description**: Make a one-time payment that exceeds the extension’s remaining balance to a website with multiple receiving wallets that can receive a payment from your wallet (i.e. the receiving wallets are peered to your extension’s sending wallet)  
**Risk**: R3 (security of funds) and R6 (control my payments)  
**Preconditions**:

1. The extension is connected to your wallet.
2. The extension’s remaining balance is lower than the one-time payment you are going to make.
3. There are enough funds in your wallet for the one-time payment you want to make.

**Steps**:

1. Visit a monetized website that has multiple receiving wallet addresses or payment pointers.  
   a. **Example**: A combination of receiving payment pointers or wallet addresses from the same provider.
   b. Refer to the [Test Data](#Test-Data) section to explore different WM conditions for websites.
2. Open the extension and make a one-time payment that exceeds the “remaining balance” of the extension by a small amount.
   a. **Example**: The extension’s remaining balance is $5 and the one-time payment is $6.
3. Visit a non-monetized website. Open the extension to observe its available options.

**Expected results**:  
| Web monetized websites | Non monetized websites |
| :------------------------------------------------------- | :------------------------------------------------------ |
| Extension icon: active (full color), with a green tick | Extension icon: active (full color), but with a red X |
| Opening the extension displays: <ol><li>**Rate of pay slider**: the rate of pay and currency on the left, the remaining balance of the extension’s authorised amount on the right side.</li><li>“**Send now**” **button**: clicking the button to send a one-time payment changes the text to “Payment successful” for a few seconds, then the text defaults back to “Send now”</li><li>**Amount**: the one-time payment amount resets to zero.</li><li>**Remaining balance**: if the monetized website had 2 receiving wallet addresses, then the extension attempts to pay the maximum number of wallets that it can pay, without exceeding its remaining balance **Reason**: When you try to send $6 to a web page that has 2 receiving wallet addresses, the extension divides the total amount by the number of wallet addresses (i.e. $6 divided by 2). The extension attempts the first transaction (i.e. send $3 to the first receiving wallet). After the first transaction succeeds, the remaining balance of the extension should decrease to $2. The second transaction fails (i.e cannot send $3 to the second receiving wallet) because the extension only has a remaining balance of $2.</li></ol> | Opening the extension displays: <ul><li>This website is not monetized.</li></ul> |

##### Pay until the extension runs out of funds

**Test ID**: 10  
 **Description**: Make payments that deplete the extension funds to zero  
 **Risk**: R3 (security of funds) and R6 (control my payments)  
 **Preconditions**:

1. The extension is connected to your wallet.
2. The extension has a positive remaining balance.
3. There are enough funds in your wallet for the one-time payment you want to make.

**Steps**:

1. Visit a monetized website. Refer to the [Test Data](#Test-Data) section to explore different WM conditions for websites.
2. Open the extension to make as many payments as it takes to use up the remaining balance, until it is zero.
3. Visit a non-monetized website. Open the extension to observe its available options.

**Expected results**:  
 | Visit monetized or non-monetized websites |
| :------------------------------------------------------- |
| Once the extension runs out of funds: <ul><li>Extension icon: active (full color), with an **orange exclamation mark**.</li> </ul> |
| Opening the extension displays: <ul><li>**Alert text**: Out of funds. Funds have been depleted. You can no longer make payments. Please add funds.</li><li>The following two buttons: <ul><li>Let me add funds and auto-renew monthly.</li><li>Let me top-up funds one time.</li></ul></li></ul> |
