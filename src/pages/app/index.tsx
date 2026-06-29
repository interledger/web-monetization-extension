import '@/pages/shared/style.css';
import '@/pages/app/lib/style.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';

const root = ReactDOM.createRoot(document.getElementById('container')!);
root.render(<App />);
