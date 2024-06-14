export const PERMISSION_HOSTS =
  process.env.NODE_ENV === 'production'
    ? { origins: ['https://*/*'] }
    : { origins: ['http://*/*', 'https://*/*'] }
