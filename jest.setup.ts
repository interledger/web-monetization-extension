import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

import { chrome } from 'jest-chrome';

Object.assign(global, { chrome: chrome, browser: chrome });

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;
