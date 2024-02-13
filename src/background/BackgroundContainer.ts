import { asClass, createContainer } from 'awilix'

import Background from './Background'
import StorageService from './StorageService'

const BackgroundContainer = createContainer()

BackgroundContainer.register({
  Background: asClass(Background).singleton(),
  storageService: asClass(StorageService).singleton(),
  // TODO - add injectable services
})

export default BackgroundContainer
