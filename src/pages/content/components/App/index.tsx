// eslint-disable-next-line import/default
import refreshOnUpdate from 'virtual:reload-on-update-in-view'

import { initListeners } from '@/lib/listeners'

refreshOnUpdate('pages/content')

// const root = document.createElement('div')
// root.id = 'monetizer-root'
// document.body.append(root)
// createRoot(root).render(<App />)

initListeners()
