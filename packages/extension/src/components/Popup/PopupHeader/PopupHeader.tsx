import React from 'react'
import { runtime } from 'webextension-polyfill'

const Logo = runtime.getURL('assets/images/logo.svg')
const Close = runtime.getURL('assets/images/close.svg')
import './PopupHeader.scss'

const PopupHeader: React.FC = () => {
  return (
    <div className="header">
      <img src={Logo} alt="Web Monetization Logo" className="logo" />
      <div className="text-sm font-medium">Web Monetization</div>
      <button className="close-btn" onClick={() => window.close()}>
        <img src={Close} alt="Close" />
      </button>
    </div>
  )
}

export default PopupHeader
