import './PopupFooter.scss'

import React from 'react'

interface IProps {
  isMonetizationReady: boolean
}

const PopupFooter: React.FC<IProps> = ({ isMonetizationReady }) => (
  <footer className="footer">
    {isMonetizationReady ? (
      <span>This site is Web Monetization ready</span>
    ) : (
      <span>This site isn&apos;t Web Monetization ready</span>
    )}
  </footer>
)

export default PopupFooter
