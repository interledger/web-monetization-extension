# Web Monetization Extension Test Plan

## Introduction

The purpose of this document is to guide end-user testing of the Web Monetization browser extension.
We focus on functional test cases. The goal is to report bugs, issues or differences observed from the expected behavior.

## Audience

Any person interested in testing the beta release of the Web Monetization extension.

## Objectives

1. Validating that, once installed, users can configure Web Monetization settings on the extension.
2. Validating that once the extension is successfully connected to a digital wallet for sending payments, a user is able to configure payments or disconnect from the wallet.
3. Validating that the behavior of the extension meets expectations, and that it is correct when the extension facilitates paying a monetized web page.

## Dependencies

### Digital Wallets

The main prerequisite for sending or receiving Web Monetization payments is to have a Web Monetization-enabled digital wallet. Web Monetization-enabled digital wallets are provided by licensed service providers. The wallet providers are regulated by the laws of the countries in which they operate.

Below is a list of the available wallet providers if you want to use real money:

- [Fynbos](https://wallet.fynbos.app)
- [GateHub](https://gatehub.net)

Wallet availability in a specific country, or availability in particular currency depends on the wallet provider.  
We maintain a list of [Web Monetization compatible wallets](https://webmonetization.org/docs/resources/op-wallets/).

#### Test Digital Wallet

You have the option to use “play” money from the [Interledger Test Wallet application][testWallet]. Here you can set up a test account that is enabled for sending Web Monetization payments.

## Testing

### Environment and Software

This test plan covers scenarios where you, as a website visitor, want to pay web monetized sites.

1. Hardware: Any PC with internet access
2. Digital wallet: A Web Monetization enabled digital wallet from which payments will be made
3. Environment & software:  
   a. Any operating system (OS)  
   b. A Chromium-based Web browser (e.g. Chrome, Edge, Vivaldi, Brave) or Firefox

### Reporting Issues

1. Use any screen recording application to record the steps and results of your testing (e.g. Loom, Camtasia etc.).
2. File bugs or other issues, and monitor their status and resolution on [GitHub](https://github.com/interledger/web-monetization-extension/issues).
3. Join the `#webmonetization` channel on [Slack](https://communityinviter.com/apps/interledger/interledger-working-groups-slack).

### Prerequisites

Before you start testing, sign-up for a wallet:

1. The sign-up process depends on your digital wallet provider. Learn more from the [Dependencies](#Dependencies) section.
2. If you want to use a real wallet:  
   a. Your wallet provider will likely need to verify your identity (info: this process is mandated by the laws of each country, or jurisdiction).  
   b. The identity verification process depends on your wallet provider, and your location (info: this can be within hours or days).  
   c. Once your wallet provider completes all sign-up and verification processes, you should be able to:
   - Log into your digital wallet application.  
   - Setup and manage your wallet accounts, currencies, balances etc.  
   - Obtain the wallet address or payment pointer for your digital wallet.

### Test Playground

Use the [Web Monetization playground](https://webmonetization.org/play/) to quickly create the conditions of a monetized website in a playground area, to use only for testing purposes.

When you add a wallet address or payment pointer to the playground, it is added as a receiving wallet on the playground.  
So, the playground behaves like a monetized website on which you can use the Web Monetization extension to pay.

On the playground, you can add a wallet that uses real money from a real wallet, or you can add a wallet that uses “play” money from a “test wallet”.

**Important**

1. The playground itself is not web monetized. We do not receive any payments from you if you use this site.
2. The playground becomes monetized when you add one or more receiving wallet addresses to it.
3. If your Web Monetization extension is connected to a real wallet, then your extension will facilitate payments from your real wallet (i.e. real money).
4. Similarly, if your extension is connected to a [test wallet][testWallet], then the extension facilitates payments using "play" money.
5. If you add your own wallet address to the playground, and then use the extension to pay the playground, you are paying yourself.

### Test Data

This section lists examples of websites and Web Monetization compatible wallet addresses that you can pay using the Web Monetization extension.

#### Websites and wallets using Fynbos US

If you want to test the Web Monetization extension using real money, and you have a Fynbos US wallet connected to your extension, then you have two options:

1. Visit and pay any of these monetized websites:

   - [jeremiahLee.com](https://jeremiahLee.com)
   - [lifebe.com.au](https://lifebe.com.au/)
   - [storytogo.ca/classroom](https://storytogo.ca/classroom/)

2. Visit the Web Monetization Playground, and add any Fynbos US wallet address. Here are a few wallet addresses that you can use:
   - https://fynbos.me/jeremiah
   - https://fynbos.me/adam
   - https://fynbos.me/lori

#### Websites and wallets using Fynbos Canada

If you want to test the Web Monetization extension using real money, and you have a Fynbos Canada wallet connected to your extension, then you have two options:

1. Visit and pay this monetized website:
   - [ericahargreave.com](https://ericahargreave.com)
2. Visit the Web Monetization Playground, and add any Fynbos Canada wallet address. Here is a wallet address that you can pay:
   - https://fynbos.me/erica

#### Websites and wallets using Fynbos South Africa

If you want to test the Web Monetization extension using real money, and you have a Fynbos South Africa wallet connected to your extension, then you have two options:

1. Visit and pay this monetized website:  
   - [www.radu.sh/fynbos](https://www.radu.sh/fynbos)
2. Visit the Web Monetization Playground, and add any Fynbos South Africa wallet address. Here is a wallet address that you can use:  
   - https://fynbos.me/makedev

#### Websites and wallets using GateHub

If you want to test the Web Monetization extension using real money, and you have a GateHub wallet connected to your extension, then you have two options:

1. Visit and pay these monetized websites:  
   - [storytogo.ca](https://storytogo.ca)
   - [roamancing.com](https://roamancing.com)

2. Visit the Web Monetization Playground, and add any Fynbos Canada wallet addresses. Here are a few payment pointers that you can use:
   - https://ilp.gatehub.net/276288680/EUR
   - https://ilp.gatehub.net/870065172/USD

#### Websites using multiple wallets

Whether your extension is connected to the [test wallet][testWallet] (which uses "play" money), or Fynbos US (which uses real money), or GateHub (which uses real money), you can use the extension to pay this website:

- [roamancing.com/naturallyours](https://roamancing.com/naturallyours)

This website has multiple receiving wallet addresses. It can receive play money into a test wallet, real money into a Fynbos US wallet, and real money into a GateHub wallet.

### Functional Test Cases

These test cases are defined from the point of view of a website visitor that wants to use Web Monetization to pay.

#### Risk Areas

**Goal**: To lower the barriers to Web Monetization adoption.
**Approach**: Identify and prioritize risks to the adoption of the WM extension.
Based on these risks, the sections that follow will detail the actual test cases.

<!-- prettier-ignore-start -->
We have 2 risk categories:  `critical` | `high` 

| Ref. | Risk                                                       | Priority | How to mitigate the risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :--- | :--------------------------------------------------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | Onboarding is long or complicated                          | critical | <ul><li>Installation is simple</li><li>Onboarding is simple and clear</li><li>Support a reasonably quick start</li><li>Provide good quality support to simplify obtaining a wallet for sending or receiving WM payments (i.e. easy to contact, responsive, proactive support)</li></ul>                                                                                                                                                                                                                                                                                                              |
| R2   | UX that is poor                                            | critical | <ul><li>Provide user experience (UX) that supports ease of use</li><li>Provide fast and responsive help desk support to resolve issues</li><li>Gather user feedback, and continuously improve UX and features</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                  |
| R3   | Lack of trust about the security of funds                  | critical | <ul><li>Uncertainty about the security of my funds:<ul><li>Is my money safe?</li><li>Can I easily see how much I have used?</li><li>Can I easily query issues about WM funds?</li></ul></li><li>Provide assurance and clarity about the security of funds</li><li>Allow users to view the balance of funds available to the extension from their wallet, in real-time</li><li>Build confidence by providing resources to empower software architects, developers or testers to test the technology, either using real money, or in a playground environment using “play” money</li></ul>          |
| R4   | Unable to control payments                                 | critical | <ul><li>Ability to control when, who & how much to pay</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R5   | Product not easily accessible                              | high     | The extension is: <ul><li>Readily accessible where the majority of people are, on the Web</li><li>Easy to find</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R6   | Lack of understanding about the standard or the technology | high     | <ul><li>Provide accessible, good quality resources to simplify understanding:<ul><li>Web Monetization</li><li>The extension</li><li>How to start using the extension</li></ul></li><li>Provide good quality of docs (accurate, complete)</li><ul><li>How Web Monetization works & what to expect</li><li>Understanding the technology</li><li>Access to the [proposed Web Monetization standard specification](https://webmonetization.org/specification/) & the working group [WICG](https://github.com/WICG/webmonetization) GitHub repository</li></ul></ul> |

<!-- prettier-ignore-end -->

#### Basic Test Cases

##### Connect to a wallet

**Test ID**: 1  
**Description**: Connect the extension to a Web Monetization enabled digital wallet  
**Risk**: R1 (onboarding) and R2 (UX)  
**Preconditions**:

1. You have already downloaded and installed the Web Monetization extension.  
2. Your digital wallet sign-up and account activation is complete (learn more from the [Prerequisites](#Prerequisites) section).
3. You have obtained and copied your wallet address or payment pointer from your digital wallet.  

**Steps**:

1. Open the Web Monetization extension, and enter your payment pointer or wallet address.
2. Enter the amount you want to make available to the extension from your wallet.
3. Keep the option to renew monthly disabled.
4. Click connect.  
5. Click agree, when the extension prompts you to consent to automatically connecting the extension with your wallet.

**Expected results**:

1. You will receive an interaction prompt from your wallet to authorize the connection and access to the amount.
2. On accepting, you get shown the message "Your wallet is now successfully connected to the extension."

##### Make continuous payments

**Test ID**: 2  
**Description**: Send continuous Web Monetization payments to a monetized website  
**Risk**: R3 (security of funds)  
**Preconditions**:

1. The extension is connected to your wallet.
2. The extension has a positive remaining balance.
3. Your wallet balance is equal to or greater than the extension’s remaining balance.

**Steps**:

1. Visit a monetized website. The [Test Data](#Test-Data) section lists monetized websites that you can visit.
2. Visit a non-web monetized website, such as your favorite search engine. Open the extension to observe its available options.

**Expected results**:

| Web monetized websites                                                                                                                                                                                                                                                          | Non monetized websites                                                          |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------ |
| Extension icon: active (full color), with a green tick                                                                                                                                                                                                                          | Extension icon: active (full color), but with a red X                           |
| Opening the extension displays a **rate of pay** slider:<ul><li>On the left, the current hourly rate in the currency of the wallet.</li><li>The default is equivalent to 0.60 USD.</li><li>The remaining balance, updated in near real-time (i.e. every few seconds).</li></ul> | Opening the extension displays <ul><li>This website is not monetized.</li></ul> |

##### Pay one-time when extension and wallet has enough funds

**Test ID**: 3  
 **Description**: Send a one-time payment to a monetized website when the remaining balance for the extension is sufficient for the payment, and the wallet has sufficient funds  
 **Risk**: R3 (security of funds) and R4 (control my payments)  
 **Preconditions**:

1.  The extension is connected to your wallet.
2.  The extension has a positive remaining balance.
3.  Your wallet balance is equal to or greater than the extension’s remaining balance.

**Steps**:

1. Visit a monetized website. The [Test Data](#Test-Data) section lists monetized websites that you can visit.
2. Open the extension and make a one-time payment of an amount that falls within your remaining balance shown in the extension.
3. Visit a non-web monetized website, such as your favorite search engine. Open the extension to observe its available options.

**Expected results**:  
 | Web monetized websites | Non monetized websites |
| :---------------------------- | :--------------------------------------------------- |
| Extension icon: active (full color), with a green tick | Extension icon: ![active icon (full color) but with a red X](../../src/assets/icons/32x32/enabled-no-links.png) |
| Opening the extension displays: <ul><li>**Rate of pay slider**: rate of pay and currency on the left, the remaining balance of the extension is on the right side, and it decreased by the value of the one-time payment</li><li>**Amount**: the one-time payment amount field resets to zero</li><li>**“Send now” button**: clicking the button to send a one-time payment changes the text to “Payment successful” for a few seconds, then the text defaults back to “Send now” </li></ul> | Opening the extension displays: <ul><li>This website is not monetized</li></ul> |

##### Pay one-time when extension funds are insufficient

**Test ID**: 4  
**Description**: Send a one-time payment to a monetized website that is greater than the remaining balance of the extension, while the wallet has sufficient funds  
**Risk**: R3 (security of funds) and R4 (control my payments)  
**Preconditions**:

1. The extension is connected to your wallet.
2. Your extension has insufficient funds. The extension’s remaining balance is lower than the one-time payment you will make.
3. Your wallet has sufficient funds. Your balance is greater or equal to the one-time payment you will make.

**Steps**:

1. Visit a monetized website. The [Test Data](#Test-Data) section lists monetized websites that you can visit.
2. Open the extension, and make a one-time payment that is higher than the extension's remaining balance.
3. Visit a non-web monetized website, such as your favorite search engine. Open the extension to observe its available options.

**Expected results**:  
| Web monetized websites | Non monetized websites |
| :------------------------------------------------------- | :------------------------------------------------------ |
| Extension icon: active (full color), with a green tick | Extension icon: active (full color), but with a red X |
| Opening the extension displays: <ul><li>**A slider**: with the hourly rate of pay and currency on the left, and the remaining balance of the extension’s authorized amount on the right side.</li><li>**The “Send now” button**: attempting to make a one-time payment that is greater than the remaining balance fails with an error: `Insufficient funds to complete the payment.`</li></ul> | Opening the extension displays: <ul><li>This website is not monetized.</li></ul> |

##### Pay one-time when wallet is out of funds

**Test ID**: 5  
**Description**: Send a one-time payment to a monetized website when the extension has a sufficient remaining balance, but the wallet has insufficient funds  
**Info**: This can happen when, for example, other unrelated transactions reduce the funds available in your wallet after you connect the extension  
**Risk**: R3 (security of funds) and R4 (control my payments)  
**Preconditions**:

1. The extension is connected to your wallet.
2. Your extension has sufficient funds. The extension’s remaining balance is greater than the one-time payment you are going to make.
3. There are insufficient funds in your wallet for the one-time payment you want to make.  
   a. You can set this up by using your digital wallet application to withdraw funds from your wallet AFTER you have connected the extension to your wallet.

**Steps**:

1. Visit a monetized website. The [Test Data](#Test-Data) section lists monetized websites that you can visit.
2. Open the extension and make a one-time payment where the amount:
   1. Falls within your remaining balance shown in the extension.
   1. Is higher than your wallet’s available balance.
3. Visit a non-web monetized website, such as your favorite search engine. Open the extension to observe its available options.

**Expected results**:  
 | Web monetized websites | Non monetized websites |
| :------------------------------------------------------- | :------------------------------------------------------ |
| Extension icon: active (full color), with a green tick | Extension icon: active (full color), but with a red X |
| Opening the extension displays: <ul><li>**A slider**: with the hourly rate of pay and currency on the left, and the remaining balance of the extension’s authorized amount on the right side.</li><li>**The “Send now” button**: clicking the button to send a one-time payment results in the extension displaying the message "Could not facilitate payment for current website"</li></ul> | Opening the extension displays: <ul><li>This website is not monetized.</li></ul> |

##### Disable continuous payments

**Test ID**: 6  
**Description**: Disable the extension’s ability to make any continuous Web Monetization payments  
**Risk**: R3 (security of funds) and R4 (control my payments)  
**Preconditions**:

1. The extension is connected to your wallet.

**Steps**:

1. Visit a monetized website. The [Test Data](#Test-Data) section lists monetized websites that you can visit.
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
**Risk**: R3 (security of funds) and R4 (control my payments)  
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
**Risk**: R2 (user experience)  
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
3. The currency and value that had been authorized for the most recent wallet connection.

#### Edge Test Cases

##### Partial one-time payment success

**Test ID**: 9  
**Description**: Make a one-time payment to a website that has multiple receiving wallets from different wallet providers, where some of the receiving wallets use real money, and some are test wallets that use "play" money  
**Risk**: R3 (security of funds) and R4 (control my payments)  
**Preconditions**:

1. The extension is connected to your wallet.
2. Your extension has sufficient funds for the payment.
3. Your wallet has sufficient funds for the payment.

**Steps**:

1. Visit a monetized website that has multiple receiving wallet addresses or payment pointers:  
   a. You can visit [roamancing.com/naturallyours](https://roamancing.com/naturallyours/) because it has 6 different receiving wallet addresses, from different wallet providers.
2. Open the extension and make a one-time payment that is lower than the extension's available balance.
3. Visit a non-web monetized website, such as your favorite search engine. Open the extension to observe its available options.

**Expected results**:  
| Web monetized websites | Non monetized websites |
| :------------------------------------------------------- | :------------------------------------------------------ |
| Extension icon: active (full color), with a green tick | Extension icon: active (full color), but with a red X |
| Opening the extension displays: <ol><li>**Rate of pay slider**: the rate of pay and currency on the left, the remaining balance of the extension’s authorized amount on the right side.</li><li>“**Send now**” **button**: clicking the button to send a one-time payment changes the text to “Payment successful” for a few seconds, then the text defaults back to “Send now”</li><li>**Amount**: the one-time payment amount resets to zero.</li><li>**Remaining balance**: the web page has 6 receiving wallet addresses, so the extension attempts to pay the maximum number of wallets it can pay, without exceeding its remaining balance **Reason**: when you try to send $12 to the web page, the extension divides the total $12 amount by the 6 wallet addresses, such that it tries to send $2 to each wallet address. **Observe**: only 1 of 6 payments can succeed, which should reduce the extension's remaining balance $2. </li></ol> | Opening the extension displays: <ul><li>This website is not monetized.</li></ul> |

##### Pay until the extension runs out of funds

**Test ID**: 10  
 **Description**: Make payments that deplete the extension funds to zero  
 **Risk**: R3 (security of funds) and R4 (control my payments)  
 **Preconditions**:

1. The extension is connected to your wallet.
2. The extension has a positive remaining balance.
3. There are enough funds in your wallet for the one-time payment you want to make.

**Steps**:

1. Visit a monetized website. The [Test Data](#Test-Data) section lists monetized websites that you can visit.
2. Open the extension to make as many payments as it takes to use up the remaining balance, until it is zero.
3. Visit a non-web monetized website, such as your favorite search engine. Open the extension to observe its available options.

**Expected results**:  
 | Visit monetized or non-monetized websites |
| :------------------------------------------------------- |
| Once the extension runs out of funds: <ul><li>Extension icon: active (full color), with an **orange exclamation mark**.</li> </ul> |
| Opening the extension displays: <ul><li>**Alert text**: Out of funds. Funds have been depleted. You can no longer make payments. Please add funds.</li><li>The following two buttons: <ul><li>Let me add funds and auto-renew monthly.</li><li>Let me top-up funds one time.</li></ul></li></ul> |

[testWallet]: https://wallet.interledger-test.dev
