import { asClass, createContainer } from 'awilix'

import Background from './Background'

interface Cradle {
  background: Background
}

export const container = createContainer<Cradle>()

container.register({
  background: asClass(Background).singleton(),
  // TODO - add injectable services
})
