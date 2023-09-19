import packageJson from './package.json'

const isFirefox = process.env.__FIREFOX__ === 'true'

const manifestVersion = isFirefox ? 2 : 3
const background = isFirefox
  ? { scripts: ['src/pages/background/index.js'], type: 'module' }
  : { service_worker: 'src/pages/background/index.js', type: 'module' }

const action = {
  [isFirefox ? 'browser_action' : 'action']: {
    default_popup: 'src/pages/popup/index.html',
    default_icon: 'icon-34.png',
  },
}

const resources = [
  'assets/js/*.js',
  'assets/css/*.css',
  'icon-128.png',
  'icon-34.png',
  'icon-active-34.png',
  'icon-active-128.png',
  'icon-inactive-34.png',
  'icon-inactive-128.png',
]

const manifest = {
  manifest_version: manifestVersion,
  name: 'Web Monetization',
  version: packageJson.version,
  description: packageJson.description,
  background: background,
  permissions: ['scripting', 'tabs', 'activeTab'],
  ...action,
  icons: {
    '34': 'icon-34.png',
    '128': 'icon-128.png',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['src/pages/content/index.js'],
      // css: ['assets/css/contentStyle<KEY>.chunk.css'],
      match_about_blank: false,
      all_frames: true,
      run_at: 'document_start',
    },
  ],
  web_accessible_resources: isFirefox
    ? resources
    : [
        {
          resources,
          matches: ['*://*/*'],
        },
      ],
}

export default manifest
