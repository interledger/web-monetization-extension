import { sendMessage } from '@/utils/messages'

export class PaymentSender {
  sender: any

  start() {
    this.sender = setInterval(() => {
      this.send()
    }, 1000)

    // stop payments manually after 3 seconds
    // setTimeout(() => {
    //   this.stop()
    // }, 3000)
  }

  stop() {
    sendMessage({ type: 'PAUSE_PAYMENTS' })
    clearInterval(this.sender)
  }

  send() {
    sendMessage({ type: 'RUN_PAYMENT' })
  }
}
