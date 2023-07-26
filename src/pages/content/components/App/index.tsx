import { initListeners } from '@lib/listeners'
import App from '@src/pages/content/components/App/App'
import { createRoot } from 'react-dom/client'
import refreshOnUpdate from 'virtual:reload-on-update-in-view'

refreshOnUpdate('pages/content')

const root = document.createElement('div')
root.id = 'monetizer-root'
document.body.append(root)

initListeners()

createRoot(root).render(<App />)
