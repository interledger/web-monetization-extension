import './index.css';

// If we want to check the performance or rerenders, simply uncomment the import
// and the code below.
// Please note that `react-scan` should be imported before React!
//
// Alternative solution: Have a separate index file that is only used for development

// import { scan } from 'react-scan';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { Popup } from './Popup';

// if (typeof window !== 'undefined') {
//   scan({
//     enabled: true,
//     log: true,
//   });
// }

const root = ReactDOM.createRoot(document.getElementById('popup-container')!);
root.render(<Popup />);
