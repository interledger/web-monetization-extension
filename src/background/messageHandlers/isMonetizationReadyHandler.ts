import { updateIcon } from '@/background/utils'

export type IsMonetizationReadyData = {
  monetization: boolean
}

const isMonetizationReadyCallback = async (data: IsMonetizationReadyData) => {
  await updateIcon(data.monetization)

  return true
}

export default {
  callback: isMonetizationReadyCallback,
  type: 'IS_MONETIZATION_READY'
}
