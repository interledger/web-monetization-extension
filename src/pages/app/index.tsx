import './index.css';

// import './lib/react-scan'; // uncomment this to check performance or re-renders
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';

const root = ReactDOM.createRoot(document.getElementById('container')!);
root.render(<App />);
