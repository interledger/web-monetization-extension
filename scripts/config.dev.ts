export const defines = {
  NODE_ENV: JSON.stringify('development'),
  CONFIG_LOG_LEVEL: JSON.stringify('DEBUG'),
  CONFIG_PERMISSION_HOSTS: JSON.stringify({
    origins: ['http://*/*', 'https://*/*']
  }),
  CONFIG_ALLOWED_PROTOCOLS: JSON.stringify(['http:', 'https:']),
  CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
    'https://webmonetization.org/welcome'
  )
}
