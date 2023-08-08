declare namespace WebdriverIO {
  interface Browser {
    customWebdriverMethod: () => void
  }
}

declare const browser: WebdriverIO.Browser

export { browser }
