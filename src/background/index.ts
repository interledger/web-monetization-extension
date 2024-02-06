import BackgroundContainer from './BackgroundContainer'

const initialize = () => {
  console.log('Start initialization')

  const background = BackgroundContainer.resolve('Background')

  background.subscribeToMessages()
  background.subscribeToTabChanges()

  console.log('End initialization')
}

initialize()
