import { asClass, createContainer } from 'awilix'

import Background from './Background'

const BackgroundContainer = createContainer()

BackgroundContainer.register({
  Background: asClass(Background).singleton(),
  // TODO - add injectable services
})

export default BackgroundContainer
