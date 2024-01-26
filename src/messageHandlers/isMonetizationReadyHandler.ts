import { updateIcon } from '@/background/utils'

export type IsMonetizationReadyData = {
  monetization: boolean
}

const isMometizationReadyCallback = async (data: IsMonetizationReadyData) => {
  await updateIcon(data.monetization)

  return true
}

export default { callback: isMometizationReadyCallback, type: 'IS_MONETIZATION_READY' }
