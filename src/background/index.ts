import { container } from './container'

const initialize = () => {
  console.log('Start initialization')

  const background = container.resolve('background')

  background.onInstalled()
  background.subscribeToMessages()
  background.subscribeToTabChanges()

  console.log('End initialization')
}

initialize()
