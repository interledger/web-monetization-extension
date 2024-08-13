export const defines = {
  NODE_ENV: JSON.stringify('production'),
  CONFIG_LOG_LEVEL: JSON.stringify('WARN'),
  CONFIG_PERMISSION_HOSTS: JSON.stringify({ origins: ['https://*/*'] }),
  CONFIG_ALLOWED_PROTOCOLS: JSON.stringify(['https:']),
  CONFIG_OPEN_PAYMENTS_REDIRECT_URL: JSON.stringify(
    'https://webmonetization.org/welcome'
  )
}
