// If we want to check the performance or rerenders, simply import this file.
// Please note that `react-scan` must be imported before React!

import { scan } from 'react-scan';

if (typeof window !== 'undefined') {
  scan({ enabled: true, log: true });
}
