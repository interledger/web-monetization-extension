import { constainer } from './container'

const initialize = () => {
  console.log('Start initialization')

  const background = constainer.resolve('background')

  background.onInstalled()
  background.subscribeToMessages()
  background.subscribeToTabChanges()

  console.log('End initialization')
}

initialize()
