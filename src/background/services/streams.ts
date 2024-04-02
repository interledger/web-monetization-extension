import { Logger } from '@/shared/logger'
import { WalletAddress } from '@interledger/open-payments/dist/types'

export class StreamsService {
  streams: Record<string, WalletAddress> = {}

  constructor(private logger: Logger) {}
}
