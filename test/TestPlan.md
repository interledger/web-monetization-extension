# Web Monetization Extension Test Plan

## Introduction
The purpose of this document is to guide end-user testing of the Web Monetization browser extension.

## Audience
Any person interested in testing the beta release of the Web Monetization extension. 
There is no requirement for technical competencies.

We focus on functional test cases, and the goal is to record and report the actual behaviour that was observed when it differs from the expected behaviour.

## Strategy
One of the strategic goals of the Interledger Foundation is to grow Web Monetization awareness and adoption such that there are 1,000 web monetized websites and 100,000 active Web Monetization users (by 31 December 2024).

One of the long-term goals is to grow Web Monetization adoption by a factor of 10, in the next 5 years (by December 2029) such that Web Monetization functionality is either native to the most widely used Web browsers, or readily available through browser extensions on Web browser stores and marketplaces.

## Objectives
1. Validating that, once installed, users can configure Web Monetization settings on the extension.
2. Validating that once the extension is successfully connected to a digital wallet, a user is able to.
3. For web monetized websites, verify that the monetization event gets triggered.

## Dependencies
### Digital Wallets
Web Monetization-enabled digital wallets are provided by licensed service providers who are regulated by the laws of the countries in which they operate. They provide digital wallets that can send or receive Web Monetization payments.

Wallet availability in a specific country, or availability in particular currency depends on the wallet provider.
To learn more, visit a specific wallet provider’s website. Below are the available wallet providers: 
- [Fynbos](https://wallet.fynbos.app/wallet)
- [GateHub](https://gatehub.net/mobile)

## Testing
### Tools and Resources
The resources and tools that you will need to test Web Monetization depend on your point of view. 
The Web Monetization personas have different perspectives and needs for testing:

Persona 2: A website owner that wants to receive WM payments.

| People                        | Hardware                     | Digital wallet | Environment & software |
| :---------------------------- | :--------------------------- | :------------- | :--------------------- |
| **Persona 1**: A website visitor that wants to pay websites that are web monetized. | Any PC with internet access. | A Web Monetization enabled digital wallet from which payments will be made. | Any operating system (OS). A chromium-based Web browser (e.g. Chrome, Edge, Brave) or Firefox |
| **Persona 2**: A website owner that wants to receive WM payments. | Any device with internet access (e.g. PC, tablet, mobile device). | A Web Monetization enabled digital wallet into which payments will be received. | Any operating system (OS). Any Web browser |

### Report issues
1. Use any screen recording application to record the steps and results of your testing.
2. Log bugs or issues, and tracking their resolution status in GitHub (link).

### Prerequisites
The main prerequisite for sending or receiving Web Monetization payments is to have a Web Monetization-enabled digital wallet.  
Learn more about [compatible wallets here](https://webmonetization.org/docs/resources/op-wallets/#fynbos). 

> [!NOTE]
> The wallet signup process depends on your wallet provider, and your country.   
> In most countries, the process includes verifying your identity, as mandated by the law. This can take hours or days.  
> Once your wallet signup completes, you should be able to:  
> (1) Setup your wallet accounts, currencies, balances etc.  
> (2) Obtain the wallet address or payment pointer to use for Web Monetization.

### Test data
| Web monetized websites           | Non monetized websites       |
| :----------------------------    | :--------------------------- |
| One valid monetization link tag  | No monetization link tags    |

