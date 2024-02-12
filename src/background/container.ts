import { asClass, createContainer } from 'awilix'

import Background from './Background'

interface Cradle {
  background: Background
}

export const constainer = createContainer<Cradle>()

constainer.register({
  background: asClass(Background).singleton(),
  // TODO - add injectable services
})
