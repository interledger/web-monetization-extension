import { useEffect, useState } from 'react'

const useMonetization = () => {
  const [isMonetized, setIsMonetized] = useState(false)

  useEffect(() => {
    const monetizationTag = document.querySelector('link[rel="monetization"]')
    if (monetizationTag) {
      setIsMonetized(true)
    } else {
      setIsMonetized(false)
    }
  }, [])

  return isMonetized
}

export default useMonetization
