// import * as openPayment from '@interledger/open-payments'
//
// const KEY_ID = '530c7caf-47a2-4cbd-844e-b8ed53e5c0d7'
// const PRIVATE_KEY = atob(
//   'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSU1xYkZodTlNZHpjNXZROXBoVDY0aGZ4Z0pRazM2TFVyR1VqL1cwbHRTWG0KLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo=',
// )
// // const SENDING_PAYMENT_POINTER_URL = 'https://ilp.rafiki.money/wmuser' // cel din extensie al userului
// // const RECEIVING_PAYMENT_POINTER_URL = 'https://ilp.rafiki.money/web-page' // cel din dom
// const WM_PAYMENT_POINTER_URL = 'https://ilp.rafiki.money/web-monetization' // intermediarul
//
// export const runPayment = async (
//   receivingPaymentPointerUrl: string,
//   sendingPaymentPointerUrl: string,
// ) => {
//   const client = await openPayment.createAuthenticatedClient({
//     keyId: KEY_ID,
//     privateKey: PRIVATE_KEY,
//     paymentPointerUrl: WM_PAYMENT_POINTER_URL,
//   })
//
//   const sendingPaymentPointer = await client.paymentPointer.get({
//     url: sendingPaymentPointerUrl,
//   }) // intoarce auth server
//   console.log('sendingPaymentPointer', sendingPaymentPointer)
//
//   const receivingPaymentPointer = await client.paymentPointer.get({
//     url: receivingPaymentPointerUrl,
//   })
//   console.log('receivingPaymentPointer', receivingPaymentPointer)
//
//   const incomingPaymentGrant = await client.grant.request(
//     {
//       url: receivingPaymentPointer.authServer,
//     },
//     {
//       access_token: {
//         access: [{ type: 'incoming-payment', actions: ['create', 'read', 'list'] }],
//       },
//     },
//   )
//   console.log('incomingPaymentGrant', incomingPaymentGrant)
//
//   if (openPayment.isPendingGrant(incomingPaymentGrant)) {
//     throw new Error('Expected non-interactive grant')
//   }
//
//   const incomingPayment = await client.incomingPayment.create(
//     {
//       accessToken: incomingPaymentGrant.access_token.value,
//       paymentPointer: receivingPaymentPointer.id,
//     },
//     {
//       metadata: {
//         description: 'Incoming payment for WM',
//       },
//       expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
//     },
//   )
//   console.log('incomingPayment', incomingPayment)
//
//   const quoteGrant = await client.grant.request(
//     {
//       url: sendingPaymentPointer.authServer,
//     },
//     {
//       access_token: {
//         access: [{ type: 'quote', actions: ['create'] }],
//       },
//     },
//   )
//   console.log('quoteGrant', quoteGrant)
//
//   if (openPayment.isPendingGrant(quoteGrant)) {
//     throw new Error('Expected non-interactive grant')
//   }
//
//   const outgoingPaymentGrant = await client.grant.request(
//     {
//       url: sendingPaymentPointer.authServer,
//     },
//     {
//       access_token: {
//         access: [
//           {
//             type: 'outgoing-payment',
//             actions: ['create', 'read', 'list'],
//             identifier: sendingPaymentPointerUrl,
//             limits: {
//               debitAmount: {
//                 value: '2000',
//                 assetScale: sendingPaymentPointer.assetScale,
//                 assetCode: sendingPaymentPointer.assetCode,
//               },
//             },
//           },
//         ],
//       },
//       interact: {
//         start: ['redirect'],
//         finish: {
//           method: 'redirect',
//           uri: `https://localhost:3000/`,
//           nonce: new Date().getTime().toString(),
//         },
//       },
//     },
//   )
//   console.log('outgoingPaymentGrant', outgoingPaymentGrant)
//
//   if (!openPayment.isPendingGrant(outgoingPaymentGrant)) {
//     console.error('Expected interactive outgoing payment grant.')
//     return
//   }
//
//   console.log('Interaction URL', outgoingPaymentGrant.interact.redirect)
//   //
//   // const ref = await inquirer
//   //   .prompt({
//   //     type: 'input',
//   //     name: 'finish_url',
//   //     message: 'finish_url',
//   //   })
//   //   .then((ans: any) => {
//   //     const url = new URL(ans.finish_url)
//   //     const interactRef = url.searchParams.get('interact_ref')
//   //     if (!interactRef) throw new Error('missing interact_ref')
//   //     return interactRef
//   //   })
//   //
//   // const continuationUri = outgoingPaymentGrant.continue.uri.replace('auth/', '')
//   // const continuation = await client.grant.continue(
//   //   {
//   //     accessToken: outgoingPaymentGrant.continue.access_token.value,
//   //     url: continuationUri,
//   //   },
//   //   {
//   //     interact_ref: ref,
//   //   },
//   // )
//   //
//   // // setInterval(async () => {
//   // const quote = await client.quote.create(
//   //   {
//   //     accessToken: quoteGrant.access_token.value,
//   //     paymentPointer: sendingPaymentPointer.id,
//   //   },
//   //   {
//   //     receiver: incomingPayment.id,
//   //     debitAmount: {
//   //       value: '2',
//   //       assetCode: 'USD',
//   //       assetScale: 2,
//   //     },
//   //   },
//   // )
//   //
//   // const op = await client.outgoingPayment.create(
//   //   {
//   //     paymentPointer: sendingPaymentPointer.id,
//   //     accessToken: continuation.access_token.value,
//   //   },
//   //   {
//   //     metadata: {
//   //       description: 'Outgoing Payment WM Event',
//   //     },
//   //     quoteId: quote.id,
//   //   },
//   // )
//   //
//   // console.log(
//   //   `[${new Date().toLocaleString()}] Sent ${op.debitAmount.value} -> Received: ${
//   //     op.receiveAmount.value
//   //   }`,
//   // )
//   // // }, 60000);
// }
