const listenForLinkChange = (mutationsList: MutationRecord[]) => {
  if (mutationsList[0].addedNodes.length && mutationsList[0].type === 'childList') {
    const monetizationLinks = Object.values(mutationsList[0].addedNodes).reduce(
      (acc: HTMLElement[], link: HTMLElement) => {
        if (
          link.tagName?.toLowerCase() === 'link' &&
          link.getAttribute('href')?.match(/^http/) &&
          link.getAttribute('rel')?.match(/monetization/)
        ) {
          acc.push(link)
        }

        return acc
      },
      [],
    )

    if (monetizationLinks.length) {
      console.log(monetizationLinks)
    }
  }

  if (mutationsList[0].type === 'attributes') {
    const target = mutationsList[0].target as HTMLElement
    if (
      target.tagName?.toLowerCase() === 'link' &&
      target.getAttribute('href')?.match(/^http/) &&
      target.getAttribute('rel')?.match(/monetization/)
    ) {
      console.log('LINK ATTR CHANGED', target)
    }
  }
}

export const loadObserver = () => {
  const observer = new MutationObserver(listenForLinkChange)
  const observeOptions = {
    attributes: true,
    childList: true,
    subtree: true,
  }

  observer.observe(document, observeOptions)
}
