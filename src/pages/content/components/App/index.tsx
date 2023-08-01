import { createRoot } from 'react-dom/client'
// eslint-disable-next-line import/default
import refreshOnUpdate from 'virtual:reload-on-update-in-view'

import { initListeners } from '@/lib/listeners'
import App from '@/src/pages/content/components/App/App'

refreshOnUpdate('pages/content')

const root = document.createElement('div')
root.id = 'monetizer-root'
document.body.append(root)

initListeners()

createRoot(root).render(<App />)
