import './index.css';

// import '@/pages/shared/lib/react-scan'; // uncomment this to check performance or re-renders
import React from 'react';
import ReactDOM from 'react-dom/client';

import { Popup } from './Popup';

// biome-ignore lint/style/noNonNullAssertion: <explanation>
const root = ReactDOM.createRoot(document.getElementById('popup-container')!);
root.render(<Popup />);
