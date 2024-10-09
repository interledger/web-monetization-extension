import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import browser from 'webextension-polyfill';

import {
  BrowserContextProvider,
  TranslationContextProvider,
} from '@/popup/lib/context';
import { StateContextProvider, UIModeProvider } from './context';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('container')!);
root.render(
  <BrowserContextProvider browser={browser}>
    <TranslationContextProvider>
      <UIModeProvider>
        <StateContextProvider>
          <App />
        </StateContextProvider>
      </UIModeProvider>
    </TranslationContextProvider>
  </BrowserContextProvider>,
);
